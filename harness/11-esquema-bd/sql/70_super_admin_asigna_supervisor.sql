-- VisionHub -- 70_super_admin_asigna_supervisor.sql
-- Bug real encontrado 2026-08-01 (probado en vivo): "Agregar usuario" ya
-- ofrece "Supervisor de Vision en Accion" como cargo asignable por Super
-- Admin (coherente con la decision "acotar Super Admin" -- gestiona
-- SUPER_ADMIN/PASTOR/SUPERVISOR_VISION_ACCION), pero
-- fn_validar_asignacion_rol solo permitia el INSERT si quien llamaba ya era
-- PASTOR de esa iglesia -- nunca dejaba pasar a un Super Admin. Quedaba
-- oculto detras del bug del doble PIN (69_): el flujo siempre fallaba antes
-- de llegar a este trigger. Al corregir el PIN, este quedo expuesto.
--
-- Mismo patron ya usado para LIDER_RED (fn_es_operativo_en, que incluye
-- Pastor y Supervisor): agregamos Super Admin como alternativa valida,
-- igual que ya se hizo en fn_puede_invitar/fn_crear_usuario_rol/
-- fn_listar_usuarios (63_pastor_gestion_supervisor.sql) para el otro
-- sentido (Pastor asignando Supervisor).

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
