-- VisionHub -- fix de regresion real introducida por la migracion anterior
-- (20260810010000, KAN-154). Al recrear fn_validar_asignacion_rol() se tomo
-- como base el mirror de harness (70_super_admin_asigna_supervisor.sql), que
-- estaba desactualizado -- el grep previo buscaba "FUNCTION
-- fn_validar_asignacion_rol" sin el prefijo "public.", así que no encontro
-- 20260809090000_super_admin_puede_ser_operativo.sql, la version realmente
-- vigente. Eso revirtio 2 decisiones reales del owner del 2026-08-09:
--   1. "El superadmin SI puede tener roles operativos" -- se habia quitado
--      la validacion ROL_SUPER_ADMIN_NO_OPERATIVO, y hoy volvio a aparecer
--      (bug reportado en vivo: asignar Pastor/Supervisor a astlimbark fallaba).
--   2. El bypass de soft-delete (20260809050000): togglear fecha_eliminacion
--      sin cambiar rol/usuario_id/iglesia_id no debe re-validar nada.
-- Se restaura la version del 2026-08-09 tal cual, sumando SOLO el cambio de
-- KAN-154 (SUPER_ADMIN exige fn_es_super_admin_principal(), no
-- fn_es_super_admin()).
CREATE OR REPLACE FUNCTION public.fn_validar_asignacion_rol()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.fecha_eliminacion IS NULL AND NEW.fecha_eliminacion IS NOT NULL
     AND NEW.usuario_id = OLD.usuario_id AND NEW.rol = OLD.rol
     AND NEW.iglesia_id IS NOT DISTINCT FROM OLD.iglesia_id THEN
    RETURN NEW;
  END IF;

  IF NEW.usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOASIGNACION: un usuario no puede asignarse un rol a si mismo'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPER_ADMIN' AND NOT fn_es_super_admin_principal() THEN
    RAISE EXCEPTION 'SUPER_ADMIN_SOLO_PRINCIPAL: solo el Super Admin principal puede crear, editar o quitar otro Super Admin'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'PASTOR' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede asignar el rol PASTOR'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT (fn_es_super_admin() OR fn_es_pastor_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser PASTOR de la iglesia % para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'LIDER_RED' AND NOT (fn_es_super_admin() OR fn_es_operativo_en(NEW.iglesia_id) OR fn_es_pastor_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_CDP', 'SUBLIDER_CDP')
     AND NOT (fn_es_super_admin() OR fn_es_operativo_en(NEW.iglesia_id) OR fn_es_pastor_en(NEW.iglesia_id) OR fn_es_lider_de_red_en_iglesia(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor, Supervisor o Lider de Red en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- Con el bypass de soft-delete restaurado, "Remover cargo"/reactivar
-- (fn_toggle_usuario_rol) ya NO pasa por el trigger para validar nada --
-- por eso el gate "solo el principal puede tocar a otro Super Admin" tiene
-- que quedar explicito aqui tambien, no solo en el trigger (que sigue
-- cubriendo crear/editar, donde si cambia rol/iglesia_id).
CREATE OR REPLACE FUNCTION fn_toggle_usuario_rol(p_usuario_rol_id UUID, p_activo BOOLEAN, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_usuario_objetivo UUID;
  v_rol_objetivo rol_sistema_enum;
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'USUARIO_SOLO_SUPER_ADMIN: solo un Super Admin puede suspender, reactivar o remover cargos'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT usuario_id, rol INTO v_usuario_objetivo, v_rol_objetivo
  FROM usuario_rol WHERE id = p_usuario_rol_id;

  IF v_usuario_objetivo IS NULL THEN
    RAISE EXCEPTION 'USUARIO_ROL_NO_ENCONTRADO: la asignacion % no existe', p_usuario_rol_id
      USING ERRCODE = 'P0001';
  END IF;
  IF v_usuario_objetivo = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOMODIFICACION: no podes suspender ni remover tu propio cargo'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_rol_objetivo = 'SUPER_ADMIN' AND NOT fn_es_super_admin_principal() THEN
    RAISE EXCEPTION 'SUPER_ADMIN_SOLO_PRINCIPAL: solo el Super Admin principal puede suspender, reactivar o remover a otro Super Admin'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_rol_objetivo = 'SUPER_ADMIN' AND NOT p_activo THEN
    IF (SELECT count(*) FROM usuario_rol WHERE rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL) <= 1 THEN
      RAISE EXCEPTION 'ULTIMO_SUPER_ADMIN: no se puede suspender ni remover al unico Super Admin del sistema'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- Mismo limite que fn_actualizar_usuario_rol: Red/CdP se gestionan desde
  -- Casas de Paz, no desde Administracion.
  IF v_rol_objetivo IN ('LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP') THEN
    RAISE EXCEPTION 'USUARIO_FUERA_DE_ALCANCE: los cargos de Red y Casa de Paz se gestionan desde Casas de Paz, no desde Administracion'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  UPDATE usuario_rol
  SET fecha_eliminacion = CASE WHEN p_activo THEN NULL ELSE now() END,
      eliminado_por = CASE WHEN p_activo THEN NULL ELSE auth.uid() END
  WHERE id = p_usuario_rol_id;
END;
$$;
