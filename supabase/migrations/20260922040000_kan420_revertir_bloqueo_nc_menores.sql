-- KAN-420 (2026-09-22, corrección del owner sobre su propio pedido inicial):
-- el pedido original ("nunca guardar NC para un menor de 12") se entendió
-- mal -- 2 sesiones distintas lo implementaron así (esta y otra en
-- paralelo), pero el owner aclaró después: un menor de 12 SÍ puede llegar a
-- NC igual que un adulto (misma semana de "recién llegado", el mismo motor
-- automático de siempre) -- lo que había que corregir es DÓNDE se muestra
-- en el reporte de Casa de Paz (en su zona de "menores de 12 años", con la
-- etiqueta corta "NC"), no bloquear el estado en la base.
--
-- Esta migración revierte fn_recalcular_estados_cdp_reporte al
-- comportamiento de 20260917220000 (sin chequeo de edad) y repara el único
-- caso real tocado por el bloqueo equivocado: Valentina Panozo (6 años,
-- persona a3ff0232-8625-4e9b-99a7-df5881a940df) había llegado a NC de forma
-- correcta el 2026-09-17 y fue bajada a SIM por error hoy -- se revierte esa
-- baja y vuelve a NC.

begin;

CREATE OR REPLACE FUNCTION public.fn_recalcular_estados_cdp_reporte(p_reporte_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cdp_id uuid;
  v_iglesia_id uuid;
  v_fecha_reunion date;
  v_umbral int;
  v_umbral_visitas int;
  v_estado_sim_id uuid;
  v_estado_cre_id uuid;
  v_estado_nc_id uuid;
  v_estado_re_id uuid;
  v_reportes_recientes uuid[];
  v_miembro record;
  v_visita record;
  v_ausencias_consecutivas int;
  v_estado_activo_id uuid;
  v_asistencias_base int;
  v_asistio_este_reporte boolean;
  v_total_historico int;
  v_asistencias_desde_sim int;
  v_fue_nc_alguna_vez boolean;
  v_fecha_primera_asistencia date;
  v_asistencia_previa date;
  v_dias_ausente int;
BEGIN
  SELECT r.casa_de_paz_id, r.iglesia_id, r.fecha_reunion
  INTO v_cdp_id, v_iglesia_id, v_fecha_reunion
  FROM public.casa_de_paz_reporte r
  WHERE r.id = p_reporte_id AND r.fecha_eliminacion IS NULL;

  IF v_cdp_id IS NULL OR NOT public.fn_puede_ver_cdp(v_cdp_id) THEN
    RETURN;
  END IF;

  v_umbral := greatest(1, coalesce(public.fn_criterio(v_iglesia_id, 'AUSENCIAS_SIMPATIZANTE')::int, 1));
  v_umbral_visitas := greatest(1, coalesce(public.fn_criterio(v_iglesia_id, 'VISITAS_PARA_CRE')::int, 2));

  SELECT id INTO v_estado_sim_id FROM public.estado WHERE sigla = 'SIM' AND fecha_eliminacion IS NULL;
  SELECT id INTO v_estado_cre_id FROM public.estado WHERE sigla = 'CRE' AND fecha_eliminacion IS NULL;
  SELECT id INTO v_estado_nc_id FROM public.estado WHERE sigla = 'NC' AND fecha_eliminacion IS NULL;
  SELECT id INTO v_estado_re_id FROM public.estado WHERE sigla = 'RE' AND fecha_eliminacion IS NULL;
  IF v_estado_sim_id IS NULL OR v_estado_cre_id IS NULL THEN
    RETURN;
  END IF;

  SELECT array_agg(id ORDER BY fecha_reunion DESC, fecha_creacion DESC)
  INTO v_reportes_recientes
  FROM (
    SELECT id, fecha_reunion, fecha_creacion
    FROM public.casa_de_paz_reporte
    WHERE casa_de_paz_id = v_cdp_id AND fecha_eliminacion IS NULL
    ORDER BY fecha_reunion DESC, fecha_creacion DESC
    LIMIT v_umbral
  ) x;

  -- Ciclo SIM<->CRE de miembros reales (sin cambios).
  FOR v_miembro IN
    SELECT cm.persona_id
    FROM public.casa_de_paz_membresia cm
    WHERE cm.casa_de_paz_id = v_cdp_id
      AND cm.es_principal
      AND cm.fecha_fin IS NULL
      AND cm.fecha_eliminacion IS NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.casa_de_paz_asistencia a
      WHERE a.reporte_id = p_reporte_id AND a.persona_id = v_miembro.persona_id
        AND a.fecha_eliminacion IS NULL
    ) THEN
      SELECT pe.estado_id INTO v_estado_activo_id
      FROM public.persona_estado pe
      WHERE pe.persona_id = v_miembro.persona_id
        AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
      ORDER BY pe.fecha_inicio DESC
      LIMIT 1;

      v_asistencia_previa := NULL;
      IF v_estado_re_id IS NOT NULL THEN
        SELECT max(r2.fecha_reunion) INTO v_asistencia_previa
        FROM public.casa_de_paz_asistencia a2
        JOIN public.casa_de_paz_reporte r2 ON r2.id = a2.reporte_id
        WHERE a2.persona_id = v_miembro.persona_id
          AND a2.reporte_id <> p_reporte_id
          AND a2.fecha_eliminacion IS NULL
          AND r2.fecha_reunion < v_fecha_reunion;
      END IF;

      IF v_asistencia_previa IS NOT NULL THEN
        v_dias_ausente := v_fecha_reunion - v_asistencia_previa;

        IF v_dias_ausente >= public.fn_criterio(v_iglesia_id, 'DIAS_PARA_RE') THEN
          IF v_estado_activo_id IS DISTINCT FROM v_estado_re_id THEN
            UPDATE public.persona_estado
            SET fecha_fin = current_date
            WHERE persona_id = v_miembro.persona_id
              AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

            INSERT INTO public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
            VALUES (v_iglesia_id, v_miembro.persona_id, v_estado_re_id, current_date, true,
              format('Retorno tras %s dias sin asistir', v_dias_ausente));
          END IF;
          CONTINUE;
        END IF;
      END IF;

      IF v_estado_activo_id = v_estado_sim_id THEN
        UPDATE public.persona_estado
        SET fecha_fin = current_date
        WHERE persona_id = v_miembro.persona_id
          AND estado_id = v_estado_sim_id
          AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

        INSERT INTO public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
        VALUES (v_iglesia_id, v_miembro.persona_id, v_estado_cre_id, current_date, true, 'Volvió a asistir a su Casa de Paz');
      END IF;
    ELSIF v_reportes_recientes IS NOT NULL AND array_length(v_reportes_recientes, 1) >= v_umbral THEN
      SELECT count(*)
      INTO v_ausencias_consecutivas
      FROM unnest(v_reportes_recientes) AS rid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.casa_de_paz_asistencia a
        WHERE a.reporte_id = rid AND a.persona_id = v_miembro.persona_id
          AND a.fecha_eliminacion IS NULL
      );

      IF v_ausencias_consecutivas >= v_umbral THEN
        SELECT pe.estado_id INTO v_estado_activo_id
        FROM public.persona_estado pe
        WHERE pe.persona_id = v_miembro.persona_id
          AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
        ORDER BY pe.fecha_inicio DESC
        LIMIT 1;

        IF v_estado_activo_id IS DISTINCT FROM v_estado_sim_id
           AND v_estado_activo_id IS DISTINCT FROM v_estado_cre_id
           AND v_estado_activo_id IS DISTINCT FROM v_estado_re_id THEN
          UPDATE public.persona_estado
          SET fecha_fin = current_date
          WHERE persona_id = v_miembro.persona_id
            AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

          INSERT INTO public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
          VALUES (v_iglesia_id, v_miembro.persona_id, v_estado_sim_id, current_date, true, 'Ausente en la(s) última(s) reunión(es) de su Casa de Paz');
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Ciclo de Asistentes Nuevos (visitas sin membresía formal). Sin chequeo
  -- de edad -- ver cabecera de esta migración.
  FOR v_visita IN
    SELECT DISTINCT a.persona_id
    FROM public.casa_de_paz_asistencia a
    JOIN public.casa_de_paz_reporte r ON r.id = a.reporte_id
    WHERE r.casa_de_paz_id = v_cdp_id AND a.fecha_eliminacion IS NULL AND r.fecha_eliminacion IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.casa_de_paz_membresia cm
        WHERE cm.persona_id = a.persona_id AND cm.casa_de_paz_id = v_cdp_id
          AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
      )
  LOOP
    SELECT pe.estado_id, pe.asistencias_base INTO v_estado_activo_id, v_asistencias_base
    FROM public.persona_estado pe
    WHERE pe.persona_id = v_visita.persona_id
      AND pe.fecha_fin IS NULL AND pe.fecha_eliminacion IS NULL
    ORDER BY pe.fecha_inicio DESC
    LIMIT 1;

    v_asistio_este_reporte := EXISTS (
      SELECT 1 FROM public.casa_de_paz_asistencia a
      WHERE a.reporte_id = p_reporte_id AND a.persona_id = v_visita.persona_id AND a.fecha_eliminacion IS NULL
    );

    SELECT count(*)
    INTO v_total_historico
    FROM public.casa_de_paz_asistencia a4
    JOIN public.casa_de_paz_reporte r4 ON r4.id = a4.reporte_id
    WHERE a4.persona_id = v_visita.persona_id
      AND r4.casa_de_paz_id = v_cdp_id
      AND a4.fecha_eliminacion IS NULL AND r4.fecha_eliminacion IS NULL;

    IF v_estado_activo_id IS NULL THEN
      SELECT min(r3.fecha_reunion)
      INTO v_fecha_primera_asistencia
      FROM public.casa_de_paz_asistencia a3
      JOIN public.casa_de_paz_reporte r3 ON r3.id = a3.reporte_id
      WHERE a3.persona_id = v_visita.persona_id AND r3.casa_de_paz_id = v_cdp_id
        AND a3.fecha_eliminacion IS NULL AND r3.fecha_eliminacion IS NULL;

      v_asistencias_base := v_total_historico - (CASE WHEN v_asistio_este_reporte THEN 1 ELSE 0 END);

      INSERT INTO public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo, asistencias_base)
      VALUES (v_iglesia_id, v_visita.persona_id, v_estado_sim_id, coalesce(v_fecha_primera_asistencia, current_date), true, 'Registrado como Asistente Nuevo', v_asistencias_base);

      v_estado_activo_id := v_estado_sim_id;
    END IF;

    IF v_estado_activo_id = v_estado_cre_id THEN
      CONTINUE;
    END IF;

    IF v_estado_activo_id = v_estado_nc_id THEN
      IF NOT v_asistio_este_reporte THEN
        UPDATE public.persona_estado
        SET fecha_fin = current_date
        WHERE persona_id = v_visita.persona_id AND estado_id = v_estado_nc_id
          AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

        INSERT INTO public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo, asistencias_base)
        VALUES (v_iglesia_id, v_visita.persona_id, v_estado_sim_id, current_date, true, 'Faltó a la reunión siguiente de su Casa de Paz', v_total_historico);
      END IF;

    ELSIF v_estado_activo_id = v_estado_sim_id THEN
      v_asistencias_desde_sim := v_total_historico - coalesce(v_asistencias_base, 0);
      v_fue_nc_alguna_vez := EXISTS (
        SELECT 1 FROM public.persona_estado
        WHERE persona_id = v_visita.persona_id AND estado_id = v_estado_nc_id
      );

      IF v_fue_nc_alguna_vez THEN
        IF v_asistencias_desde_sim >= 1 THEN
          UPDATE public.persona_estado
          SET fecha_fin = current_date
          WHERE persona_id = v_visita.persona_id AND estado_id = v_estado_sim_id
            AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

          INSERT INTO public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
          VALUES (v_iglesia_id, v_visita.persona_id, v_estado_cre_id, current_date, true, 'Volvió a asistir tras haber sido Nuevo Convertido');
        END IF;
      ELSE
        IF v_asistencias_desde_sim >= v_umbral_visitas THEN
          UPDATE public.persona_estado
          SET fecha_fin = current_date
          WHERE persona_id = v_visita.persona_id AND estado_id = v_estado_sim_id
            AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

          INSERT INTO public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
          VALUES (v_iglesia_id, v_visita.persona_id, v_estado_nc_id, current_date, true, 'Alcanzó el mínimo de asistencias configurado');
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- Reparación de datos: Valentina Panozo (6 años) vuelve a NC.
UPDATE public.persona_estado
SET fecha_fin = current_date
WHERE id = 'd7f6af2f-9404-4e59-a594-65c141ec9741'
  AND fecha_fin IS NULL;

INSERT INTO public.persona_estado (iglesia_id, persona_id, estado_id, fecha_inicio, es_automatico, motivo)
SELECT iglesia_id, persona_id, (SELECT id FROM public.estado WHERE sigla = 'NC' AND fecha_eliminacion IS NULL),
  current_date, true, 'KAN-420: revertido -- Nuevo Convertido sí aplica a menores de 12, se corrigió la clasificación por error'
FROM public.persona_estado
WHERE id = 'd7f6af2f-9404-4e59-a594-65c141ec9741';

commit;
