-- KAN-430: registrar una persona evangelizada desde el panel personal del
-- Evangelista.
--
-- Por que un RPC nuevo en vez de reusar fn_registrar_evangelizado tal
-- cual: esa funcion es SECURITY INVOKER y su INSERT en `evangelismo`
-- depende de pol_evangelismo_insert -> fn_puede_reportar_cdp, que exige
-- ser Lider/Sublider de ESA CdP puntual (o operativo/Pastor) -- un
-- Evangelista raso (miembro sin cargo estructural) nunca pasa ese check,
-- aunque la CdP sea la suya propia. Se resuelve con un RPC SECURITY
-- DEFINER que hace su propio chequeo de permiso (fn_es_evangelista_en) en
-- vez de tocar esa policy vieja -- la usan ~reportes/metas/dashboards del
-- modulo CdP, alto riesgo de romper algo existente (mismo criterio que ya
-- eligio el owner en 20260908030000_evangelismo_red_lider_sin_cdp.sql).
--
-- A diferencia de ese caso (evangelismo_red, tabla PARALELA a proposito
-- porque esos registros NO deben entrar al ciclo SIM/NC/CRE ni a las
-- estadisticas de CdP), aca SI corresponde reusar `evangelismo` tal cual:
-- confirmado con el owner (2026-09-29, pregunta #9) que un registro de
-- Evangelista personal cuenta bajo la CdP real de esa persona, como
-- cualquier otro evangelizado -- mismo ciclo SIM/NC/CRE, mismas
-- estadisticas, sin categoria aparte. La CdP nunca es NULL en este
-- alcance: Requisito 1 AC 2.1 exige que todo Evangelista-miembro
-- pertenezca a una CdP (la excepcion de Efesios sin CdP, Requisito 9,
-- queda fuera de esta sesion).
--
-- casa_de_paz_id y evangelizado_por_id se resuelven del lado del servidor
-- (nunca se confia en lo que mande el cliente) -- evita que un Evangelista
-- pueda registrar "a nombre de" otra CdP o atribuirse un evangelizado
-- ajeno.
CREATE OR REPLACE FUNCTION public.fn_evangelista_registrar_persona(p_datos JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_evangelista_id UUID := fn_mi_persona_id();
  v_iglesia_id UUID;
  v_casa_de_paz_id UUID;
  v_persona_id UUID := NULLIF(p_datos->>'persona_id', '')::UUID;
  v_telefono TEXT := NULLIF(btrim(coalesce(p_datos->>'telefono', '')), '');
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
  v_tipo_evangelismo_id UUID := NULLIF(p_datos->>'tipo_evangelismo_id', '')::UUID;
  v_primer_nombre TEXT := NULLIF(btrim(coalesce(p_datos->>'primer_nombre', '')), '');
  v_primer_apellido TEXT := NULLIF(btrim(coalesce(p_datos->>'primer_apellido', '')), '');
  v_sexo TEXT := NULLIF(p_datos->>'sexo', '');
  v_evangelismo_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM persona WHERE id = v_evangelista_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL OR NOT fn_es_evangelista_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'EVANGELISTA_SIN_PERMISO: no tiene el rol Evangelista en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF v_primer_nombre IS NULL OR v_primer_apellido IS NULL OR v_sexo IS NULL THEN
    RAISE EXCEPTION 'EVANGELISTA_DATOS_INCOMPLETOS: primer nombre, primer apellido y sexo son obligatorios' USING ERRCODE = 'P0001';
  END IF;

  IF v_tipo_evangelismo_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM tipo_evangelismo WHERE id = v_tipo_evangelismo_id AND codigo IN ('UNO_A_UNO', 'ELITE')
  ) THEN
    RAISE EXCEPTION 'EVANGELISTA_TIPO_INVALIDO: el tipo de evangelismo es obligatorio (1+1 o Elite)' USING ERRCODE = 'P0001';
  END IF;

  -- CdP principal vigente del propio Evangelista -- nunca la que mande el cliente.
  SELECT casa_de_paz_id INTO v_casa_de_paz_id
  FROM casa_de_paz_membresia
  WHERE persona_id = v_evangelista_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ORDER BY es_principal DESC, fecha_inicio DESC
  LIMIT 1;
  IF v_casa_de_paz_id IS NULL THEN
    RAISE EXCEPTION 'EVANGELISTA_SIN_CDP: no se encontro una Casa de Paz vigente para este Evangelista' USING ERRCODE = 'P0001';
  END IF;

  IF v_persona_id IS NULL THEN
    INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, membresia_completada)
    VALUES (
      v_iglesia_id,
      v_primer_nombre,
      NULLIF(p_datos->>'segundo_nombre', ''),
      v_primer_apellido,
      NULLIF(p_datos->>'segundo_apellido', ''),
      v_sexo::sexo_enum,
      NULLIF(p_datos->>'fecha_nacimiento', '')::DATE,
      false
    )
    RETURNING id INTO v_persona_id;

    IF v_telefono IS NOT NULL THEN
      SELECT id INTO v_tipo_telefono_id FROM tipo_telefono WHERE activo ORDER BY orden LIMIT 1;
      IF v_tipo_telefono_id IS NOT NULL THEN
        INSERT INTO telefono (iglesia_id, tipo_telefono_id, numero)
        VALUES (v_iglesia_id, v_tipo_telefono_id, v_telefono)
        RETURNING id INTO v_telefono_id;

        INSERT INTO telefono_asignacion (iglesia_id, telefono_id, persona_id, es_principal)
        VALUES (v_iglesia_id, v_telefono_id, v_persona_id, true);
      END IF;
    END IF;
  END IF;

  INSERT INTO evangelismo (iglesia_id, casa_de_paz_id, persona_id, fecha, domicilio, tipo_evangelismo_id, evangelizado_por_id)
  VALUES (v_iglesia_id, v_casa_de_paz_id, v_persona_id, CURRENT_DATE, p_datos->>'domicilio', v_tipo_evangelismo_id, v_evangelista_id)
  ON CONFLICT (persona_id, casa_de_paz_id, fecha) WHERE fecha_eliminacion IS NULL
  DO NOTHING
  RETURNING id INTO v_evangelismo_id;

  RETURN v_persona_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_evangelista_registrar_persona(JSONB) TO authenticated;

-- Historial personal (KAN-431) -- fuerza el filtro "solo mis registros"
-- (Requisito 1 AC3) del lado del servidor, aunque pol_evangelismo_select
-- ya sea iglesia-wide (para reportes compartidos del modulo CdP).
CREATE OR REPLACE FUNCTION public.fn_evangelista_historial(p_desde DATE DEFAULT NULL, p_hasta DATE DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  persona_id UUID,
  nombre_completo TEXT,
  fecha DATE,
  fecha_creacion TIMESTAMPTZ,
  tipo_evangelismo_codigo VARCHAR,
  cantidad_contactos INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_evangelista_id UUID := fn_mi_persona_id();
BEGIN
  RETURN QUERY
  SELECT ev.id, ev.persona_id, fn_nombre_completo(p), ev.fecha, ev.fecha_creacion,
         te.codigo,
         (SELECT count(*)::INT FROM evangelismo_seguimiento s WHERE s.evangelismo_id = ev.id AND s.fecha_eliminacion IS NULL)
  FROM evangelismo ev
  JOIN persona p ON p.id = ev.persona_id
  LEFT JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
  WHERE ev.evangelizado_por_id = v_evangelista_id
    AND ev.fecha_eliminacion IS NULL
    AND (p_desde IS NULL OR ev.fecha >= p_desde)
    AND (p_hasta IS NULL OR ev.fecha <= p_hasta)
  ORDER BY ev.fecha_creacion DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_evangelista_historial(DATE, DATE) TO authenticated;

-- Dashboard (KAN-429): racha + 3 indicadores + serie diaria del mes, todo
-- en un solo viaje. NC = transicion SSVA a 'NC' (persona_estado), no un
-- campo en `evangelismo` -- se mide sobre la fecha en que la persona
-- ENTRO a ese estado, para que el indicador refleje conversiones reales
-- del periodo, no solo altas.
CREATE OR REPLACE FUNCTION public.fn_evangelista_dashboard(p_anio INT, p_mes INT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_evangelista_id UUID := fn_mi_persona_id();
  v_desde DATE := make_date(p_anio, p_mes, 1);
  v_hasta DATE := (make_date(p_anio, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;
  v_racha INT := 0;
  v_cursor DATE;
BEGIN
  -- Racha = dias consecutivos con al menos un registro, contando hacia
  -- atras desde hoy. Si todavia no se registro nada hoy, se sigue
  -- mostrando la racha vigente contando desde ayer (se corta recien
  -- cuando pasa un dia entero sin ningun registro) -- mismo criterio de
  -- fecha calendario (no timestamp UTC) que el resto del proyecto.
  IF EXISTS (SELECT 1 FROM evangelismo WHERE evangelizado_por_id = v_evangelista_id AND fecha_eliminacion IS NULL AND fecha = CURRENT_DATE) THEN
    v_cursor := CURRENT_DATE;
  ELSE
    v_cursor := CURRENT_DATE - 1;
  END IF;
  WHILE EXISTS (SELECT 1 FROM evangelismo WHERE evangelizado_por_id = v_evangelista_id AND fecha_eliminacion IS NULL AND fecha = v_cursor) LOOP
    v_racha := v_racha + 1;
    v_cursor := v_cursor - 1;
  END LOOP;

  RETURN jsonb_build_object(
    'registrados', (SELECT count(*) FROM evangelismo WHERE evangelizado_por_id = v_evangelista_id AND fecha_eliminacion IS NULL AND fecha BETWEEN v_desde AND v_hasta),
    'en_seguimiento', (
      SELECT count(DISTINCT ev.id) FROM evangelismo ev
      JOIN evangelismo_seguimiento s ON s.evangelismo_id = ev.id AND s.fecha_eliminacion IS NULL
      WHERE ev.evangelizado_por_id = v_evangelista_id AND ev.fecha_eliminacion IS NULL AND ev.fecha BETWEEN v_desde AND v_hasta
    ),
    'nuevos_convertidos', (
      SELECT count(*) FROM persona_estado pe
      JOIN estado e ON e.id = pe.estado_id AND e.sigla = 'NC'
      JOIN evangelismo ev ON ev.persona_id = pe.persona_id AND ev.evangelizado_por_id = v_evangelista_id AND ev.fecha_eliminacion IS NULL
      WHERE pe.fecha_eliminacion IS NULL AND pe.fecha_inicio BETWEEN v_desde AND v_hasta
    ),
    'serie_diaria', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('dia', extract(DAY FROM d)::INT, 'cantidad', coalesce(c.cantidad, 0)) ORDER BY d), '[]'::jsonb)
      FROM generate_series(v_desde, v_hasta, '1 day'::interval) d
      LEFT JOIN (
        SELECT fecha, count(*) AS cantidad FROM evangelismo
        WHERE evangelizado_por_id = v_evangelista_id AND fecha_eliminacion IS NULL AND fecha BETWEEN v_desde AND v_hasta
        GROUP BY fecha
      ) c ON c.fecha = d::DATE
    ),
    'racha_dias', v_racha
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_evangelista_dashboard(INT, INT) TO authenticated;
