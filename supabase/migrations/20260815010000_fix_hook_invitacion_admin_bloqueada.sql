-- VisionHub -- fix hook_restringir_alta_no_google (KAN-201)
-- Bug real 2026-08-15: el "salvavidas" que dejaba pasar las invitaciones de
-- admin (auth.admin.inviteUserByEmail) nunca funcionaba en la practica.
-- Consultaba `auth.users` buscando una fila con `invited_at` ya seteado,
-- pero el hook "Before User Created" se dispara ANTES de que esa fila
-- exista -- para cualquier correo nuevo invitado por un admin (Casa de
-- Paz, Red, invitar-usuario, crear-iglesia), la consulta siempre daba
-- vacio y el hook rechazaba la creacion con "El registro publico por
-- correo y contrasena esta cerrado...", aunque la invitacion viniera de
-- un admin real. Confirmado en vivo (KAN-200/201): invitar sublider por
-- correo a una cuenta nueva devolvia 500 con ese mensaje.
--
-- Fix: en vez de re-consultar una fila que todavia no existe, se manda
-- una marca explicita (`invitado_por_admin: true`) en el `data` que ya
-- reciben las 4 edge functions que invitan por correo -- eso llega
-- disponible en `event.user.user_metadata` dentro del propio payload del
-- hook (confirmado: es el mismo mecanismo que ya usa `datosInvitacionParaCorreo`
-- para llenar la plantilla de correo con iglesia_nombre/rol_etiqueta), sin
-- depender de una consulta a una fila en proceso de creacion.
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

  -- Fix real: la marca va en el mismo payload que crea el hook, no en una
  -- fila de auth.users que todavia no existe a esta altura.
  IF (event -> 'user' -> 'user_metadata' ->> 'invitado_por_admin') = 'true' THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Salvavidas viejo, se deja como red de seguridad extra (no hace nada
  -- malo si nunca se cumple, y cubre el caso de un reintento donde la fila
  -- ya quedo creada de una invitacion anterior).
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
