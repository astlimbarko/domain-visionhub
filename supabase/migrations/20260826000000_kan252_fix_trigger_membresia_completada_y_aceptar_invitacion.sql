-- VisionHub -- KAN-252 (seguimiento, fix urgente): al probar el login con
-- Google se encontro que fn_validar_campos_membresia_persona (trigger BEFORE
-- INSERT OR UPDATE en persona) exige CI/fecha_nacimiento cuando la iglesia
-- los tiene obligatorios, SIN importar si la persona esta completa o es un
-- borrador en progreso. Antes pasaba desapercibido porque CI/fecha_nacimiento
-- eran 'false' por defecto en todas las iglesias -- las migraciones de HOY
-- (20260825170000, 20260825190000) los subieron a 'true' para todas, lo que
-- rompio el guardado progresivo del CASO GENERAL (fn_guardar_paso_membresia_
-- general, paso 1 crea la Persona solo con nombre/apellido/sexo, CI y fecha
-- de nacimiento se piden recien en la pagina 2) para TODAS las iglesias, no
-- solo para el cambio nuevo de invitaciones. Se corrige agregando la
-- condicion NEW.membresia_completada a esos 2 chequeos -- primer_nombre/
-- primer_apellido siguen exigidos siempre (eso nunca fue el problema).
CREATE OR REPLACE FUNCTION public.fn_validar_campos_membresia_persona()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF btrim(NEW.primer_nombre) = '' THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "primer_nombre" no puede estar vacío' USING ERRCODE = 'P0001';
  END IF;

  IF btrim(NEW.primer_apellido) = '' THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "primer_apellido" no puede estar vacío' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.membresia_completada AND fn_config_bool(NEW.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO') AND NEW.ci IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "ci" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.membresia_completada AND fn_config_bool(NEW.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO') AND NEW.fecha_nacimiento IS NULL THEN
    RAISE EXCEPTION 'CAMPO_OBLIGATORIO: el campo "fecha_nacimiento" es obligatorio en esta iglesia' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- fn_aceptar_invitacion_lider: mismo trigger de arriba tambien bloqueaba la
-- version anterior de esta funcion (creaba la Persona con nombre/apellido
-- vacios). Se cambia de diseño: en vez de aceptar "en blanco" apenas se
-- loguea, se acepta recien cuando la persona completa la pagina 1 del wizard
-- ("Tu nombre" -- nombre/apellido/sexo reales, ya validados por el propio
-- formulario), que es exactamente lo mismo que ya exige el trigger. Recibe
-- esos datos como parametros en vez de nada.
CREATE OR REPLACE FUNCTION public.fn_aceptar_invitacion_lider(
  p_primer_nombre TEXT, p_segundo_nombre TEXT, p_primer_apellido TEXT, p_segundo_apellido TEXT, p_sexo TEXT
)
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

  ELSIF v_inv.rol = 'SUBLIDER_CDP' THEN
    INSERT INTO casa_de_paz_cargo (iglesia_id, casa_de_paz_id, persona_id, cargo_id, fecha_inicio)
    VALUES (v_inv.iglesia_id, v_inv.casa_de_paz_id, v_persona_id, v_inv.cargo_id, CURRENT_DATE);
  END IF;

  UPDATE invitacion_lider SET estado = 'COMPLETADA', fecha_completada = now() WHERE id = v_inv.id;

  PERFORM fn_resolver_invitaciones_pendientes_extra(v_persona_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_aceptar_invitacion_lider(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_aceptar_invitacion_lider(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- La firma vieja (sin parametros) queda huerfana -- se borra para no dejar 2
-- versiones de la misma funcion coexistiendo (Postgres permite overloads,
-- pero acá no hay ningun llamador que la siga necesitando).
DROP FUNCTION IF EXISTS public.fn_aceptar_invitacion_lider();
