-- VisionHub -- limpieza: los criterios AUSENCIAS_NC_SIMPATIZANTE y
-- ASISTENCIAS_RETORNO_CREYENTE (20260906040000) quedaron reemplazados por
-- la reutilización de VISITAS_PARA_CRE (20260907020000) -- se dan de baja
-- lógica para que no queden huérfanos y confundan en Panel de Supervisor.
-- Solo si nadie los personalizó todavía (no debería, se acaban de crear).

update configuracion_definicion
set fecha_eliminacion = now()
where codigo in ('AUSENCIAS_NC_SIMPATIZANTE', 'ASISTENCIAS_RETORNO_CREYENTE')
  and fecha_eliminacion is null
  and not exists (select 1 from configuracion_valor cv where cv.definicion_id = configuracion_definicion.id);
