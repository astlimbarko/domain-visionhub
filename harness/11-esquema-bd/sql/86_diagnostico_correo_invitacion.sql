-- VisionHub -- 86_diagnostico_correo_invitacion.sql
-- Bug real encontrado 2026-08-02: al invitar a alguien que ya tiene cuenta
-- de auth.users pero SIN persona vinculada (típico de una cuenta de prueba
-- vieja que nunca completó el alta), invitar-lider/invitar-usuario
-- devuelven el mismo 409 de siempre ("ya existe una cuenta, asignale el
-- cargo buscándola por nombre") -- un callejón sin salida, porque no hay
-- ninguna Persona que buscar por nombre. El admin queda sin poder avanzar
-- ni saber por qué. Esta función permite a los edge functions distinguir
-- ese caso y devolver un mensaje que sí explica qué pasa.
CREATE OR REPLACE FUNCTION fn_correo_tiene_persona(p_correo TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN persona p ON p.usuario_id = u.id AND p.fecha_eliminacion IS NULL
    WHERE lower(u.email) = lower(p_correo)
  );
$$;

GRANT EXECUTE ON FUNCTION fn_correo_tiene_persona(TEXT) TO authenticated;
