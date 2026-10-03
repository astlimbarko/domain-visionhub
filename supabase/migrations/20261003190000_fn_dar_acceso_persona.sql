-- KAN (2026-10-03): "Dar acceso" a una persona que YA existe en el sistema
-- (ej. sublíder/líder asignado como persona existente, sin cuenta). El problema
-- de fondo: asignar un cargo a una persona existente no le crea cuenta, y el
-- flujo de invitación por correo crea una invitación/persona NUEVA (duplicado).
-- Esta RPC vincula una cuenta auth YA creada (por la edge function) a la persona
-- existente POR persona_id -- sin crear otra persona -- y le asegura el
-- usuario_rol de sus cargos vigentes. La creación de la cuenta auth (con
-- contraseña 12345678 + debe_cambiar_contrasena) la hace la edge function
-- dar-acceso-persona (admin API); acá solo se vincula y se dan los roles.

CREATE OR REPLACE FUNCTION public.fn_dar_acceso_persona(p_persona_id uuid, p_usuario_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iglesia_id uuid;
  v_ya_vinc    uuid;
  r            record;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = p_persona_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'PERSONA_INVALIDA: la persona no existe' USING ERRCODE = 'P0001';
  END IF;

  -- Permiso: quien da acceso debe poder gestionar esa iglesia.
  IF NOT (fn_es_super_admin() OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'ACCESO_SIN_PERMISO: se requiere ser Pastor, Supervisor o Super Admin de la iglesia' USING ERRCODE = 'P0001';
  END IF;

  -- La persona no debe tener ya una cuenta vinculada.
  IF EXISTS (SELECT 1 FROM persona WHERE id = p_persona_id AND usuario_id IS NOT NULL) THEN
    RAISE EXCEPTION 'PERSONA_YA_TIENE_CUENTA: esta persona ya tiene una cuenta de acceso' USING ERRCODE = 'P0001';
  END IF;

  -- La cuenta no debe estar ya vinculada a OTRA persona (evita duplicado inverso).
  SELECT id INTO v_ya_vinc FROM persona WHERE usuario_id = p_usuario_id AND fecha_eliminacion IS NULL LIMIT 1;
  IF v_ya_vinc IS NOT NULL AND v_ya_vinc <> p_persona_id THEN
    RAISE EXCEPTION 'CUENTA_YA_VINCULADA: esa cuenta ya pertenece a otra persona' USING ERRCODE = 'P0001';
  END IF;

  -- Vincular la cuenta a ESTA persona (sin crear otra).
  UPDATE persona SET usuario_id = p_usuario_id WHERE id = p_persona_id;

  -- Asegurar usuario_rol para los cargos vigentes que son roles del sistema.
  FOR r IN
    SELECT cc.iglesia_id, c.codigo
    FROM casa_de_paz_cargo cc JOIN cargo c ON c.id = cc.cargo_id
    WHERE cc.persona_id = p_persona_id AND c.codigo IN ('LIDER_CDP','SUBLIDER_CDP')
      AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    UNION
    SELECT rc.iglesia_id, c.codigo
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.persona_id = p_persona_id AND c.codigo IN ('LIDER_RED','SUBLIDER_RED')
      AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
  LOOP
    PERFORM private.fn_asegurar_usuario_rol_por_cargo(p_persona_id, r.iglesia_id, r.codigo::rol_sistema_enum);
  END LOOP;

  RETURN jsonb_build_object('persona_id', p_persona_id, 'usuario_id', p_usuario_id, 'vinculada', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_dar_acceso_persona(uuid, uuid) TO authenticated;
