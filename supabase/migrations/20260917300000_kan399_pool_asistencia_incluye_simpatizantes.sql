-- VisionHub -- KAN-399 (2026-09-17, hallazgo de Urías en vivo): el buscador
-- unificado de asistencia (KAN-391) arma su pool local con
-- `obtenerMiembrosCdp` -- casa_de_paz_membresia (formal) + fn_visitas_regulares_cdp
-- (asistencia, pero exige estado >= Nuevo Convertido). Una persona que ya
-- visitó esta CdP y quedó en Simpatizante (sin membresía formal) queda
-- afuera de ese pool, aunque "Personas de mi Casa de Paz" (fn_personas_de_cdp,
-- 2026-09-07/08) SÍ la reconoce como "de esta CdP" -- ese es el criterio
-- correcto ya establecido: alguien "pertenece" a la CdP si tiene membresía
-- formal, O si tiene asistencia registrada en algún reporte de esta CdP y no
-- tiene membresía acá, sin importar su estado (SIM/NC/Creyente). El buscador
-- caía a la búsqueda global sin avisar que ya era conocida, y si se la
-- seleccionaba se guardaba mal como "asistente nuevo" (visita).
--
-- No se toca fn_visitas_regulares_cdp: su restricción a NC/Creyente es una
-- decisión de spec deliberada y vigente (20260907030000, "Asistencia Regular
-- sigue siendo solo NC/Creyente -- spec punto 11"), y ese mismo RPC también
-- alimenta el Historial de Asistencia con esa semántica más angosta a
-- propósito en otros contextos. En vez de tocarlo o inventar un 3er criterio,
-- se agrega `fn_visitas_cdp`: mismo criterio de "asistencia sin membresía en
-- esta CdP" ya usado en fn_personas_de_cdp (incluye cualquier estado, incluso
-- sin estado asignado), con la misma forma de fn_visitas_regulares_cdp para
-- que el frontend pueda reusar el pool sin cambios de tipo. La exclusión por
-- membresía es "cualquier membresía activa en esta CdP" (principal o
-- secundaria, alineado con el fix de KAN-396) porque `obtenerMiembrosCdp` ya
-- trae esas filas por separado sin filtrar es_principal.

CREATE FUNCTION public.fn_visitas_cdp(p_casa_de_paz_id uuid)
RETURNS TABLE(persona_id uuid, nombre_completo text, sexo sexo_enum, tiene_fecha_nacimiento boolean, edad integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if not fn_puede_ver_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  return query
  select p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento is not null,
         case when p.fecha_nacimiento is null then null
              else extract(year from age(p.fecha_nacimiento))::int end
  from persona p
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

GRANT EXECUTE ON FUNCTION public.fn_visitas_cdp(uuid) TO authenticated;

-- KAN-399 (2do hallazgo): fn_origen_cdp_personas (KAN-391) tenía el mismo
-- hueco -- solo resolvía la CdP "de origen" de alguien vía membresía formal
-- (casa_de_paz_membresia). Una persona sin membresía pero con asistencia en
-- OTRA CdP (ej. Simpatizante visitando una CdP que no es la suya) no se
-- reconocía como "ya conocida en otra CdP": el buscador la mostraba como
-- resultado global anónimo, sin la etiqueta de origen. Se agrega una 2da
-- rama con el mismo criterio (asistencia sin membresía) -- se toma la CdP de
-- su reporte de asistencia más reciente como "origen" cuando no hay
-- membresía formal.
CREATE OR REPLACE FUNCTION public.fn_origen_cdp_personas(p_persona_ids uuid[])
RETURNS TABLE(persona_id uuid, casa_de_paz_id uuid, casa_de_paz_nombre text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT cm.persona_id, cm.casa_de_paz_id, fn_etiqueta_cdp(cm.casa_de_paz_id)
  FROM casa_de_paz_membresia cm
  JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id AND cdp.fecha_eliminacion IS NULL
  JOIN persona p ON p.id = cm.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())
  WHERE cm.persona_id = ANY(p_persona_ids)
    AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL

  UNION ALL

  -- KAN-399: sin membresía formal (ej. Simpatizante) pero con asistencia
  -- registrada en alguna CdP -- mismo criterio de "pertenece a esta CdP" que
  -- fn_personas_de_cdp/fn_visitas_cdp. Se toma la CdP del reporte más
  -- reciente como origen cuando hay más de uno. DISTINCT ON va en una
  -- subconsulta propia -- un ORDER BY a nivel del UNION ALL completo no
  -- puede referenciar alias de una sola rama.
  SELECT persona_id, casa_de_paz_id, casa_de_paz_nombre FROM (
    SELECT DISTINCT ON (a.persona_id)
      a.persona_id, r.casa_de_paz_id, fn_etiqueta_cdp(r.casa_de_paz_id) AS casa_de_paz_nombre
    FROM casa_de_paz_asistencia a
    JOIN casa_de_paz_reporte r ON r.id = a.reporte_id AND r.fecha_eliminacion IS NULL
    JOIN casa_de_paz cdp ON cdp.id = r.casa_de_paz_id AND cdp.fecha_eliminacion IS NULL
    JOIN persona p ON p.id = a.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())
    WHERE a.persona_id = ANY(p_persona_ids)
      AND a.fecha_eliminacion IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM casa_de_paz_membresia cm2
        WHERE cm2.persona_id = a.persona_id
          AND cm2.es_principal AND cm2.fecha_fin IS NULL AND cm2.fecha_eliminacion IS NULL
      )
    ORDER BY a.persona_id, r.fecha_reunion DESC
  ) sub2;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_origen_cdp_personas(uuid[]) TO authenticated;
