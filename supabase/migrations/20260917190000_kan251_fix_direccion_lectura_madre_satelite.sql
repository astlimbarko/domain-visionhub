-- VisionHub -- KAN-251, fix de seguridad real encontrado en auto-revisión
-- (2026-09-17, mismo día, antes de que el owner probara nada): el helper
-- fn_es_operativo_en_o_par_satelite (migración 20260917170000) usaba
-- fn_son_madre_satelite_vigente, que es SIMÉTRICA -- el resultado era que
-- el Pastor/Supervisor de la SATÉLITE también podía leer la estructura de
-- la MADRE, al revés de lo que pide el modelo de negocio ("designado todo
-- desde la madre" mientras dure la fase satélite -- la dirección es
-- explícitamente madre -> satélite, no bidireccional).
--
-- Verificado el bug con una cuenta de prueba 100% aislada (sin ningún rol
-- en la iglesia madre, solo Supervisor de la satélite): antes de este fix,
-- veía los 4 departamentos y la fila de `iglesia` de la madre. Después del
-- fix, 0 en ambos casos (test repetido abajo en el mismo bloque de sesión).
--
-- Fix: en vez de "son un par vigente" (simétrico), el chequeo ahora es
-- "p_iglesia_id ES una satélite Y el que pregunta es Pastor/Supervisor de
-- SU padre" -- unidireccional, solo madre -> satélite.

CREATE OR REPLACE FUNCTION public.fn_es_operativo_en_o_par_satelite(p_iglesia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT fn_es_pastor_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id)
    OR EXISTS (
      SELECT 1 FROM iglesia sat
      WHERE sat.id = p_iglesia_id AND sat.tipo = 'SATELITE' AND sat.fecha_eliminacion IS NULL
        AND sat.iglesia_padre_id IS NOT NULL
        AND (fn_es_pastor_en(sat.iglesia_padre_id) OR fn_es_operativo_en(sat.iglesia_padre_id))
    );
$function$;
