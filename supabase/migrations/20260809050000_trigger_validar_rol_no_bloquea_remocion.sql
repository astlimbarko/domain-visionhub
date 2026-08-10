-- VisionHub -- trigger_validar_rol_no_bloquea_remocion
-- Bug real (reportado 2026-08-09): "Quitar cargo" fallaba con
-- ROL_SUPER_ADMIN_NO_OPERATIVO (o incluso ROL_AUTOASIGNACION) para
-- cualquier persona que fuera Super Admin y tuviera ademas un cargo
-- operativo heredado (ej. los 3 supervisores de Centro de Vida Montero,
-- los tres tambien Super Admin).
--
-- Causa: trg_validar_rol corre en BEFORE INSERT OR UPDATE sin distinguir
-- una remocion (soft-delete: solo se setea fecha_eliminacion) de una
-- asignacion nueva -- las funciones fn_estructura_quitar_pastor/
-- fn_estructura_quitar_supervisor hacen exactamente eso (UPDATE ...
-- SET fecha_eliminacion = now()), y el trigger volvia a exigir "quien puede
-- ASIGNAR este rol" sobre una fila que en realidad se esta desactivando.
--
-- Fix: si la fila pasa de vigente (fecha_eliminacion NULL) a no vigente
-- (fecha_eliminacion seteada) y ningun otro campo relevante cambia, no
-- corresponde re-validar reglas de asignacion -- las funciones que quitan
-- cargos ya validan el permiso de quien ejecuta la accion en su propio
-- nivel (fn_estructura_puede_administrar, fn_es_super_admin, etc).
CREATE OR REPLACE FUNCTION public.fn_validar_asignacion_rol()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  IF NEW.rol = 'SUPER_ADMIN' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede crear otro SUPER_ADMIN'
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

  IF NEW.rol = 'LIDER_RED' AND NOT (fn_es_super_admin() OR fn_es_operativo_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_CDP', 'SUBLIDER_CDP')
     AND NOT (fn_es_super_admin() OR fn_es_operativo_en(NEW.iglesia_id) OR fn_es_lider_de_red_en_iglesia(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor, Supervisor o Lider de Red en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('PASTOR', 'SUPERVISOR_VISION_ACCION', 'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP')
     AND EXISTS (SELECT 1 FROM usuario_rol WHERE usuario_id = NEW.usuario_id AND rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'ROL_SUPER_ADMIN_NO_OPERATIVO: un Super Admin no puede tener roles operativos; se necesita una cuenta separada' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
