-- VisionHub -- KAN-251, punto 2/4 (2026-09-17): mismo relajo que el punto 1
-- (fn_validar_cdp_cargo) pero para usuario_rol -- este es el bloqueo real
-- del caso concreto que disparó el ticket (Pastor de la iglesia madre
-- intentando asignar Supervisor de la Visión en Acción en su satélite).
--
-- fn_son_madre_satelite_vigente ya existe (migración 20260917130000).
--
-- Se relajan 4 puntos de fn_validar_asignacion_rol, cada uno permitiendo
-- que el chequeo de permiso del que asigna también se cumpla si tiene ese
-- mismo permiso en el par madre<->satélite VIGENTE de NEW.iglesia_id (no
-- en cualquier iglesia con padre -- solo si sigue siendo SATELITE, se
-- corta solo al graduar a Hija vía KAN-387, sin tocar este código de
-- nuevo):
--   1. SUPERVISOR_VISION_ACCION -- Pastor de la iglesia o de su par.
--   2. LIDER_RED -- Pastor/Supervisor de la iglesia o de su par.
--   3. LIDER_CDP/SUBLIDER_CDP -- Pastor/Supervisor/Líder de Red de la
--      iglesia o de su par.
--   4. El chequeo final ROL_FUERA_DE_ALCANCE (NEW.iglesia_id debe estar en
--      fn_mis_iglesias() del que asigna) -- sin esto, ninguno de los 3
--      relajos de arriba sirve en la práctica: el Pastor de la madre no
--      tiene a la satélite en su propio fn_mis_iglesias() (eso no se toca,
--      a propósito, ver KAN-251 en Jira -- ampliar fn_mis_iglesias() le
--      daría acceso a TODO lo demás de la satélite sin que nadie lo
--      pidiera), así que este chequeo puntual también necesita su propio
--      escape para el caso madre<->satélite.
--
-- NO se toca: PASTOR (solo Super Admin), SUPER_ADMIN, autoasignación,
-- fn_mis_iglesias() en sí misma.

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

  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT (
    fn_es_super_admin() OR fn_es_pastor_en(NEW.iglesia_id)
    OR EXISTS (SELECT 1 FROM iglesia x WHERE fn_son_madre_satelite_vigente(NEW.iglesia_id, x.id) AND fn_es_pastor_en(x.id))
  ) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser PASTOR de la iglesia % para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'LIDER_RED' AND NOT (
    fn_es_super_admin() OR fn_es_operativo_en(NEW.iglesia_id) OR fn_es_pastor_en(NEW.iglesia_id)
    OR EXISTS (SELECT 1 FROM iglesia x WHERE fn_son_madre_satelite_vigente(NEW.iglesia_id, x.id)
                 AND (fn_es_operativo_en(x.id) OR fn_es_pastor_en(x.id)))
  ) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_CDP', 'SUBLIDER_CDP') AND NOT (
    fn_es_super_admin() OR fn_es_operativo_en(NEW.iglesia_id) OR fn_es_pastor_en(NEW.iglesia_id) OR fn_es_lider_de_red_en_iglesia(NEW.iglesia_id)
    OR EXISTS (SELECT 1 FROM iglesia x WHERE fn_son_madre_satelite_vigente(NEW.iglesia_id, x.id)
                 AND (fn_es_operativo_en(x.id) OR fn_es_pastor_en(x.id) OR fn_es_lider_de_red_en_iglesia(x.id)))
  ) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor, Supervisor o Lider de Red en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias())
     AND NOT EXISTS (
       SELECT 1 FROM iglesia x
       WHERE fn_son_madre_satelite_vigente(NEW.iglesia_id, x.id) AND x.id IN (SELECT fn_mis_iglesias())
     ) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
