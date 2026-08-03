-- VisionHub -- 94_fix_n1_vista_reporte_totales.sql
-- Hallazgo de la auditoria de rendimiento (2026-08-03, KAN-64): v_reporte_totales
-- llamaba a fn_asistencia_es_menor(a.id) DOS veces por cada fila de asistencia
-- (una vez por cada FILTER, menores y mayores) -- esa funcion, con solo un id,
-- volvia a hacer su PROPIO join de 3 tablas (casa_de_paz_asistencia,
-- casa_de_paz_reporte, persona) para recalcular datos que esta vista ya tiene
-- disponibles en el scope del join principal. Antipatron N+1 clasico: por eso
-- esta vista era, con diferencia, la consulta mas lenta de la app real
-- (117ms/92ms promedio contra 3-70ms del resto).
--
-- Fix: se agrega el JOIN a persona directo en la vista (una sola vez) y se
-- calcula "es_menor" inline en una subconsulta, evaluado UNA vez por fila
-- (antes: 2 veces, una por cada FILTER). fn_criterio() sigue llamandose --
-- es liviana (lee configuracion), lo que se elimina es el rejoin completo de
-- 3 tablas por fila. Misma logica exacta que fn_asistencia_es_menor (10_
-- reporte.sql): si hay fecha_nacimiento, compara edad contra el criterio de
-- la iglesia; si no, cae al es_menor manual cargado en el reporte.
--
-- fn_asistencia_es_menor NO se borra (queda sin uso desde esta vista, pero no
-- se toca por si algo mas la usa) -- solo se deja de llamar aca.
--
-- Mismo contrato de columnas que antes (nombres, orden y tipos identicos) --
-- CREATE OR REPLACE VIEW no rompe nada que ya consuma v_reporte_totales.

CREATE OR REPLACE VIEW v_reporte_totales AS
SELECT
  reporte_id,
  casa_de_paz_id,
  fecha_reunion,
  count(asistencia_id) FILTER (WHERE es_menor) AS total_menores,
  count(asistencia_id) FILTER (WHERE NOT es_menor) AS total_mayores,
  count(asistencia_id) AS total_asistentes,
  count(asistencia_id) FILTER (WHERE es_visita) AS total_visitas,
  fecha_creacion
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
    END AS es_menor
  FROM casa_de_paz_reporte r
  LEFT JOIN casa_de_paz_asistencia a ON a.reporte_id = r.id AND a.fecha_eliminacion IS NULL
  LEFT JOIN persona p ON p.id = a.persona_id
  WHERE r.fecha_eliminacion IS NULL
) base
GROUP BY reporte_id, casa_de_paz_id, fecha_reunion, fecha_creacion;
