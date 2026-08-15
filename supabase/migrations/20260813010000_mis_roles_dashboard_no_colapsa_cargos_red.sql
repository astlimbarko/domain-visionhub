-- VisionHub -- KAN-186: el selector multirol no mostraba "Supervisor de Red"
-- cuando la misma persona tiene los 2 cargos (LIDER_RED y SUBLIDER_RED)
-- vigentes a la vez en la misma Red. Decision del owner (2026-08-13): esa
-- combinacion SI debe poder coexistir (no se fuerza exclusividad) -- el
-- selector tiene que mostrar ambos cargos como opciones separadas.
--
-- Causa real: `DISTINCT ON (r.id) ... ORDER BY r.id, (c.codigo = 'LIDER_RED')
-- DESC` colapsaba a una sola fila por Red, quedandose siempre con LIDER_RED
-- cuando existian los 2 cargos -- SUBLIDER_RED (mostrado como "Supervisor de
-- Red") desaparecia en silencio del array `redes_lider`, aunque el cargo
-- existiera en la base. El resto de la cadena (contextos-disponibles.ts,
-- useOpcionesRolContextuales.ts) ya arma una opcion distinta por cada fila
-- del array (clave incluye el cargo), asi que alcanza con dejar de colapsar
-- acá -- no hace falta tocar el frontend.
CREATE OR REPLACE FUNCTION public.fn_mis_roles_dashboard(p_iglesia_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'IGLESIA_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'es_operativo', fn_es_operativo_en(p_iglesia_id),
    'redes_lider', (
      SELECT jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'color', x.color, 'es_sublider', x.es_sublider) ORDER BY x.nombre, x.es_sublider)
      FROM (
        SELECT r.id, r.nombre, r.color, (c.codigo = 'SUBLIDER_RED') AS es_sublider
        FROM red r JOIN red_cargo rc ON rc.red_id = r.id
        JOIN cargo c ON c.id = rc.cargo_id AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED')
        WHERE r.iglesia_id = p_iglesia_id AND rc.persona_id = fn_mi_persona_id()
          AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
      ) x
    ),
    'cdp_lider', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'etiqueta', fn_etiqueta_cdp(c.id),
        'red_id', (
          SELECT cr.red_id FROM casa_de_paz_red cr
          WHERE cr.casa_de_paz_id = c.id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL LIMIT 1
        ),
        'anfitrion_nombre', (
          SELECT fn_nombre_completo(p) FROM persona p
          JOIN casa_de_paz_cargo cc2 ON cc2.persona_id = p.id
          JOIN cargo ca2 ON ca2.id = cc2.cargo_id
          WHERE cc2.casa_de_paz_id = c.id AND ca2.codigo = 'ANFITRION'
            AND cc2.fecha_fin IS NULL AND cc2.fecha_eliminacion IS NULL LIMIT 1
        ),
        'direccion', (
          SELECT NULLIF(concat_ws(' · ',
              NULLIF(trim(concat_ws(' ', d.calle, d.numero)), ''),
              NULLIF(trim(COALESCE(d.ciudad, d.zona)), '')
            ), '')
          FROM direccion_asignacion da JOIN direccion d ON d.id = da.direccion_id
          WHERE da.casa_de_paz_id = c.id AND da.activo AND da.fecha_eliminacion IS NULL LIMIT 1
        )
      ) ORDER BY fn_etiqueta_cdp(c.id))
      FROM casa_de_paz c JOIN casa_de_paz_cargo cc ON cc.casa_de_paz_id = c.id
      JOIN cargo ca ON ca.id = cc.cargo_id AND ca.codigo = 'LIDER_CDP'
      WHERE c.iglesia_id = p_iglesia_id AND cc.persona_id = fn_mi_persona_id()
        AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    ),
    'cdp_sublider', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'etiqueta', fn_etiqueta_cdp(c.id),
        'red_id', (
          SELECT cr.red_id FROM casa_de_paz_red cr
          WHERE cr.casa_de_paz_id = c.id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL LIMIT 1
        ),
        'anfitrion_nombre', (
          SELECT fn_nombre_completo(p) FROM persona p
          JOIN casa_de_paz_cargo cc2 ON cc2.persona_id = p.id
          JOIN cargo ca2 ON ca2.id = cc2.cargo_id
          WHERE cc2.casa_de_paz_id = c.id AND ca2.codigo = 'ANFITRION'
            AND cc2.fecha_fin IS NULL AND cc2.fecha_eliminacion IS NULL LIMIT 1
        ),
        'direccion', (
          SELECT NULLIF(concat_ws(' · ',
              NULLIF(trim(concat_ws(' ', d.calle, d.numero)), ''),
              NULLIF(trim(COALESCE(d.ciudad, d.zona)), '')
            ), '')
          FROM direccion_asignacion da JOIN direccion d ON d.id = da.direccion_id
          WHERE da.casa_de_paz_id = c.id AND da.activo AND da.fecha_eliminacion IS NULL LIMIT 1
        )
      ) ORDER BY fn_etiqueta_cdp(c.id))
      FROM casa_de_paz c JOIN casa_de_paz_cargo cc ON cc.casa_de_paz_id = c.id
      JOIN cargo ca ON ca.id = cc.cargo_id AND ca.codigo = 'SUBLIDER_CDP'
      WHERE c.iglesia_id = p_iglesia_id AND cc.persona_id = fn_mi_persona_id()
        AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    )
  );
END;
$$;
