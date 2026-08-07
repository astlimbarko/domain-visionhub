-- VisionHub -- 108_control_reportes_plazo_configurable.sql
-- KAN-31: el estado verde/naranja de Control de Reportes (a tiempo vs. con
-- retraso) se calculaba 100% en el cliente, con un plazo de gracia fijo
-- (DIAS_PLAZO_REPORTE = 2 en ControlReportesVista.tsx) y sin considerar la
-- zona horaria de la iglesia -- comparaba contra new Date() del navegador.
--
-- 1) El plazo pasa al motor de configuracion ya existente (fn_criterio,
--    06_configuracion.sql) como cualquier otro criterio -- configurable por
--    iglesia, con el mismo default de 2 dias que ya regia.
-- 2) v_reporte_totales agrega una columna "estado_carga" (VERDE/NARANJA)
--    calculada en el servidor, unica fuente de verdad -- el frontend deja de
--    reimplementar la resta de fechas. Se usa 'America/La_Paz' explicito
--    (todas las iglesias de este sistema operan en esa zona hoy; si el
--    proyecto llega a soportar iglesias en otro huso, esto pasa a una
--    columna propia en `iglesia`).
--
-- La deteccion de reportes NO entregados (rojo/pendiente, semanas sin fila
-- en absoluto) sigue en el frontend: compara la fecha esperada contra el
-- momento actual, algo que no tiene una "verdad" distinta segun donde se
-- calcule. Alertar de forma realmente proactiva (sin depender de que alguien
-- abra la pantalla) requeriria un job programado (pg_cron / edge function) --
-- fuera del alcance de esta sesion, sin acceso al CLI de Supabase para
-- desplegarlo.
--
-- NO aplicada contra la base real (sin CLI de Supabase disponible en esta
-- sesion) -- pendiente de aplicar, igual que 100/101/107.

INSERT INTO configuracion_definicion (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, modulo, orden)
VALUES (
  'DIAS_PLAZO_REPORTE',
  'Dias de gracia para el reporte semanal',
  'Dias desde la fecha de la reunion dentro de los cuales un reporte cargado se considera "a tiempo" (verde) en vez de "con retraso" (naranja) en Control de Reportes.',
  'NUMERICO', '2', 0, 30, 'dias', 'FORMULARIO_REPORTE', 1, 41
)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, tipo = EXCLUDED.tipo,
  valor_defecto = EXCLUDED.valor_defecto, valor_min = EXCLUDED.valor_min, valor_max = EXCLUDED.valor_max,
  unidad = EXCLUDED.unidad, categoria = EXCLUDED.categoria, modulo = EXCLUDED.modulo, orden = EXCLUDED.orden;

CREATE OR REPLACE VIEW v_reporte_totales AS
SELECT
  reporte_id,
  casa_de_paz_id,
  fecha_reunion,
  count(asistencia_id) FILTER (WHERE es_menor) AS total_menores,
  count(asistencia_id) FILTER (WHERE NOT es_menor) AS total_mayores,
  count(asistencia_id) AS total_asistentes,
  count(asistencia_id) FILTER (WHERE es_visita) AS total_visitas,
  fecha_creacion,
  estado_carga
FROM (
  SELECT
    r.id AS reporte_id,
    r.casa_de_paz_id,
    r.fecha_reunion,
    r.fecha_creacion,
    a.id AS asistencia_id,
    a.es_visita,
    CASE
      WHEN p.fecha_nacimiento IS NOT NULL
        THEN EXTRACT(YEAR FROM age(r.fecha_reunion, p.fecha_nacimiento)) < fn_criterio(r.iglesia_id, 'EDAD_MINIMA_CREYENTE')
      ELSE a.es_menor
    END AS es_menor,
    CASE
      WHEN ((r.fecha_creacion AT TIME ZONE 'America/La_Paz')::date - r.fecha_reunion) <= fn_criterio(r.iglesia_id, 'DIAS_PLAZO_REPORTE')
        THEN 'VERDE' ELSE 'NARANJA'
    END AS estado_carga
  FROM casa_de_paz_reporte r
  LEFT JOIN casa_de_paz_asistencia a ON a.reporte_id = r.id AND a.fecha_eliminacion IS NULL
  LEFT JOIN persona p ON p.id = a.persona_id
  WHERE r.fecha_eliminacion IS NULL
) base
GROUP BY reporte_id, casa_de_paz_id, fecha_reunion, fecha_creacion, estado_carga;
