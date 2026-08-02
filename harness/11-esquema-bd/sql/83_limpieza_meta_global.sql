-- VisionHub -- 83_limpieza_meta_global.sql
-- El owner aclaro (2026-08-02) que "Meta Global de la Red" no es un valor
-- independiente que se tipea a mano -- es la suma de las metas ya asignadas
-- a cada CdP (fn_tasa_evangelismo_red.meta_total, ya existente). La funcion
-- fn_meta_global_red (81_meta_global_red.sql) quedo sin ningun caller en el
-- frontend; se elimina para no dejar codigo muerto.
--
-- Se deja intacta la extension de esquema de esa misma migracion
-- (meta_evangelismo_asignada.red_id, casa_de_paz_id nullable, la exclusion
-- de solapamiento para red_id, y la policy de insert bifurcada): sigue
-- siendo la extension de ambito que 99-modulos-futuros.md ya documentaba
-- como pendiente del Modulo 2, y no tiene costo dejarla sin usar todavia.

DROP FUNCTION IF EXISTS fn_meta_global_red(UUID);
