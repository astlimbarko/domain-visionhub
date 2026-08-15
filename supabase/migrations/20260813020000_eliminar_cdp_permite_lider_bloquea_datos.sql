-- VisionHub -- KAN-189: "Eliminar Casa de Paz" (borrado definitivo) bloqueaba
-- por tener lider/sublider/anfitrion asignado -- pedido del owner
-- (2026-08-13): eso no deberia importar, lo que si debe seguir bloqueando es
-- que tenga DATOS reales (miembros o reportes/reuniones registradas). Un
-- lider/sublider se puede quitar facil desde el panel; perder el historial
-- de reportes o membresias no.
--
-- "Vacia" para Casa de Paz pasa a ser: sin miembros activos
-- (casa_de_paz_membresia) y sin reportes/reuniones registradas
-- (casa_de_paz_reporte, sin importar fecha_eliminacion -- si tuvo alguna vez
-- una reunion registrada ya no es una CdP "de prueba"). Ya NO bloquea tener
-- lider/sublider/anfitrion vigente (casa_de_paz_cargo).
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
    SELECT 1 FROM public.casa_de_paz_membresia m WHERE m.casa_de_paz_id = p_cdp_id AND m.fecha_fin IS NULL AND m.fecha_eliminacion IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.casa_de_paz_reporte r WHERE r.casa_de_paz_id = p_cdp_id
  ) THEN
    RAISE EXCEPTION 'CDP_NO_ESTA_VACIA: la Casa de Paz tiene miembros o reportes/reuniones registradas -- solo se puede eliminar por completo si no tiene datos reales'
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
