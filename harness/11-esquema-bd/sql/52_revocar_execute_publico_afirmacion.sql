-- VisionHub -- 52_revocar_execute_publico_afirmacion.sql
-- 14-afirmacion. Hallazgo real durante la verificacion: `20_permisos_explicitos.sql`
-- hace `ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON FUNCTIONS FROM anon`, pero
-- eso solo cambia el privilegio por defecto dirigido al rol `anon`
-- especificamente. El default de fabrica de Postgres ("EXECUTE a PUBLIC" en
-- toda funcion nueva) sigue vigente aparte, y `anon` hereda PUBLIC. Efecto
-- real observado: una llamada anonima a fn_listar_lideres_cdp_afirmacion
-- llego a ejecutarse (bloqueada igual por el chequeo interno
-- fn_es_lider_afirmacion_en, sin fuga de datos), en vez de recibir
-- "permission denied for function" a nivel de Postgres.
--
-- Esto es un hueco estructural que probablemente aplica a TODA funcion
-- creada despues de 20_ (no solo las de esta sesion) -- no se corrige aqui
-- para el resto del esquema (fuera de alcance, y en paralelo con otro
-- desarrollador). Se revoca de forma quirurgica solo para los objetos
-- creados en 46-50 de esta sesion; `authenticated` conserva acceso via su
-- GRANT explicito (20_permisos_explicitos.sql:52,56), que es independiente
-- de PUBLIC.
REVOKE EXECUTE ON FUNCTION fn_validar_departamento_cargo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_es_lider_departamento(UUID, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_es_lider_afirmacion_en(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_listar_lideres_cdp_afirmacion(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_registrar_persona_afirmacion(JSONB, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_listar_casa_paz_url_afirmacion(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_set_estado_casa_paz_url(UUID[], estado_url_enum) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_mis_iglesias_detalle() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fn_es_lider_departamento(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_es_lider_afirmacion_en(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_listar_lideres_cdp_afirmacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_persona_afirmacion(JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_listar_casa_paz_url_afirmacion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_set_estado_casa_paz_url(UUID[], estado_url_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_mis_iglesias_detalle() TO authenticated;
