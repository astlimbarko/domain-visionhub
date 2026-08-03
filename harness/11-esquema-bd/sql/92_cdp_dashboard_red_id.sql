-- VisionHub -- 92_cdp_dashboard_red_id.sql
-- Pedido del owner (2026-08-02): en la agrupación "Dashboard" del sidebar
-- (AppShell.tsx, `sombreros`), si una persona ya tiene acceso a nivel Red
-- (Líder de Red o Supervisor de la Red en Acción) no debería aparecer
-- TAMBIÉN un atajo separado a una Casa de Paz que ya pertenece a esa misma
-- Red -- es redundante, esa CdP ya se ve desde el dashboard de la Red. Antes
-- solo pasaba con combinaciones que no se solapaban (ej. Supervisor de la
-- Visión + Sublíder de una CdP en otra Red), pero con "Supervisor de la Red
-- en Acción" (90_) se volvió un caso real: la misma persona puede ser
-- Sublíder de una CdP que está DENTRO de la Red que supervisa.
--
-- fn_mis_roles_dashboard no exponía `red_id` en cdp_lider/cdp_sublider, así
-- que el frontend no tenía forma de saber si una CdP ya está cubierta por
-- alguna Red en `redes_lider`. Se agrega esa columna (mismo patrón que
-- casa_de_paz_red ya usa en otras funciones -- vigente = fecha_fin IS NULL).
-- El filtrado en sí se hace en AppShell.tsx, no acá (esta función solo
-- expone el dato).
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
      SELECT jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'color', x.color, 'es_sublider', x.es_sublider) ORDER BY x.nombre)
      FROM (
        SELECT DISTINCT ON (r.id) r.id, r.nombre, r.color, (c.codigo = 'SUBLIDER_RED') AS es_sublider
        FROM red r JOIN red_cargo rc ON rc.red_id = r.id
        JOIN cargo c ON c.id = rc.cargo_id AND c.codigo IN ('LIDER_RED', 'SUBLIDER_RED')
        WHERE r.iglesia_id = p_iglesia_id AND rc.persona_id = fn_mi_persona_id()
          AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
        ORDER BY r.id, (c.codigo = 'LIDER_RED') DESC
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
