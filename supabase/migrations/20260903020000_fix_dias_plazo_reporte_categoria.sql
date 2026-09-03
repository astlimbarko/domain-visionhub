-- VisionHub -- fn_config_formulario(iglesia_id, 'FORMULARIO_REPORTE') arma un
-- jsonb_object_agg llamando fn_config_bool() sobre TODAS las filas de
-- configuracion_definicion con categoria='FORMULARIO_REPORTE'. DIAS_PLAZO_REPORTE
-- (el plazo de gracia en dias de Control de Reportes, un NUMERO, valor_defecto
-- '2') quedo con esa misma categoria por error -- fn_config_bool intenta
-- '2'::boolean y revienta con "invalid input syntax for type boolean: 2",
-- lo que hace fallar la funcion COMPLETA para cualquier iglesia, siempre.
-- Consecuencia real: el frontend nunca pudo cargar `campos` (obtenerCamposObligatorios,
-- Reportes.tsx) -- ni la seccion "Evangelismo" (campos?.REPORTE_SALIO_EVANGELIZAR_VISIBLE)
-- ni ninguno de los "obligatorio" (tema/disertador/testimonios/comentarios)
-- se activaron nunca en el formulario de reporte de CdP, en ninguna iglesia.
-- fn_criterio (usado para leer el valor real de DIAS_PLAZO_REPORTE) usa
-- fn_config_num y no depende de la categoria, asi que el valor en si nunca
-- estuvo mal -- solo la categoria lo mezclaba donde no correspondia. Mismo
-- patron ya usado para otro criterio numerico (EDAD_MINIMA_CREYENTE vive en
-- categoria SSVA, no en un grupo de booleanos).

UPDATE configuracion_definicion
SET categoria = 'CONTROL_REPORTES'
WHERE codigo = 'DIAS_PLAZO_REPORTE';
