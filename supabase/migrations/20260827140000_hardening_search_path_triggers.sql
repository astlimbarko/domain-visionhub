-- VisionHub -- hardening de search_path en triggers (misma clase de bug que KAN-272).
--
-- Auditoría 2026-08-27: además de fn_iglesia_sin_ciclo (KAN-272), hay 7 funciones
-- de trigger BEFORE que referencian tablas sin calificar (sin "public.") y NO fijan
-- su propio search_path. Mientras se disparen desde el cliente (search_path de sesión
-- = public) funcionan; pero al dispararse desde una función SECURITY DEFINER con
-- SET search_path = '' (todo el módulo del Constructor: fn_estructura_*), heredan el
-- search_path vacío y fallan con relation "X" does not exist.
--
-- Confirmado ACTIVO en vivo: desactivar una Casa de Paz (fn_estructura_eliminar_casa_de_paz
-- y fn_estructura_ejecutar_borrados_programados hacen UPDATE casa_de_paz SET activo=false
-- con search_path='') dispara fn_cdp_desactivacion_cierra_membresias ->
-- "relation \"casa_de_paz_membresia\" does not exist". El resto son alcanzables por el
-- mismo camino (eliminar/fusionar Red, cascada de ingresos, moneda por defecto, etc.).
--
-- Fix mínimo y sin cambio de lógica: ALTER FUNCTION ... SET search_path = public
-- (no se toca el cuerpo). Deja cada trigger inmune al search_path del contexto que lo
-- dispara, igual que el resto de funciones del esquema base (fn_auditoria, fn_mis_iglesias,
-- etc. ya usan search_path = public).

ALTER FUNCTION public.fn_cdp_desactivacion_cierra_membresias() SET search_path = public;
ALTER FUNCTION public.fn_reporte_cascada_ingresos()          SET search_path = public;
ALTER FUNCTION public.fn_validar_tema_libro()                SET search_path = public;
ALTER FUNCTION public.fn_ingreso_moneda_defecto()            SET search_path = public;
ALTER FUNCTION public.fn_limpiar_apellido_casada()           SET search_path = public;
ALTER FUNCTION public.fn_validar_estado_activo()             SET search_path = public;
ALTER FUNCTION public.fn_validar_red_desactivacion()         SET search_path = public;
