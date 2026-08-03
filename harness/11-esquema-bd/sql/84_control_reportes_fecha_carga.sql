-- VisionHub -- 84_control_reportes_fecha_carga.sql
-- Bloque 4 del pedido del owner (2026-08-02): Control de Reportes pasa a
-- mostrar 3 estados (verde=presentó a tiempo, naranja=presentó con retraso,
-- rojo=no presentó) en vez de los 2 que había (presentó/pendiente). Para
-- distinguir "a tiempo" de "con retraso" hace falta saber CUÁNDO se cargó el
-- reporte, no solo la fecha de la reunión que reporta -- v_reporte_totales
-- no lo exponía. CREATE OR REPLACE VIEW alcanza agregando la columna al
-- final (no se reordena ni se saca ninguna de las existentes).

CREATE OR REPLACE VIEW v_reporte_totales AS
SELECT
  r.id AS reporte_id, r.casa_de_paz_id, r.fecha_reunion,
  count(a.id) FILTER (WHERE fn_asistencia_es_menor(a.id))     AS total_menores,
  count(a.id) FILTER (WHERE NOT fn_asistencia_es_menor(a.id)) AS total_mayores,
  count(a.id)                                                 AS total_asistentes,
  count(a.id) FILTER (WHERE a.es_visita)                      AS total_visitas,
  r.fecha_creacion
FROM casa_de_paz_reporte r
LEFT JOIN casa_de_paz_asistencia a ON a.reporte_id = r.id AND a.fecha_eliminacion IS NULL
WHERE r.fecha_eliminacion IS NULL
GROUP BY r.id, r.casa_de_paz_id, r.fecha_reunion;
