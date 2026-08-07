-- VisionHub — bug real encontrado en vivo (2026-08-06/07) mientras se
-- probaba la nueva notificacion por correo de designacion: la busqueda
-- "Desde base de datos" en Estructura Organizacional (y cualquier otro
-- lugar que llame a fn_buscar_personas con los 4 parametros de siempre)
-- rompia con PGRST203 "Could not choose the best candidate function".
--
-- Causa: existian 2 overloads de fn_buscar_personas en la base
-- (uuid,text,boolean,integer,uuid) y (uuid,text,boolean,integer,boolean,
-- integer,integer) -- ninguno de los dos coincide con la version
-- versionada en harness/11-esquema-bd/sql/37_directorio_personas.sql
-- (4 parametros), y ninguno esta referenciado en ningun lado del
-- frontend ni de las Edge Functions (p_red_id, p_excluir_semillas,
-- p_pagina, p_por_pagina no aparecen en ningun llamado real). Quedaron
-- de algun cambio aplicado directo a la base, sin migracion versionada
-- (mismo patron de bug ya visto con fn_puede_invitar_lider/fn_invitar_lider,
-- KAN-84). Con ambos default-compatibles con una llamada de 4 parametros,
-- PostgREST no puede elegir cual usar -- por eso rompia SIEMPRE, no solo
-- en la prueba de hoy.
--
-- Fix: borrar los 2 overloads huerfanos y restaurar la version unica
-- versionada (idéntica a la de 37_directorio_personas.sql).

begin;

drop function if exists public.fn_buscar_personas(uuid, text, boolean, integer, uuid);
drop function if exists public.fn_buscar_personas(uuid, text, boolean, integer, boolean, integer, integer);

CREATE OR REPLACE FUNCTION public.fn_buscar_personas(
  p_iglesia_id UUID,
  p_texto TEXT DEFAULT NULL,
  p_incluir_ocultas BOOLEAN DEFAULT false,
  p_limite INT DEFAULT 200
)
RETURNS TABLE (
  id UUID, nombre_completo TEXT, sexo sexo_enum, fecha_nacimiento DATE, edad INT,
  ci VARCHAR, correo VARCHAR, oculto BOOLEAN,
  estado_sigla VARCHAR, estado_nombre VARCHAR,
  casa_de_paz_id UUID, casa_de_paz_etiqueta TEXT,
  telefono_principal VARCHAR
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento,
         CASE WHEN p.fecha_nacimiento IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM age(p.fecha_nacimiento))::INT END,
         p.ci, p.correo, p.oculto,
         e.sigla, e.nombre,
         cdp.id, CASE WHEN cdp.id IS NOT NULL THEN fn_etiqueta_cdp(cdp.id) ELSE NULL END,
         tel.numero
  FROM persona p
  LEFT JOIN persona_estado pe ON pe.persona_id = p.id AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
  LEFT JOIN estado e ON e.id = pe.estado_id
  LEFT JOIN casa_de_paz_membresia cm ON cm.persona_id = p.id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  LEFT JOIN casa_de_paz cdp ON cdp.id = cm.casa_de_paz_id
  LEFT JOIN telefono_asignacion ta ON ta.persona_id = p.id AND ta.es_principal AND ta.activo AND ta.fecha_eliminacion IS NULL
  LEFT JOIN telefono tel ON tel.id = ta.telefono_id
  WHERE p.iglesia_id = p_iglesia_id
    AND p.fecha_eliminacion IS NULL
    AND (p_incluir_ocultas OR NOT p.oculto)
    AND (
      p_texto IS NULL OR btrim(p_texto) = '' OR
      fn_nombre_completo(p) ILIKE '%' || p_texto || '%' OR
      p.ci ILIKE '%' || p_texto || '%' OR
      p.correo ILIKE '%' || p_texto || '%'
    )
  ORDER BY p.primer_apellido, p.primer_nombre
  LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_buscar_personas(UUID, TEXT, BOOLEAN, INT) TO authenticated;

commit;
