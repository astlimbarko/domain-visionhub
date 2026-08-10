-- VisionHub -- super_admin_puede_ser_operativo
-- Correccion del owner (2026-08-09): la regla ROL_SUPER_ADMIN_NO_OPERATIVO
-- ("un Super Admin no puede tener roles operativos; se necesita una cuenta
-- separada") era incorrecta -- en la practica ya existen cuentas reales que
-- son Super Admin Y tienen un cargo operativo a la vez (ej. los 3
-- supervisores de Centro de Vida Montero, todos tambien Super Admin), y el
-- owner confirmo explicitamente que eso es valido: "El superadmin si puede
-- tener roles operativos".
--
-- Se quita por completo esa validacion de fn_validar_asignacion_rol. El
-- resto de la funcion (jerarquia de quien puede asignar que rol, la
-- excepcion de remocion/soft-delete agregada hoy en 20260809050000, y la
-- paridad Pastor agregada hoy en 20260809080000) queda igual.
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
