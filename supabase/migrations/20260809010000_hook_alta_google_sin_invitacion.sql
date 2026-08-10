-- VisionHub -- hook_alta_google_sin_invitacion
-- KAN-138: decision del owner (Gonzalo, 2026-08-09) -- cualquier persona debe
-- poder registrarse con Google sin invitacion previa (queda sin rol hasta
-- que un admin se lo asigne). El registro publico por email/contraseña
-- sigue cerrado (43_pastor_no_operativo... no, ver 2026-07-30, enable_signup
-- = false a nivel proyecto).
--
-- Para lograr esto sin reabrir el alta por email hace falta:
--   1. `enable_signup = true` a nivel proyecto (Dashboard -- Auth Hooks solo
--      pueden RESTRINGIR un alta ya permitida, no pueden reabrir una
--      cerrada por enable_signup=false; confirmado por como esta descripto
--      el hook en la doc de Supabase, pensado para agregar restricciones
--      sobre un alta abierta, no para levantar una cerrada).
--   2. Este hook "Before User Created", que RECHAZA cualquier alta que no
--      sea Google -- asi el email/contraseña sigue cerrado en la practica
--      aunque el flag global diga "true".
--
-- Seguridad para no romper las invitaciones existentes (admin.inviteUserByEmail):
-- ese alta es privilegiada (service_role) y en teoria no dispara este hook
-- (esta pensado para las rutas publicas: signUp, OAuth, OTP) -- pero por las
-- dudas se agrega una excepcion explicita: si el email ya tiene una fila en
-- auth.users con invited_at seteado, se permite igual.
CREATE OR REPLACE FUNCTION public.hook_restringir_alta_no_google(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider text;
  v_email text;
BEGIN
  v_provider := event -> 'user' -> 'app_metadata' ->> 'provider';
  v_email := event -> 'user' ->> 'email';

  IF v_provider = 'google' THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Salvavidas: si el correo ya fue invitado por un admin, no bloquear --
  -- esto no deberia dispararse nunca en la practica (las invitaciones ya
  -- crean la fila de auth.users al momento de invitar, antes de que la
  -- persona intente loguearse), pero cuesta cero dejarlo como red de
  -- seguridad explicita.
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.email = v_email AND u.invited_at IS NOT NULL
  ) THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'El registro público por correo y contraseña está cerrado. Iniciá sesión con Google o pedile a un administrador que te invite.',
      'http_code', 403
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hook_restringir_alta_no_google(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_restringir_alta_no_google(jsonb) TO supabase_auth_admin;
