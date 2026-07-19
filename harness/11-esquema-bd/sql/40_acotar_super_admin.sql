-- VisionHub -- 40_acotar_super_admin.sql
-- Acota el Super Admin a un rol tecnico: crear iglesias (con jerarquia
-- padre/hija) y crear el Pastor y el Supervisor de la Vision en Accion de
-- cada iglesia. Deja de tener acceso operativo (dashboards, ofrendas,
-- asistencia, Panel del Supervisor, gestion de Redes/CdP/Lideres). Si un
-- Super Admin necesita actuar como lider, se necesita una cuenta separada.
-- Decision del owner, 2026-07-19.

-- 1. fn_es_pastor_en ya NO bypasea para Super Admin. fn_es_operativo_en se
-- deriva de esta funcion, asi que el efecto se propaga solo a todo lo que
-- ya dependia de ese patron: paneles, dashboards, finanzas, reportes,
-- casas de paz, redes, ministerios, calendario, evangelismo, fusiones,
-- multiplicaciones, y el toggle de 'oculto' de Personas.
CREATE OR REPLACE FUNCTION fn_es_pastor_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND iglesia_id = p_iglesia_id AND rol = 'PASTOR' AND fecha_eliminacion IS NULL
  );
$$;

-- 2. La asignacion de SUPERVISOR_VISION_ACCION dependia del bypass que se
-- acaba de quitar -- se agrega el permiso de Super Admin explicito aca,
-- porque SI esta dentro de su alcance permitido. Ademas: ningun usuario que
-- ya sea SUPER_ADMIN puede recibir un rol operativo/de liderazgo.
CREATE OR REPLACE FUNCTION fn_validar_asignacion_rol()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOASIGNACION: un usuario no puede asignarse un rol a si mismo'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPER_ADMIN' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede crear otro SUPER_ADMIN'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'PASTOR' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede asignar el rol PASTOR'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT (fn_es_pastor_en(NEW.iglesia_id) OR fn_es_super_admin()) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser PASTOR de la iglesia % o Super Admin para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP') AND NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('PASTOR', 'SUPERVISOR_VISION_ACCION', 'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP')
     AND EXISTS (
       SELECT 1 FROM usuario_rol
       WHERE usuario_id = NEW.usuario_id AND rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL
     ) THEN
    RAISE EXCEPTION 'ROL_SUPER_ADMIN_NO_OPERATIVO: un Super Admin no puede tener roles operativos; se necesita una cuenta separada'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. fn_dashboard_pastor no tenia ningun chequeo de permiso propio: dependia
-- de que solo un Pastor real con 2+ iglesias tuviera acceso multi-iglesia
-- via fn_mis_iglesias(). Eso ya no alcanza: un Super Admin tambien ve todas
-- las iglesias ahi (lo necesita para crear Iglesias/Pastor/Supervisor), asi
-- que sin este chequeo hubiera seguido viendo redes/CdP/miembros/ingresos
-- (incluye 'ofrendas', finanzas_ingreso) agregados de todas las iglesias.
CREATE OR REPLACE FUNCTION fn_dashboard_pastor(p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mes_desde DATE := date_trunc('month', p_fecha)::date;
  v_mes_hasta DATE := (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM iglesia i WHERE i.id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(i.id)
  ) THEN
    RAISE EXCEPTION 'DASHBOARD_SIN_PERMISO: se requiere ser Pastor o Supervisor de al menos una iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'iglesias', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'nombre', i.nombre, 'ciudad', i.ciudad,
        'moneda_defecto', (SELECT codigo FROM moneda WHERE id = i.moneda_defecto_id),
        'redes', (SELECT count(*) FROM red r WHERE r.iglesia_id = i.id AND r.activo AND r.fecha_eliminacion IS NULL),
        'cdp', (SELECT count(*) FROM casa_de_paz c WHERE c.iglesia_id = i.id AND c.activo AND c.fecha_eliminacion IS NULL),
        'miembros_cdp', (SELECT count(DISTINCT m.persona_id) FROM casa_de_paz_membresia m
                         WHERE m.iglesia_id = i.id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL),
        'familias', fn_total_familias(i.id),
        'activa', i.activo
      ) ORDER BY i.nombre)
      FROM iglesia i WHERE i.id IN (SELECT fn_mis_iglesias()) AND i.fecha_eliminacion IS NULL
    ),
    'ingresos_por_moneda', (
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT i.nombre AS iglesia, m.codigo AS moneda, t.codigo AS tipo, sum(fi.monto) AS total
        FROM finanzas_ingreso fi
        JOIN iglesia i ON i.id = fi.iglesia_id
        JOIN moneda m ON m.id = fi.moneda_id
        JOIN finanzas_tipo_ingreso t ON t.id = fi.tipo_ingreso_id
        WHERE fi.iglesia_id IN (SELECT fn_mis_iglesias()) AND fi.fecha BETWEEN v_mes_desde AND v_mes_hasta AND fi.fecha_eliminacion IS NULL
        GROUP BY i.nombre, m.codigo, t.codigo
        ORDER BY i.nombre, m.codigo
      ) x
    )
  );
END;
$$;
