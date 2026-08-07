-- VisionHub -- 110_fix_overload_fn_eliminar_cdp.sql
-- 109_historico_cdp_eliminadas.sql agregó un parámetro (p_motivo) a
-- fn_eliminar_cdp con CREATE OR REPLACE -- pero al cambiar la firma
-- (UUID) -> (UUID, TEXT), Postgres no reemplazó la función original: creó
-- un segundo overload, dejando fn_eliminar_cdp(uuid) viejo sin uso al lado
-- del nuevo fn_eliminar_cdp(uuid, text). A diferencia del overload viejo de
-- fn_buscar_personas (aplicado a mano en algún momento sin migración que lo
-- respalde, por eso no se tocó), acá el origen es 100% conocido -- se
-- elimina el overload viejo para no dejar dos firmas de la misma acción.

DROP FUNCTION IF EXISTS fn_eliminar_cdp(UUID);
