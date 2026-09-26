-- KAN-447 (2026-09-25, pedido explícito del owner): mostrar el teléfono de
-- asistentes NC/RE en las 3 listas de Asistencia del Reporte de CdP, para
-- facilitar el seguimiento pastoral sin abrir la ficha completa. Ni
-- fn_visitas_cdp ni fn_buscar_personas_reporte devolvían teléfono -- se
-- agrega a ambas.
--
-- DROP + CREATE (no CREATE OR REPLACE): Postgres no permite cambiar la
-- lista de columnas de RETURNS TABLE con CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.fn_visitas_cdp(uuid);

CREATE FUNCTION public.fn_visitas_cdp(p_casa_de_paz_id uuid)
RETURNS TABLE(persona_id uuid, nombre_completo text, sexo sexo_enum, tiene_fecha_nacimiento boolean, edad integer, estado_sigla text, telefono text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if not fn_puede_ver_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  return query
  select p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento is not null,
         case
           when p.fecha_nacimiento is not null then extract(year from age(p.fecha_nacimiento))::int
           else p.edad_aproximada
         end,
         e.sigla::text,
         (select t.numero::text from telefono_asignacion ta join telefono t on t.id = ta.telefono_id
           where ta.persona_id = p.id and ta.es_principal and ta.fecha_eliminacion is null limit 1)
  from persona p
  left join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
  left join estado e on e.id = pe.estado_id
  where p.fecha_eliminacion is null
    and exists (
      select 1 from casa_de_paz_asistencia a
      join casa_de_paz_reporte r on r.id = a.reporte_id
      where a.persona_id = p.id and r.casa_de_paz_id = p_casa_de_paz_id
        and a.fecha_eliminacion is null and r.fecha_eliminacion is null
    )
    and not exists (
      select 1 from casa_de_paz_membresia cm
      where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id
        and cm.fecha_fin is null and cm.fecha_eliminacion is null
    );
end;
$function$;

DROP FUNCTION IF EXISTS public.fn_buscar_personas_reporte(uuid, text, integer, uuid, integer);

CREATE FUNCTION public.fn_buscar_personas_reporte(
  p_iglesia_id UUID,
  p_texto TEXT,
  p_edad_minima INT DEFAULT NULL,
  p_cdp_id UUID DEFAULT NULL,
  p_limite INT DEFAULT 10
)
RETURNS TABLE(id UUID, nombre_completo TEXT, edad INT, estado_sigla TEXT, telefono TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tokens TEXT[];
  v_red_id UUID;
  v_count INT;
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  v_tokens := regexp_split_to_array(btrim(coalesce(p_texto, '')), '\s+');
  IF v_tokens IS NULL OR array_length(v_tokens, 1) IS NULL OR v_tokens[1] = '' THEN
    RETURN;
  END IF;

  -- Nivel 1: dentro de la Casa de Paz activa.
  IF p_cdp_id IS NOT NULL THEN
    RETURN QUERY
    SELECT p.id, fn_nombre_completo(p),
           CASE WHEN p.fecha_nacimiento IS NOT NULL THEN EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
           (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
             WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1),
           (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
             WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
    FROM persona p
    JOIN casa_de_paz_membresia cm
      ON cm.persona_id = p.id AND cm.casa_de_paz_id = p_cdp_id
      AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
    WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
      AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
           OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
      AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
    ORDER BY p.primer_apellido, p.primer_nombre
    LIMIT p_limite;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RETURN; END IF;

    -- Nivel 2: toda la Red de esa Casa de Paz.
    SELECT red_id INTO v_red_id FROM casa_de_paz_red
      WHERE casa_de_paz_id = p_cdp_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
      LIMIT 1;

    IF v_red_id IS NOT NULL THEN
      RETURN QUERY
      SELECT p.id, fn_nombre_completo(p),
             CASE WHEN p.fecha_nacimiento IS NOT NULL THEN EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
             (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
               WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1),
             (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
               WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
      FROM persona p
      JOIN casa_de_paz_membresia cm
        ON cm.persona_id = p.id
        AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
      JOIN casa_de_paz_red cr
        ON cr.casa_de_paz_id = cm.casa_de_paz_id
        AND cr.red_id = v_red_id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
      WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
        AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
             OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
        AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
      ORDER BY p.primer_apellido, p.primer_nombre
      LIMIT p_limite;

      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN RETURN; END IF;
    END IF;
  END IF;

  -- Nivel 3: toda la iglesia.
  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p),
         CASE WHEN p.fecha_nacimiento IS NOT NULL THEN EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
         (SELECT e.sigla::TEXT FROM persona_estado pe JOIN estado e ON e.id = pe.estado_id
           WHERE pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL LIMIT 1),
         (SELECT t.numero::TEXT FROM telefono_asignacion ta JOIN telefono t ON t.id = ta.telefono_id
           WHERE ta.persona_id = p.id AND ta.es_principal AND ta.fecha_eliminacion IS NULL LIMIT 1)
  FROM persona p
  WHERE p.iglesia_id = p_iglesia_id AND p.fecha_eliminacion IS NULL
    AND (p_edad_minima IS NULL OR p.fecha_nacimiento IS NULL
         OR EXTRACT(YEAR FROM age(p.fecha_nacimiento)) >= p_edad_minima)
    AND (SELECT bool_and(fn_nombre_completo(p) ILIKE '%' || t || '%') FROM unnest(v_tokens) AS t)
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT p_limite;
END;
$function$;
