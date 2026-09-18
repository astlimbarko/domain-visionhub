-- VisionHub -- KAN-401: CREATE OR REPLACE con una firma distinta (parámetro
-- p_cumpleanos_periodo nuevo al final) crea un OVERLOAD nuevo en vez de
-- reemplazar la función -- Postgres identifica una función por nombre +
-- lista de parámetros, no solo por nombre. Quedaron 2 versiones vivas de
-- fn_afirmacion_buscar_membresia (12 y 13 args); la vieja de 12 quedó
-- muerta (el único caller, afirmacion.service.ts, ya manda los 13
-- parámetros siempre) pero seguía en la base -- riesgo real si alguien la
-- llama sin el parámetro nuevo en el futuro (se resolvería a la firma
-- vieja, sin el filtro de cumpleaños, en silencio). Se borra.
DROP FUNCTION IF EXISTS public.fn_afirmacion_buscar_membresia(
  uuid, text, integer, integer, uuid, uuid, uuid, sexo_enum, text, boolean, text, boolean
);
