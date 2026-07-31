-- Quita la restriccion "un Super Admin no puede tener roles operativos".
-- Decision explicita del owner (2026-07-31): la regla no debe existir para
-- nadie -- si a una cuenta se le asigna un rol y ya tiene otro, simplemente
-- tendra 2 roles (el picker multi-rol resuelve la ambiguedad en el front).
CREATE OR REPLACE FUNCTION public.fn_validar_asignacion_rol()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT (fn_es_super_admin() OR fn_es_pastor_en(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Super Admin o Pastor de la iglesia % para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_RED', 'LIDER_CDP') AND NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUBLIDER_CDP'
     AND NOT (fn_es_operativo_en(NEW.iglesia_id) OR fn_es_lider_de_red_en_iglesia(NEW.iglesia_id) OR fn_es_lider_cdp_en_iglesia(NEW.iglesia_id)) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor, Supervisor, Lider de Red o Lider de CdP en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
