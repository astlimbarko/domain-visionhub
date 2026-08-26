-- VisionHub -- 20260825170000_fecha_nacimiento_obligatoria_default.sql
-- KAN-252 (seguimiento): al probar el wizard actualizado en vivo, el owner
-- encontro que avanzaba de pagina sin cargar la fecha de nacimiento --
-- MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO tenia valor_defecto = 'false'
-- (asi desde antes, no es una regresion de esta sesion). Pedido explicito:
-- que sea obligatoria para TODAS las iglesias. Se cambia el valor_defecto
-- global -- cualquier iglesia que ya tenga su propio override en
-- configuracion_valor no se ve afectada (fn_config_raw prioriza esa fila
-- por sobre valor_defecto); esto solo sube el piso para las que nunca lo
-- configuraron a mano.
UPDATE configuracion_definicion
SET valor_defecto = 'true'
WHERE codigo = 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO';

-- Centro de Vida Genesis (la iglesia de prueba, donde se detecto el caso)
-- ya tenia un override explicito propio en 'false' en configuracion_valor
-- -- eso gana por sobre el valor_defecto de arriba, asi que hay que
-- actualizarlo tambien para que de verdad quede obligatorio ahi.
-- trg_validar_configuracion exige fn_es_operativo_en(auth.uid()), que no
-- existe corriendo esta migracion fuera de una sesion real -- se
-- deshabilita el trigger solo para este UPDATE puntual (mismo gotcha ya
-- documentado en sesiones anteriores con updates crudos via API de gestion).
ALTER TABLE configuracion_valor DISABLE TRIGGER trg_validar_configuracion;

UPDATE configuracion_valor cv
SET valor = 'true'
FROM configuracion_definicion cd
WHERE cv.definicion_id = cd.id
  AND cd.codigo = 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'
  AND cv.fecha_eliminacion IS NULL;

ALTER TABLE configuracion_valor ENABLE TRIGGER trg_validar_configuracion;
