-- VisionHub -- KAN-16x: Super Admin y Supervisor de la Vision en Accion
-- pueden eliminar por completo (de la base de datos) una Casa de Paz o una
-- Red, siempre que este VACIA -- pedido del owner, 2026-08-10: "esto
-- sucede porque a veces creamos para probar". Antes solo Super Admin podia
-- hacerlo, y sin ningun chequeo de contenido.
--
-- "Vacia":
--   - Casa de Paz: sin lider/sublider/anfitrion activo (casa_de_paz_cargo)
--     ni miembros activos (casa_de_paz_membresia).
--   - Red: sin lider/supervisor de red activo (red_cargo) ni Casas de Paz
--     bajo su gobernanza (casa_de_paz_red).
-- El chequeo aplica a cualquiera que llame (Super Admin incluido) -- es
-- una red de seguridad, no una restriccion nueva para un rol en particular.

CREATE OR REPLACE FUNCTION public.fn_estructura_eliminar_casa_de_paz(
  p_cdp_id uuid,
  p_otp text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_iglesia_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.iglesia_id INTO v_iglesia_id
  FROM public.casa_de_paz c
  WHERE c.id = p_cdp_id;

  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'ESTRUCTURA_CDP_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.fn_es_super_admin() OR public.fn_es_operativo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'SOLO_SUPER_ADMIN_O_SUPERVISOR: se requiere ser Super Admin o Pastor/Supervisor de la iglesia para eliminar una Casa de Paz de la base de datos'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.casa_de_paz_cargo cc WHERE cc.casa_de_paz_id = p_cdp_id AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.casa_de_paz_membresia m WHERE m.casa_de_paz_id = p_cdp_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'CDP_NO_ESTA_VACIA: la Casa de Paz tiene líder, sublíder, anfitrión o miembros -- quítelos antes de eliminarla por completo'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  ALTER TABLE public.casa_de_paz DISABLE TRIGGER trg_no_delete_casa_de_paz;
  ALTER TABLE public.casa_de_paz_cargo DISABLE TRIGGER trg_no_delete_casa_de_paz_cargo;
  ALTER TABLE public.casa_de_paz_membresia DISABLE TRIGGER trg_no_delete_casa_de_paz_membresia;
  ALTER TABLE public.casa_de_paz_red DISABLE TRIGGER trg_no_delete_casa_de_paz_red;
  ALTER TABLE public.estructura_nodo_posicion DISABLE TRIGGER trg_no_delete_estructura_nodo_posicion;
  ALTER TABLE public.evento DISABLE TRIGGER trg_no_delete_evento;
  ALTER TABLE public.fusion_casa_de_paz DISABLE TRIGGER trg_no_delete_fusion_casa_de_paz;
  ALTER TABLE public.invitacion_lider DISABLE TRIGGER trg_no_delete_invitacion_lider;
  ALTER TABLE public.meta_evangelismo_asignada DISABLE TRIGGER trg_no_delete_meta_evangelismo_asignada;
  ALTER TABLE public.multiplicacion_casa_de_paz DISABLE TRIGGER trg_no_delete_multiplicacion_casa_de_paz;
  ALTER TABLE public.visita_cdp DISABLE TRIGGER trg_no_delete_visita_cdp;
  ALTER TABLE public.casa_de_paz_reporte DISABLE TRIGGER trg_no_delete_casa_de_paz_reporte;
  ALTER TABLE public.casa_paz_url DISABLE TRIGGER trg_no_delete_casa_paz_url;
  ALTER TABLE public.direccion_asignacion DISABLE TRIGGER trg_no_delete_direccion_asignacion;
  ALTER TABLE public.evangelismo DISABLE TRIGGER trg_no_delete_evangelismo;
  ALTER TABLE public.finanzas_ingreso DISABLE TRIGGER trg_no_delete_finanzas_ingreso;
  ALTER TABLE public.migracion_propuesta DISABLE TRIGGER trg_no_delete_migracion_propuesta;
  ALTER TABLE public.telefono_asignacion DISABLE TRIGGER trg_no_delete_telefono_asignacion;
  ALTER TABLE public.casa_de_paz_asistencia DISABLE TRIGGER trg_no_delete_casa_de_paz_asistencia;
  ALTER TABLE public.persona_llegada DISABLE TRIGGER trg_no_delete_persona_llegada;

  DELETE FROM public.persona_llegada WHERE casa_paz_url_id IN (
    SELECT id FROM public.casa_paz_url WHERE casa_de_paz_id = p_cdp_id
      OR casa_de_paz_cargo_id IN (SELECT id FROM public.casa_de_paz_cargo WHERE casa_de_paz_id = p_cdp_id)
  );
  DELETE FROM public.casa_de_paz_asistencia WHERE reporte_id IN (
    SELECT id FROM public.casa_de_paz_reporte WHERE casa_de_paz_id = p_cdp_id
  );
  DELETE FROM public.finanzas_ingreso WHERE casa_de_paz_id = p_cdp_id
    OR reporte_id IN (SELECT id FROM public.casa_de_paz_reporte WHERE casa_de_paz_id = p_cdp_id);
  DELETE FROM public.casa_paz_url WHERE casa_de_paz_id = p_cdp_id
    OR casa_de_paz_cargo_id IN (SELECT id FROM public.casa_de_paz_cargo WHERE casa_de_paz_id = p_cdp_id);
  DELETE FROM public.casa_de_paz_cargo WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.casa_de_paz_reporte WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.casa_de_paz_membresia WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.direccion_asignacion WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.evangelismo WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.evento WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.telefono_asignacion WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.visita_cdp WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.meta_evangelismo_asignada WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.migracion_propuesta WHERE cdp_origen_id = p_cdp_id OR cdp_destino_id = p_cdp_id;
  DELETE FROM public.multiplicacion_casa_de_paz WHERE casa_de_paz_origen_id = p_cdp_id OR casa_de_paz_nueva_id = p_cdp_id;
  DELETE FROM public.fusion_casa_de_paz WHERE casa_de_paz_origen_id = p_cdp_id OR casa_de_paz_destino_id = p_cdp_id;
  DELETE FROM public.casa_de_paz_red WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.invitacion_lider WHERE casa_de_paz_id = p_cdp_id;
  DELETE FROM public.estructura_nodo_posicion WHERE entidad_id = p_cdp_id;

  DELETE FROM public.casa_de_paz WHERE id = p_cdp_id;

  ALTER TABLE public.casa_de_paz ENABLE TRIGGER trg_no_delete_casa_de_paz;
  ALTER TABLE public.casa_de_paz_cargo ENABLE TRIGGER trg_no_delete_casa_de_paz_cargo;
  ALTER TABLE public.casa_de_paz_membresia ENABLE TRIGGER trg_no_delete_casa_de_paz_membresia;
  ALTER TABLE public.casa_de_paz_red ENABLE TRIGGER trg_no_delete_casa_de_paz_red;
  ALTER TABLE public.estructura_nodo_posicion ENABLE TRIGGER trg_no_delete_estructura_nodo_posicion;
  ALTER TABLE public.evento ENABLE TRIGGER trg_no_delete_evento;
  ALTER TABLE public.fusion_casa_de_paz ENABLE TRIGGER trg_no_delete_fusion_casa_de_paz;
  ALTER TABLE public.invitacion_lider ENABLE TRIGGER trg_no_delete_invitacion_lider;
  ALTER TABLE public.meta_evangelismo_asignada ENABLE TRIGGER trg_no_delete_meta_evangelismo_asignada;
  ALTER TABLE public.multiplicacion_casa_de_paz ENABLE TRIGGER trg_no_delete_multiplicacion_casa_de_paz;
  ALTER TABLE public.visita_cdp ENABLE TRIGGER trg_no_delete_visita_cdp;
  ALTER TABLE public.casa_de_paz_reporte ENABLE TRIGGER trg_no_delete_casa_de_paz_reporte;
  ALTER TABLE public.casa_paz_url ENABLE TRIGGER trg_no_delete_casa_paz_url;
  ALTER TABLE public.direccion_asignacion ENABLE TRIGGER trg_no_delete_direccion_asignacion;
  ALTER TABLE public.evangelismo ENABLE TRIGGER trg_no_delete_evangelismo;
  ALTER TABLE public.finanzas_ingreso ENABLE TRIGGER trg_no_delete_finanzas_ingreso;
  ALTER TABLE public.migracion_propuesta ENABLE TRIGGER trg_no_delete_migracion_propuesta;
  ALTER TABLE public.telefono_asignacion ENABLE TRIGGER trg_no_delete_telefono_asignacion;
  ALTER TABLE public.casa_de_paz_asistencia ENABLE TRIGGER trg_no_delete_casa_de_paz_asistencia;
  ALTER TABLE public.persona_llegada ENABLE TRIGGER trg_no_delete_persona_llegada;
END;
$$;

-- Red: mismo criterio, pero conserva su propio mecanismo existente (ventana
-- de 60s para deshacer + barrido por pg_cron) -- solo se suma el permiso de
-- Supervisor y el chequeo de vacia antes de programar el borrado.
CREATE OR REPLACE FUNCTION public.fn_estructura_programar_borrado_red(
  p_red_id uuid,
  p_otp text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_red_id uuid;
  v_iglesia_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'NO_AUTENTICADO' USING ERRCODE = 'P0001';
  END IF;

  SELECT r.id, r.iglesia_id INTO v_red_id, v_iglesia_id
  FROM public.red r
  WHERE r.id = p_red_id
    AND r.fecha_eliminacion IS NOT NULL
    AND r.fecha_borrado_definitivo_programado IS NULL;

  IF v_red_id IS NULL THEN
    RAISE EXCEPTION 'ESTRUCTURA_RED_NO_ENCONTRADA: la Red no existe, no esta eliminada, o ya tiene un borrado programado'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (public.fn_es_super_admin() OR public.fn_es_operativo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'SOLO_SUPER_ADMIN_O_SUPERVISOR: se requiere ser Super Admin o Pastor/Supervisor de la iglesia para eliminar una Red de la base de datos'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.red_cargo rc WHERE rc.red_id = p_red_id AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.casa_de_paz_red cr WHERE cr.red_id = p_red_id AND cr.fecha_fin IS NULL AND cr.fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'RED_NO_ESTA_VACIA: la Red tiene líder/supervisor o Casas de Paz bajo su gobernanza -- quítelos antes de eliminarla por completo'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  UPDATE public.red
  SET fecha_borrado_definitivo_programado = now()
  WHERE id = v_red_id;
END;
$$;
