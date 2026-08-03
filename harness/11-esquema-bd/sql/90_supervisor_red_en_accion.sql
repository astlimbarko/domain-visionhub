-- VisionHub -- 90_supervisor_red_en_accion.sql
-- Pedido del owner (2026-08-02): el "Supervisor de la Red en Acción" es el
-- verdadero apoyo del Líder de Red -- conceptualmente un Sublíder de Red,
-- que ya existía como cargo (`SUBLIDER_RED`, ya asignable desde "Gestión de
-- Casas de Paz" -> "Sublíderes de {red}") pero sin ningún RolUI/dashboard
-- funcional: la persona podía tener el cargo pero no tenía panel al loguearse.
-- "Puede hacer lo mismo que el Líder de Red, ya que es de apoyo" (owner,
-- textual) -- paridad completa, no un rol acotado como el Sublíder de CdP.
--
-- 1) Retitula el cargo -- fn_mi_titulo (39_titulo_header.sql) ya usa
--    cargo.nombre para el header sin ningún cambio de código, así que
--    renombrar acá alcanza para esa parte.
UPDATE cargo SET nombre = 'Supervisor de la Red en Acción' WHERE codigo = 'SUBLIDER_RED';

-- 2) fn_mis_roles_dashboard: `redes_lider` pasa a incluir también las Redes
--    donde la persona es SUBLIDER_RED (misma paridad de acceso que
--    LIDER_RED -- determinarRolUI en el frontend ya asigna RolUI 'LIDER_RED'
--    con solo `redes_lider.length > 0`, así que unificar acá alcanza para
--    que use el mismo nav/dashboard sin tocar ninguna otra función). Se
--    agrega `es_sublider` por fila para que el picker de roles pueda mostrar
--    el título correcto por Red (Líder de Red / Supervisor de la Red en
--    Acción) en vez de asumir uno solo. Si una persona tuviera ambos cargos
--    para la misma Red (caso raro), gana LIDER_RED.
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
