-- VisionHub -- 20_permisos_explicitos.sql
-- Hallazgo de 13-registro-publico-cdp (2026-07-18): ninguna de las migraciones
-- 00-19 tiene un GRANT/REVOKE de tabla explicito para anon/authenticated, salvo
-- el REVOKE DELETE de 02_funciones_base.sql. El aislamiento de anon depende hoy
-- de lo que Supabase otorgo por defecto al crear el proyecto, no de un permiso
-- versionado en este repositorio. RLS ya es la barrera real y funciona (16/16
-- pruebas curl), pero "funciona porque el proyecto trae X de fabrica" no es
-- reproducible si el esquema se reaplica desde cero en un proyecto nuevo, y no
-- es defensa en profundidad: si una politica RLS futura tuviera un hueco, el
-- unico piso de abajo hoy es un permiso que nadie declaro a proposito.
--
-- Este archivo NO cambia RLS, NO toca datos, NO altera ninguna tabla. Es
-- puramente GRANT/REVOKE, idempotente (se puede correr de nuevo sin efecto
-- distinto) y va AL FINAL de la cadena porque exige que toda tabla ya exista.
--
-- Efecto esperado en un proyecto donde "authenticated" ya podia leer/escribir
-- (via default de Supabase): ninguno, se vuelve explicito lo que ya pasaba.
-- Efecto esperado en "anon": si el proyecto le habia dado privilegios de tabla
-- por defecto, se cierran. anon sigue pudiendo llamar a las dos funciones
-- SECURITY DEFINER de 13-registro-publico-cdp: una funcion SECURITY DEFINER
-- corre con los privilegios de quien la definio, no con los del que la llama,
-- asi que revocar el acceso directo a la tabla no le quita esa puerta.

-- ============================================================
-- anon: cero acceso directo a datos de negocio (01-tenancy Req 4.6)
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- La unica puerta de anon: las dos funciones publicas de 13-registro-publico-cdp.
-- Se re-otorga aca por si el REVOKE ALL FUNCTIONS de arriba alcanzo a estas dos
-- (el orden de ejecucion entre archivos ya las habia otorgado en 19, pero este
-- archivo debe quedar correcto por si mismo si algun dia se re-corre solo).
GRANT EXECUTE ON FUNCTION fn_resolver_url_registro(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION fn_registrar_persona_via_url(VARCHAR, JSONB) TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================================
-- authenticated: SELECT/INSERT/UPDATE explicito. Sin DELETE (ya revocado en
-- 02_funciones_base.sql) y sin TRUNCATE/REFERENCES/TRIGGER, que nunca hicieron
-- falta. RLS sigue siendo quien decide fila por fila; esto solo asegura que el
-- permiso de tabla no dependa de un default ambiental.
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- DELETE se mantiene revocado para ambos roles hacia adelante tambien en
-- privilegios por defecto (ya lo hace 02_funciones_base.sql para las tablas
-- existentes al momento en que corrio; esto lo deja fijado para las tablas
-- creadas de aqui en mas, sin depender del orden de ejecucion).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE DELETE ON TABLES FROM anon, authenticated;

-- ============================================================
-- Verificacion (correr despues, no es parte del cambio): cero filas esperadas.
-- ============================================================
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND grantee = 'anon';
