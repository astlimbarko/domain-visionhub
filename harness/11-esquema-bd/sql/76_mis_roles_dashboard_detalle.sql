-- VisionHub -- 76_mis_roles_dashboard_detalle.sql
-- Rediseno de la pantalla de seleccion multi-rol (SeleccionarRol.tsx,
-- 2026-08-01, referencia login_multi_rol.jpeg): cada opcion necesita mostrar
-- datos reales de su contexto, no solo el nombre. fn_mis_roles_dashboard
-- (36_dashboards_completos.sql) solo traia {id, nombre} por Red y
-- {id, etiqueta} por CdP -- se agrega el color real de la Red (columna
-- `color` ya existe en `red`, 60_red_color.sql, solo se expone aca) y el
-- anfitrion + direccion de cada Casa de Paz (mismo patron que fn_etiqueta_cdp
-- / fn_listar_cdp, sin tocar ningun chequeo de permiso existente -- es
-- RETURNS JSONB, CREATE OR REPLACE no rompe el contrato con el frontend,
-- solo agrega claves nuevas al objeto).

CREATE OR REPLACE FUNCTION fn_mis_roles_dashboard(p_iglesia_id UUID)
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
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre, 'color', r.color) ORDER BY r.nombre)
      FROM red r JOIN red_cargo rc ON rc.red_id = r.id
      JOIN cargo c ON c.id = rc.cargo_id AND c.codigo = 'LIDER_RED'
      WHERE r.iglesia_id = p_iglesia_id AND rc.persona_id = fn_mi_persona_id()
        AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    ),
    'cdp_lider', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'etiqueta', fn_etiqueta_cdp(c.id),
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
