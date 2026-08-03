-- 96: revocar EXECUTE de PUBLIC/anon en todas las funciones fn_* excepto las
-- dos que el formulario publico de registro (registro-publico.service.ts)
-- necesita antes de iniciar sesion.
--
-- Motivo: por default de Postgres, toda funcion nueva queda ejecutable por
-- PUBLIC (incluye anon) salvo que se revoque explicitamente -- nunca se hizo.
-- Verificado en el codigo real (frontend/src/services/*.ts y
-- supabase/functions/*): el 100% de las llamadas .rpc() se hacen con sesion
-- ya iniciada (rol authenticated), excepto fn_resolver_url_registro y
-- fn_registrar_persona_via_url (formulario publico por URL, sin login a
-- proposito). El chequeo interno (auth.uid()/fn_es_super_admin()/etc.) ya
-- bloqueaba esto en la practica, pero un usuario sin sesion no deberia poder
-- ni intentar llamar a estas funciones -- esto agrega esa segunda capa.
--
-- No afecta a usuarios logueados: authenticated (y service_role, por las
-- dudas) se vuelven a otorgar explicitamente a todas, sin excepcion --
-- incluidas las funciones de apoyo que usan las politicas RLS
-- (fn_mis_iglesias, fn_es_super_admin, etc.), asi que ninguna consulta
-- normal se rompe.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname AS nombre, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'fn_%'
      AND p.proname NOT IN ('fn_resolver_url_registro', 'fn_registrar_persona_via_url')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC;', r.nombre, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon;', r.nombre, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated;', r.nombre, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role;', r.nombre, r.args);
  END LOOP;
END $$;
