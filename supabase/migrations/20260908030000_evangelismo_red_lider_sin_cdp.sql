-- VisionHub -- Evangelismo a nivel Red, para Lideres de Red sin Casa de Paz
-- propia. Pedido del owner (2026-09-08): hay Lideres de Red que no lideran
-- ninguna CdP, asi que hoy no tienen forma de registrar evangelizados -- el
-- modulo Evangelismo (tabla `evangelismo`, ver 12_evangelismo.sql) exige
-- casa_de_paz_id obligatorio via chk_evangelismo_escala_cdp/
-- chk_evangelismo_solo_cdp_modulo1.
--
-- Decision explicita del owner: en vez de tocar esa tabla/RLS/constraints
-- (las usan reportes, metas, dashboards y el ciclo SIM/NC/CRE -- alto riesgo
-- de romper algo existente), se crea una tabla nueva e independiente,
-- puramente aditiva: `evangelismo_red`. Si el Lider de Red SI tiene una CdP
-- propia en esa misma Red, no se le habilita nada de esto -- sigue el flujo
-- normal de Evangelismo.tsx (pol_evangelismo_insert/fn_puede_reportar_cdp,
-- sin cambios). Ese chequeo ("tiene CdP en su Red") lo hace el frontend con
-- `roles.cdp_lider` (fn_mis_roles_dashboard, 92_cdp_dashboard_red_id.sql),
-- filtrado por red_id, que ya expone ese dato.
--
-- OJO -- limitacion conocida y aceptada por el owner: un evangelizado
-- registrado aca NO tiene Casa de Paz, asi que queda fuera del ciclo
-- SIM/NC/CRE y de "Asistentes Nuevos"/"Personas" de cualquier CdP (todo eso
-- es 100% por CdP). Queda asi por ahora, sin conectar al seguimiento de CdP.

CREATE TABLE evangelismo_red (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id           UUID NOT NULL REFERENCES iglesia(id),
  red_id               UUID NOT NULL REFERENCES red(id),
  persona_id           UUID NOT NULL REFERENCES persona(id),
  fecha                DATE NOT NULL,
  domicilio            TEXT,
  evangelizado_por_id  UUID REFERENCES persona(id),
  observaciones        TEXT,
  tipo_evangelismo_id  UUID REFERENCES tipo_evangelismo(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_evangelismo_red_fecha CHECK (fecha <= CURRENT_DATE)
);

CREATE UNIQUE INDEX uq_evangelismo_red_persona_red_fecha ON evangelismo_red (persona_id, red_id, fecha) WHERE fecha_eliminacion IS NULL;
CREATE INDEX idx_evangelismo_red_red_fecha ON evangelismo_red (red_id, fecha) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_evangelismo_red BEFORE INSERT OR UPDATE ON evangelismo_red FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_evangelismo_red BEFORE DELETE ON evangelismo_red FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE evangelismo_red ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_evangelismo_red_select ON evangelismo_red
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

-- Solo Lider/Sublider de esa Red (fn_es_lider_de_red ya incluye SUBLIDER_RED,
-- 91_fn_es_lider_de_red_incluye_sublider.sql) -- sin tocar
-- fn_puede_reportar_cdp, que usan ~17 funciones distintas del modulo CdP.
CREATE POLICY pol_evangelismo_red_insert ON evangelismo_red
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_lider_de_red(red_id));

CREATE POLICY pol_evangelismo_red_update ON evangelismo_red
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_lider_de_red(red_id));

-- fn_registrar_evangelizado_red: mismo patron transaccional que
-- fn_registrar_evangelizado (20260906020000_evangelizado_por.sql) -- persona +
-- telefono + evangelismo_red en un solo paso, para no dejar una persona
-- huerfana si el insert de evangelismo_red falla.
CREATE OR REPLACE FUNCTION public.fn_registrar_evangelizado_red(p_datos JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_persona_id UUID := NULLIF(p_datos->>'persona_id', '')::UUID;
  v_telefono TEXT := NULLIF(btrim(coalesce(p_datos->>'telefono', '')), '');
  v_tipo_telefono_id UUID;
  v_telefono_id UUID;
BEGIN
  IF v_persona_id IS NULL THEN
    INSERT INTO persona (iglesia_id, primer_nombre, primer_apellido, sexo, fecha_nacimiento, membresia_completada)
    VALUES (
      (p_datos->>'iglesia_id')::UUID,
      p_datos->>'primer_nombre',
      p_datos->>'primer_apellido',
      (p_datos->>'sexo')::sexo_enum,
      NULLIF(p_datos->>'fecha_nacimiento', '')::DATE,
      false
    )
    RETURNING id INTO v_persona_id;

    IF v_telefono IS NOT NULL THEN
      SELECT id INTO v_tipo_telefono_id FROM tipo_telefono WHERE activo ORDER BY orden LIMIT 1;
      IF v_tipo_telefono_id IS NOT NULL THEN
        INSERT INTO telefono (iglesia_id, tipo_telefono_id, numero)
        VALUES ((p_datos->>'iglesia_id')::UUID, v_tipo_telefono_id, v_telefono)
        RETURNING id INTO v_telefono_id;

        INSERT INTO telefono_asignacion (iglesia_id, telefono_id, persona_id, es_principal)
        VALUES ((p_datos->>'iglesia_id')::UUID, v_telefono_id, v_persona_id, true);
      END IF;
    END IF;
  END IF;

  INSERT INTO evangelismo_red (iglesia_id, red_id, persona_id, fecha, domicilio, observaciones, tipo_evangelismo_id, evangelizado_por_id)
  VALUES (
    (p_datos->>'iglesia_id')::UUID,
    (p_datos->>'red_id')::UUID,
    v_persona_id,
    (p_datos->>'fecha')::DATE,
    p_datos->>'domicilio',
    p_datos->>'observaciones',
    NULLIF(p_datos->>'tipo_evangelismo_id', '')::UUID,
    NULLIF(p_datos->>'evangelizado_por_id', '')::UUID
  );

  RETURN v_persona_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_registrar_evangelizado_red(JSONB) TO authenticated;

-- fn_evangelismo_red_directo: listado de lo registrado directo a nivel Red
-- (sin CdP) -- mismo shape base que fn_evangelismo_red
-- (20260906010000_fn_evangelismo_red_tipo_codigo.sql), tipos de columna
-- calcados de tipo_evangelismo (nombre VARCHAR(100), color CHAR(7)) para no
-- repetir el bug ya documentado de "structure of query does not match
-- function result type".
CREATE OR REPLACE FUNCTION public.fn_evangelismo_red_directo(p_red_id UUID, p_desde DATE, p_hasta DATE)
RETURNS TABLE (
  id UUID,
  persona_id UUID,
  nombre_completo TEXT,
  fecha DATE,
  domicilio TEXT,
  tipo_evangelismo_nombre CHARACTER VARYING,
  tipo_evangelismo_color CHARACTER,
  tipo_evangelismo_codigo CHARACTER VARYING
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT red.iglesia_id INTO v_iglesia_id FROM red WHERE red.id = p_red_id;
  IF v_iglesia_id IS NULL OR v_iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin acceso a la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_lider_de_red(p_red_id) OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR fn_es_lider_evangelismo_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'RED_FUERA_DE_ALCANCE: sin cargo vigente en la red %', p_red_id USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT ev.id, ev.persona_id, fn_nombre_completo(p), ev.fecha, ev.domicilio,
         te.nombre, te.color, te.codigo
  FROM evangelismo_red ev
  JOIN persona p ON p.id = ev.persona_id
  LEFT JOIN tipo_evangelismo te ON te.id = ev.tipo_evangelismo_id
  WHERE ev.red_id = p_red_id
    AND ev.fecha_eliminacion IS NULL
    AND ev.fecha BETWEEN p_desde AND p_hasta
  ORDER BY ev.fecha DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_evangelismo_red_directo(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_evangelismo_red_directo(UUID, DATE, DATE) TO authenticated;
