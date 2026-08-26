-- VisionHub -- KAN-252 (seguimiento): probando en vivo, el owner notó que
-- para una invitación real (Líder de Red/CdP) no había ningún panel detrás
-- del formulario de membresía -- el único botón era "Salir sin completar",
-- que cierra sesión por completo. Es así porque hoy la persona y el cargo
-- real recién se crean cuando se TERMINA el formulario (fn_completar_membresia).
--
-- Decisión (pedido explícito, "crear persona/cargo al aceptar, permitir
-- Saltar"): mover la creación de la Persona (en borrador, sin nombre) y la
-- asignación del cargo real al momento de ACEPTAR la invitación (primer
-- login), no al terminar el formulario. Así, apenas entra, ya tiene un
-- panel real detrás (mismo mecanismo que ya usa el caso general, KAN-179) y
-- "Saltar" lo deja ahí -- el modal vuelve a aparecer en el próximo login
-- hasta que complete la ficha.
--
-- sexo es NOT NULL en persona -- una Persona recién aceptada todavía no
-- declaró su sexo (se pide en la página 1 del formulario). Se relaja a
-- nullable; el flujo de completar membresía (fn_completar_membresia_general)
-- siempre lo termina llenando antes de marcar membresia_completada=true, así
-- que un NULL solo puede existir transitoriamente mientras la ficha sigue
-- incompleta -- mismo estado transitorio que ya tolera primer_nombre=''.
ALTER TABLE persona ALTER COLUMN sexo DROP NOT NULL;

-- fn_mi_iglesia_membresia_general: agrega un fallback para cuando la cuenta
-- no tiene ningún usuario_rol (ese es el mecanismo de Pastor/Supervisor
-- asignado directo) pero SÍ tiene una Persona incompleta ya creada por
-- fn_aceptar_invitacion_lider (mecanismo de Líder de Red/CdP vía invitación).
-- Sin este fallback, el caso general no encontraba la iglesia para estas
-- personas y el modal nunca se resolvía en "general" tras aceptar.
CREATE OR REPLACE FUNCTION public.fn_mi_iglesia_membresia_general()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ur.iglesia_id FROM usuario_rol ur
     WHERE ur.usuario_id = auth.uid() AND ur.rol <> 'SUPER_ADMIN' AND ur.fecha_eliminacion IS NULL
     ORDER BY ur.fecha_creacion ASC LIMIT 1),
    (SELECT p.iglesia_id FROM persona p
     WHERE p.usuario_id = auth.uid() AND p.membresia_completada = false AND p.fecha_eliminacion IS NULL
     LIMIT 1)
  );
$$;

-- fn_aceptar_invitacion_lider: se llama una sola vez, apenas se detecta una
-- invitación PENDIENTE para la cuenta (construirSesionDesdeAuth.ts, antes de
-- mostrar el modal). Idempotente -- si ya existe una Persona para la cuenta,
-- o no hay ninguna invitación pendiente, no hace nada. Mismo switch de
-- cargos que fn_completar_membresia (incluido el caso SUBLIDER_RED de
-- KAN-245: un Líder de Red no cierra su propio cargo al sumar un Sublíder),
-- factorizado acá porque el cargo ahora se otorga en este paso, no al
-- terminar el formulario.
CREATE OR REPLACE FUNCTION public.fn_aceptar_invitacion_lider()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
    RETURN;
  END IF;

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, primer_apellido, membresia_completada)
  VALUES (v_inv.iglesia_id, auth.uid(), '', '', false)
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

  ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_aceptar_invitacion_lider() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_aceptar_invitacion_lider() TO authenticated;

-- fn_completar_membresia (invitación) queda sin uso desde el frontend --
-- después de este cambio la Persona y el cargo ya existen desde el accept,
-- así que el flujo pasa siempre por fn_completar_membresia_general (mismo
-- mecanismo que el caso general, KAN-179). No se elimina de la base por las
-- dudas, pero MembresiaObligatoria.tsx deja de llamarla.
