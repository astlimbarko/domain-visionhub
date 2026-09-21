-- KAN-409: Megafiesta de Casa de Paz -- reporte de asistencia reducido +
-- consolidado automatico por Red.
--
-- DECISION DE DISENO (documentada segun pedido explicito del ticket): ya
-- existia un mecanismo PARCIAL de "Mega Fiesta" -- un checkbox en el
-- reporte semanal normal que vincula el reporte a un `evento` tipo
-- MEGA_FIESTA de la Red (columna casa_de_paz_reporte.evento_megafiesta_id,
-- ya validada por el trigger fn_validar_reporte_megafiesta: mismo tipo,
-- misma fecha, misma red). Ese mecanismo NO reducia el formulario, NO
-- consolidaba nada y NO mostraba desglose -- era solo una etiqueta suelta.
--
-- Se elige EVOLUCIONAR ese mecanismo (opcion "a" del ticket), no crear uno
-- nuevo en paralelo:
--   - `evento` tipo MEGA_FIESTA (red_id + fecha_inicio) sigue siendo el
--     "consolidado" de la Megafiesta -- ya es lo que crea el Lider de Red al
--     programarla desde el Calendario (fn_puede_crear_evento exige
--     fn_es_lider_de_red para eventos con red_id). Se le agrega un indice
--     unico para que nunca haya 2 consolidados de la misma Red+fecha.
--   - `casa_de_paz_reporte.evento_megafiesta_id` sigue siendo el vinculo de
--     cada reporte de CdP a su consolidado -- ya existia, no se toca su
--     forma. Lo que cambia es que ahora SIEMPRE se completa junto con un
--     reporte reducido (fn_megafiesta_obtener_o_crear, mas abajo), no como
--     un checkbox opcional de un reporte completo: el checkbox viejo
--     "Fue la Mega Fiesta de Casas de Paz" del formulario normal se retira
--     del frontend (ver Reportes.tsx) para no dejar 2 flujos que confundan.
--   - Como el Lider de CdP puede reportar una Megafiesta SIN que el Lider de
--     Red la haya programado antes (requisito explicito del ticket), y la
--     RLS de `evento` no deja crear un evento de Red a nadie que no sea
--     Lider/Sublider de Red, se agrega una funcion SECURITY DEFINER
--     (`fn_megafiesta_obtener_o_crear`) que busca o crea el consolidado,
--     acotada estrictamente a: el llamante debe poder reportar esa CdP
--     (mismo permiso que cualquier reporte semanal), y solo puede crear/
--     encontrar un evento MEGA_FIESTA de LA RED de esa CdP puntual, nunca
--     una red arbitraria.
--   - Se agrega una tabla nueva `evento_megafiesta_detalle` (1:1 con
--     evento) para los datos que el ticket pide completar a nivel del
--     CONSOLIDADO, no por cada reporte de CdP: Tema, Finanzas, Testimonio
--     (punto 5 del ticket). No se reusa `finanzas_ingreso` (esta atada a
--     `reporte_id`, un reporte puntual) ni se le agregan columnas sueltas a
--     `evento` (tabla generica, compartida con otros tipos de evento) --
--     una tabla de detalle aparte, solo relevante para MEGA_FIESTA, es mas
--     limpia.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Un unico consolidado por Red+fecha: indice unico parcial (constante
--    58640324-aa09-4fb2-b581-ddf634c57c12 = tipo_evento.codigo MEGA_FIESTA,
--    fija en la base, confirmada por consulta directa).
-- ─────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_megafiesta_red_fecha
  ON public.evento (red_id, fecha_inicio)
  WHERE tipo_evento_id = '58640324-aa09-4fb2-b581-ddf634c57c12'
    AND fecha_eliminacion IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) fn_megafiesta_obtener_o_crear: busca el consolidado (evento MEGA_FIESTA)
--    de la Red de la CdP dada para esa fecha; si no existe, lo crea. Nunca
--    bloquea al Lider de CdP por falta de programacion previa (punto 3 del
--    ticket). Carrera de 2 CdP reportando a la vez -> el indice unico de
--    arriba hace fallar el segundo INSERT con unique_violation, que se
--    resuelve re-consultando (mismo patron que otros "obtener o crear" del
--    proyecto).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_megafiesta_obtener_o_crear(p_casa_de_paz_id uuid, p_fecha date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_iglesia_id uuid;
  v_red_id uuid;
  v_evento_id uuid;
  v_tipo_megafiesta_id CONSTANT uuid := '58640324-aa09-4fb2-b581-ddf634c57c12';
BEGIN
  IF NOT fn_puede_reportar_cdp(p_casa_de_paz_id) THEN
    RAISE EXCEPTION 'MEGAFIESTA_SIN_PERMISO: no tenes permiso para reportar en esta Casa de Paz' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'MEGAFIESTA_CDP_INEXISTENTE: la Casa de Paz no existe' USING ERRCODE = 'P0001';
  END IF;

  SELECT cdr.red_id INTO v_red_id
    FROM casa_de_paz_red cdr
    WHERE cdr.casa_de_paz_id = p_casa_de_paz_id AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL;
  IF v_red_id IS NULL THEN
    RAISE EXCEPTION 'MEGAFIESTA_SIN_RED: esta Casa de Paz no pertenece a ninguna Red activa' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_evento_id FROM evento
    WHERE red_id = v_red_id AND fecha_inicio = p_fecha
      AND tipo_evento_id = v_tipo_megafiesta_id AND fecha_eliminacion IS NULL;
  IF v_evento_id IS NOT NULL THEN
    RETURN v_evento_id;
  END IF;

  BEGIN
    INSERT INTO evento (iglesia_id, red_id, tipo_evento_id, titulo, fecha_inicio, creado_por)
    VALUES (v_iglesia_id, v_red_id, v_tipo_megafiesta_id, 'Megafiesta de Casas de Paz', p_fecha, auth.uid())
    RETURNING id INTO v_evento_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_evento_id FROM evento
      WHERE red_id = v_red_id AND fecha_inicio = p_fecha
        AND tipo_evento_id = v_tipo_megafiesta_id AND fecha_eliminacion IS NULL;
  END;

  RETURN v_evento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_megafiesta_obtener_o_crear(uuid, date) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) fn_validar_campos_reporte: el reporte reducido de Megafiesta no debe
--    exigir tema/disertador/testimonios/comentarios obligatorios (esos
--    criterios son del reporte semanal normal) -- mismo bypass que ya existe
--    para reunion_no_realizada, extendido a evento_megafiesta_id IS NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_validar_campos_reporte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.reunion_no_realizada OR NEW.evento_megafiesta_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_TEMA_OBLIGATORIO')
     AND NEW.tema_id IS NULL
     AND (NEW.tema_especial_txt IS NULL OR btrim(NEW.tema_especial_txt) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "tema" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_DISERTADOR_OBLIGATORIO') AND NEW.disertador_id IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "disertador" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_TESTIMONIOS_OBLIGATORIO')
     AND (NEW.testimonios IS NULL OR btrim(NEW.testimonios) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "testimonios" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF fn_config_bool(NEW.iglesia_id, 'REPORTE_COMENTARIOS_OBLIGATORIO')
     AND (NEW.comentarios IS NULL OR btrim(NEW.comentarios) = '') THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "comentarios" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) evento_megafiesta_detalle: datos generales de la Megafiesta que el
--    Lider de Red completa UNA vez desde el consolidado (punto 5 del
--    ticket) -- Tema, Finanzas. Testimonio queda simplemente presente y
--    opcional, sin logica de quien debe llenarlo (pedido explicito: no
--    imponer esa responsabilidad).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evento_megafiesta_detalle (
  evento_id uuid PRIMARY KEY REFERENCES public.evento(id) ON DELETE CASCADE,
  libro_id uuid REFERENCES public.cdp_libro(id),
  tema_id uuid REFERENCES public.cdp_tema(id),
  tema_especial_txt varchar(200),
  total_ofrendas numeric(12, 2),
  moneda_id uuid REFERENCES public.moneda(id),
  testimonios text,
  fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id)
);

ALTER TABLE public.evento_megafiesta_detalle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_evento_megafiesta_detalle_select ON public.evento_megafiesta_detalle;
DROP POLICY IF EXISTS pol_evento_megafiesta_detalle_insert ON public.evento_megafiesta_detalle;
DROP POLICY IF EXISTS pol_evento_megafiesta_detalle_update ON public.evento_megafiesta_detalle;

CREATE POLICY pol_evento_megafiesta_detalle_select ON public.evento_megafiesta_detalle
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM evento e
      WHERE e.id = evento_id
        AND (fn_puede_ver_red(e.red_id) OR fn_es_operativo_en_o_padre_de(e.iglesia_id))
    )
  );

CREATE POLICY pol_evento_megafiesta_detalle_insert ON public.evento_megafiesta_detalle
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM evento e
      WHERE e.id = evento_id
        AND (fn_es_lider_de_red(e.red_id) OR fn_es_operativo_en_o_padre_de(e.iglesia_id))
    )
  );

CREATE POLICY pol_evento_megafiesta_detalle_update ON public.evento_megafiesta_detalle
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM evento e
      WHERE e.id = evento_id
        AND (fn_es_lider_de_red(e.red_id) OR fn_es_operativo_en_o_padre_de(e.iglesia_id))
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.evento_megafiesta_detalle TO authenticated;

-- fecha_actualizacion/actualizado_por los pone el servidor, no el cliente
-- (mismo criterio que fn_auditoria en el resto del proyecto, pero esta
-- tabla no tiene fecha_creacion/fecha_eliminacion -- es upsert puro, sin
-- baja logica -- asi que no reusa fn_auditoria tal cual, tiene su propia
-- version minima).
CREATE OR REPLACE FUNCTION public.fn_auditoria_megafiesta_detalle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.fecha_actualizacion := now();
  NEW.actualizado_por := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_evento_megafiesta_detalle ON public.evento_megafiesta_detalle;
CREATE TRIGGER trg_auditoria_evento_megafiesta_detalle
  BEFORE INSERT OR UPDATE ON public.evento_megafiesta_detalle
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_megafiesta_detalle();
