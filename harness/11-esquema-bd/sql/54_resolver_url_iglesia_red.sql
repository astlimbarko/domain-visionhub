-- VisionHub -- 54_resolver_url_iglesia_red.sql
-- 14-afirmacion. Dos correcciones a fn_resolver_url_registro (19_registro_publico.sql),
-- verificadas end-to-end el 2026-07-26 a pedido del owner:
--
-- 1) BUG REAL preexistente (no introducido por Afirmacion): la funcion usaba
--    cdp.nombre crudo para "casa_de_paz_nombre", pero casa_de_paz.nombre es
--    NULL para toda CdP real (se identifican por su lider, ver
--    23_etiqueta_cdp.sql / decision del owner 2026-07-18) -- el formulario
--    publico mostraba la Casa de Paz en blanco para cualquier lider real.
--    Corregido a fn_etiqueta_cdp(cdp.id).
-- 2) Se agrega el nombre de la Red y el nombre de la Iglesia a la respuesta,
--    para que el formulario publico los muestre junto al lider (pedido
--    explicito del owner).
--
-- RETURNS JSONB no cambia de firma -- CREATE OR REPLACE alcanza, sin
-- DROP+CREATE (a diferencia de fn_mis_iglesias_detalle, que es RETURNS TABLE).

CREATE OR REPLACE FUNCTION fn_resolver_url_registro(p_slug VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT cpu.estado, fn_config_bool(cpu.iglesia_id, 'REGISTRO_URL_ACTIVO') AS iglesia_activa,
         fn_nombre_completo(p) AS lider_nombre,
         fn_etiqueta_cdp(cdp.id) AS cdp_nombre,
         r_.nombre AS red_nombre,
         i.nombre AS iglesia_nombre,
         cpu.iglesia_id AS iglesia_id
  INTO r
  FROM casa_paz_url cpu
  JOIN persona p ON p.id = cpu.persona_id
  JOIN casa_de_paz cdp ON cdp.id = cpu.casa_de_paz_id
  JOIN iglesia i ON i.id = cpu.iglesia_id
  LEFT JOIN casa_de_paz_red cdr ON cdr.casa_de_paz_id = cdp.id
       AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
  LEFT JOIN red r_ ON r_.id = cdr.red_id
  WHERE cpu.slug = p_slug AND cpu.fecha_eliminacion IS NULL;

  IF NOT FOUND OR r.estado <> 'ACTIVO' OR NOT r.iglesia_activa THEN
    RETURN jsonb_build_object('admite_registro', false);
  END IF;

  RETURN jsonb_build_object(
    'admite_registro', true,
    'lider_nombre', r.lider_nombre,
    'casa_de_paz_nombre', r.cdp_nombre,
    'red_nombre', r.red_nombre,
    'iglesia_nombre', r.iglesia_nombre,
    'campos_obligatorios', jsonb_build_object(
      'ci', fn_config_bool(r.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', fn_config_bool(r.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO')
    )
  );
END;
$$;
