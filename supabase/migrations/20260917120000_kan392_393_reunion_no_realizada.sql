-- VisionHub -- KAN-392/393 (2026-09-17, pedido explícito del owner, ticket
-- escrito por él mismo en Jira): permitir marcar una semana como "reunión
-- no realizada" con motivo obligatorio -- no cuenta como reporte
-- presentado NI como reporte no presentado, pero sí como semana
-- informada/justificada.

ALTER TABLE public.casa_de_paz_reporte ADD COLUMN reunion_no_realizada boolean NOT NULL DEFAULT false;
ALTER TABLE public.casa_de_paz_reporte ADD COLUMN motivo_no_realizada text;

ALTER TABLE public.casa_de_paz_reporte ADD CONSTRAINT chk_reporte_motivo_no_realizada
  CHECK (NOT reunion_no_realizada OR motivo_no_realizada IS NOT NULL);

-- v_reporte_totales alimenta TODOS los dashboards/promedios de asistencia
-- (17_dashboards.sql, 36_dashboards_completos.sql, etc.) -- excluir acá,
-- en el único punto de origen, en vez de tocar cada consumidor por
-- separado. Con esto una "reunión no realizada" nunca cuenta como reporte
-- presentado en ningún lado que ya use esta vista (KAN-392 lo pide
-- explícito: "no debe contabilizarse como una reunión realizada ni como
-- un reporte normal presentado"). El calendario (KAN-393) necesita un
-- query aparte para saber qué semanas son "no realizada" -- ver
-- obtenerReunionesNoRealizadas en reporte.service.ts -- porque quedan
-- afuera de esta vista a propósito.
CREATE OR REPLACE VIEW public.v_reporte_totales AS
 SELECT reporte_id,
    casa_de_paz_id,
    fecha_reunion,
    count(asistencia_id) FILTER (WHERE es_menor) AS total_menores,
    count(asistencia_id) FILTER (WHERE NOT es_menor) AS total_mayores,
    count(asistencia_id) AS total_asistentes,
    count(asistencia_id) FILTER (WHERE es_visita) AS total_visitas,
    fecha_creacion,
    estado_carga
   FROM ( SELECT r.id AS reporte_id,
            r.casa_de_paz_id,
            r.fecha_reunion,
            r.fecha_creacion,
            a.id AS asistencia_id,
            a.es_visita,
                CASE
                    WHEN p.fecha_nacimiento IS NOT NULL THEN EXTRACT(year FROM age(r.fecha_reunion::timestamp with time zone, p.fecha_nacimiento::timestamp with time zone)) < fn_criterio(r.iglesia_id, 'EDAD_MINIMA_CREYENTE'::character varying)
                    ELSE a.es_menor
                END AS es_menor,
                CASE
                    WHEN ((r.fecha_creacion AT TIME ZONE 'America/La_Paz'::text)::date - r.fecha_reunion)::numeric <= fn_criterio(r.iglesia_id, 'DIAS_PLAZO_REPORTE'::character varying) THEN 'VERDE'::text
                    ELSE 'NARANJA'::text
                END AS estado_carga
           FROM casa_de_paz_reporte r
             LEFT JOIN casa_de_paz_asistencia a ON a.reporte_id = r.id AND a.fecha_eliminacion IS NULL
             LEFT JOIN persona p ON p.id = a.persona_id
          WHERE r.fecha_eliminacion IS NULL AND NOT r.reunion_no_realizada) base
  GROUP BY reporte_id, casa_de_paz_id, fecha_reunion, fecha_creacion, estado_carga;
