-- VisionHub -- Causa raíz del bug "Ministerios por personas"/"Sublíderes"/
-- "Líderes" invisibles (2026-09-08/09, pedido explícito del owner de arreglar
-- de raíz, no solo parchear el roster): aceptar la invitación de Líder o
-- Sublíder de CdP -- o que se lo asignen directo desde el Constructor -- SOLO
-- crea el CARGO (casa_de_paz_cargo). Nunca se inserta una fila en
-- casa_de_paz_membresia, así que esa persona nunca queda "vinculada" a la
-- CdP en el sentido que usa el resto de la app (roster, reportes, conteos de
-- Miembros) -- confirmado que el 100% de los cargos LIDER_CDP y SUBLIDER_CDP
-- vigentes del sistema estaban en esta situación.
--
-- Se confirmó con el owner el alcance de este fix: sí crear la membresía
-- (no solo parchear el roster), asumiendo el impacto en conteos de
-- "Miembros"/reportes que eso implica.
--
-- Fix: helper compartido que asegura la membresía SOLO si la persona no
-- tiene YA una membresía principal vigente en NINGUNA CdP (ni en esta ni en
-- otra) -- si ya es miembro de otra CdP, no se la mueve ni se le abre una
-- segunda membresía principal; mover de CdP es una decisión aparte
-- (ver moverPersonaRed) y no corresponde hacerla implícita acá.
--
-- Se llama desde los 3 puntos donde hoy se otorga el cargo LIDER_CDP/
-- SUBLIDER_CDP sin tocar membresía:
--   1. fn_aceptar_invitacion_lider   -- primera invitación aceptada
--   2. fn_resolver_invitaciones_pendientes_extra -- invitaciones extra de la misma cuenta
--   3. fn_asignar_cargo_cdp          -- asignación directa (Constructor)

CREATE OR REPLACE FUNCTION private.fn_asegurar_membresia_cdp_por_cargo(p_persona_id UUID, p_iglesia_id UUID, p_casa_de_paz_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.casa_de_paz_membresia
    WHERE persona_id = p_persona_id AND es_principal AND fecha_fin IS NULL AND fecha_eliminacion IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  VALUES (p_iglesia_id, p_casa_de_paz_id, p_persona_id, true, CURRENT_DATE);
END;
$$;

-- ── 1. fn_aceptar_invitacion_lider ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_aceptar_invitacion_lider(p_primer_nombre text, p_segundo_nombre text, p_primer_apellido text, p_segundo_apellido text, p_sexo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv invitacion_lider;
  v_persona_id UUID;
  v_cargo_codigo TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM persona WHERE usuario_id = auth.uid() AND fecha_eliminacion IS NULL) THEN
    RETURN;
  END IF;

  SELECT * INTO v_inv FROM invitacion_lider
  WHERE usuario_id = auth.uid() AND estado = 'PENDIENTE' AND fecha_eliminacion IS NULL
    AND rol IS NOT NULL
  ORDER BY fecha_creacion DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBRESIA_SIN_INVITACION_PENDIENTE: no hay una invitacion pendiente para aceptar' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, membresia_completada)
  VALUES (v_inv.iglesia_id, auth.uid(), p_primer_nombre, p_segundo_nombre, p_primer_apellido, p_segundo_apellido, p_sexo::sexo_enum, false)
  RETURNING id INTO v_persona_id;

  IF v_inv.rol = 'LIDER_RED' THEN
    SELECT codigo INTO v_cargo_codigo FROM cargo WHERE id = v_inv.cargo_id;

    IF v_cargo_codigo = 'SUBLIDER_RED' THEN
      INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.red_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
    ELSE
      UPDATE red_cargo SET fecha_fin = CURRENT_DATE
      WHERE red_id = v_inv.red_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
      INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.red_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
    END IF;

  ELSIF v_inv.rol = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = v_inv.casa_de_paz_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
    PERFORM private.fn_asegurar_membresia_cdp_por_cargo(v_persona_id, v_inv.iglesia_id, v_inv.casa_de_paz_id);

  ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
    PERFORM private.fn_asegurar_membresia_cdp_por_cargo(v_persona_id, v_inv.iglesia_id, v_inv.casa_de_paz_id);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);
END;
$$;

-- ── 2. fn_resolver_invitaciones_pendientes_extra ────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_resolver_invitaciones_pendientes_extra(p_persona_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv invitacion_lider;
  v_cargo_codigo text;
BEGIN
  FOR v_inv IN
    SELECT * FROM invitacion_lider
    WHERE usuario_id = auth.uid() AND estado = 'PENDIENTE' AND fecha_eliminacion IS NULL
  LOOP
    IF v_inv.rol = 'LIDER_RED' THEN
      SELECT codigo INTO v_cargo_codigo FROM cargo WHERE id = v_inv.cargo_id;

      IF v_cargo_codigo = 'SUBLIDER_RED' THEN
        INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
        VALUES (v_inv.iglesia_id, v_inv.red_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);
      ELSE
        UPDATE red_cargo SET fecha_fin = CURRENT_DATE
        WHERE red_id = v_inv.red_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
        INSERT INTO red_cargo (iglesia_id, red_id, persona_id, cargo_id, fecha_inicio)
        VALUES (v_inv.iglesia_id, v_inv.red_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);
      END IF;

    ELSIF v_inv.rol = 'LIDER_CDP' THEN
      UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
      WHERE casa_de_paz_id = v_inv.casa_de_paz_id AND cargo_id = v_inv.cargo_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
      INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);
      PERFORM private.fn_asegurar_membresia_cdp_por_cargo(p_persona_id, v_inv.iglesia_id, v_inv.casa_de_paz_id);

    ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
      INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
      VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, p_persona_id, v_inv.cargo_id, CURRENT_DATE);
      PERFORM private.fn_asegurar_membresia_cdp_por_cargo(p_persona_id, v_inv.iglesia_id, v_inv.casa_de_paz_id);
    END IF;

    UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;
  END LOOP;
END;
$$;

-- ── 3. fn_asignar_cargo_cdp ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_asignar_cargo_cdp(p_cdp_id uuid, p_persona_id uuid, p_codigo text, p_cargo_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_iglesia_id UUID;
  v_red_id UUID;
  v_lider_vigente UUID;
  v_solicitud_id UUID;
  v_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_cdp_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'CDP_INEXISTENTE: la casa de paz no existe' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_id FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_cdp_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_super_admin() OR fn_es_operativo_en(v_iglesia_id) OR fn_es_pastor_en(v_iglesia_id) OR (v_red_id IS NOT NULL AND fn_es_lider_de_red(v_red_id))) THEN
    RAISE EXCEPTION 'CARGO_SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  IF p_codigo = 'LIDER_CDP' AND v_red_id IS NOT NULL AND fn_es_supervisor_en(v_iglesia_id) AND NOT fn_es_lider_de_red(v_red_id) THEN
    SELECT rc.persona_id INTO v_lider_vigente
    FROM red_cargo rc JOIN cargo c ON c.id = rc.cargo_id
    WHERE rc.red_id = v_red_id AND c.codigo = 'LIDER_RED' AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    LIMIT 1;
    IF v_lider_vigente IS NOT NULL THEN
      INSERT INTO solicitud_estructura (iglesia_id, red_id, tipo, payload, solicitante_persona_id)
      VALUES (v_iglesia_id, v_red_id, 'CAMBIAR_LIDER_CDP',
        jsonb_build_object('cdp_id', p_cdp_id, 'persona_id', p_persona_id, 'codigo', p_codigo, 'cargo_id', p_cargo_id),
        fn_mi_persona_id())
      RETURNING id INTO v_solicitud_id;
      PERFORM fn_crear_notificacion(v_lider_vigente, 'SOLICITUD_ESTRUCTURA', 'Solicitud de cambio de Líder de Casa de Paz',
        'El Supervisor pidió designar un nuevo Líder para una Casa de Paz de tu Red. Requiere tu autorización.', 'solicitud_estructura', v_solicitud_id);
      RETURN NULL;
    END IF;
  END IF;

  IF p_codigo = 'LIDER_CDP' THEN
    UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
    WHERE casa_de_paz_id = p_cdp_id AND cargo_id IN (SELECT id FROM cargo WHERE codigo = p_codigo)
      AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;
  END IF;

  INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
  VALUES (v_iglesia_id, p_cdp_id, p_persona_id, p_cargo_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  -- KAN-280: LIDER_CDP y SUBLIDER_CDP son los 2 valores de rol_sistema_enum
  -- que aplican acá (ANFITRION no es un rol de acceso, no tiene valor en
  -- ese enum -- no corresponde crearle usuario_rol).
  IF p_codigo IN ('LIDER_CDP', 'SUBLIDER_CDP') THEN
    PERFORM private.fn_asegurar_usuario_rol_por_cargo(p_persona_id, v_iglesia_id, p_codigo::rol_sistema_enum);
    PERFORM private.fn_asegurar_membresia_cdp_por_cargo(p_persona_id, v_iglesia_id, p_cdp_id);
  END IF;

  RETURN v_id;
END;
$$;

-- ── Backfill: Líderes/Sublíderes YA asignados antes de este fix ─────────────
-- El fix de arriba solo evita el problema hacia adelante -- sin esto, los 65
-- Líderes/Sublíderes vigentes que ya estaban afectados se quedarían sin
-- membresía hasta que alguien les vuelva a asignar el cargo. Mismo criterio
-- de seguridad que el helper: solo se crea membresía si la persona no tiene
-- YA una membresía principal vigente en ninguna CdP (no se mueve a nadie).
-- DISTINCT ON cubre el caso raro de alguien con más de un cargo vigente
-- (ej. Líder Y Sublíder en distintas CdP) -- toma el cargo más antiguo como
-- su CdP "hogar", único criterio determinístico disponible.
INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
SELECT DISTINCT ON (cc.persona_id) cc.iglesia_id, cc.casa_de_paz_id, cc.persona_id, true, cc.fecha_inicio
FROM casa_de_paz_cargo cc
JOIN cargo ca ON ca.id = cc.cargo_id AND ca.codigo IN ('SUBLIDER_CDP', 'LIDER_CDP')
WHERE cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM casa_de_paz_membresia cm
    WHERE cm.persona_id = cc.persona_id AND cm.es_principal AND cm.fecha_fin IS NULL AND cm.fecha_eliminacion IS NULL
  )
ORDER BY cc.persona_id, cc.fecha_inicio ASC;
