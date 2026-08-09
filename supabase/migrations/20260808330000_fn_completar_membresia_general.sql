-- VisionHub -- KAN-126: completar Membresia al ingresar a VisionHub.
--
-- Autorizacion explicita del owner (Matias, en chat, 2026-08-09) para tocar
-- auth.store.ts en esta sesion puntual, despues de que se le explicara el
-- riesgo (choque potencial con el refactor paralelo de sesion/roles de
-- Gonzalo en codex/refactorizacion-multirol, KAN-129). PrivateLayout.tsx NO
-- se toca -- no hizo falta: ya gatea con "if (membresiaPendiente) return
-- <MembresiaObligatoria .../>" sin importar el origen del dato, alcanza con
-- ampliar que devuelve auth.store.ts (fn_mi_membresia_incompleta, ya
-- desplegada en 20260808290000) y MembresiaObligatoria.tsx.
--
-- fn_completar_membresia (42_invitacion_lideres.sql) exige una fila en
-- invitacion_lider -- no sirve para el caso general de KAN-126 (usuario_rol
-- vigente sin invitacion, Q-8 en KAN-123). Esta funcion es el equivalente
-- para ese caso: crea la Persona vinculada al usuario, sin asignar ningun
-- cargo nuevo (el usuario ya tiene su rol vigente en usuario_rol, no depende
-- de que exista Persona).

begin;

create or replace function public.fn_completar_membresia_general(p_datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rol RECORD;
  v_persona_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM persona WHERE usuario_id = auth.uid() AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'MEMBRESIA_YA_COMPLETADA: ya existe una persona para este usuario' USING ERRCODE = 'P0001';
  END IF;

  -- Mismo criterio que fn_mi_membresia_incompleta (Q-8): cualquier usuario_rol
  -- vigente que no sea SUPER_ADMIN habilita este camino.
  SELECT ur.iglesia_id INTO v_rol
  FROM usuario_rol ur
  WHERE ur.usuario_id = auth.uid() AND ur.rol <> 'SUPER_ADMIN' AND ur.fecha_eliminacion IS NULL
  ORDER BY ur.fecha_creacion ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBRESIA_GENERAL_SIN_ROL: no se encontro un rol vigente que requiera completar la membresia'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                        sexo, fecha_nacimiento, ci, correo)
  VALUES (v_rol.iglesia_id, auth.uid(), p_datos->>'primer_nombre', p_datos->>'segundo_nombre',
          p_datos->>'primer_apellido', p_datos->>'segundo_apellido',
          (p_datos->>'sexo')::sexo_enum, (p_datos->>'fecha_nacimiento')::date,
          p_datos->>'ci', p_datos->>'correo')
  RETURNING id INTO v_persona_id;

  INSERT INTO persona_detalle (persona_id, estado_civil, grado_instruccion, ocupacion, nacimiento_ciudad)
  VALUES (v_persona_id, (p_datos->>'estado_civil')::estado_civil_enum,
          (p_datos->>'grado_instruccion')::grado_instruccion_enum,
          p_datos->>'ocupacion', p_datos->>'nacimiento_ciudad');

  -- KAN-123: campos ampliados, incluye Ministerios (usuario autenticado, iglesia ya resuelta).
  PERFORM fn_guardar_membresia_extendida(v_persona_id, v_rol.iglesia_id, p_datos);

  RETURN jsonb_build_object(
    'nombre_completo', (SELECT fn_nombre_completo(p) FROM persona p WHERE p.id = v_persona_id),
    'destino', NULL
  );
END;
$$;

grant execute on function public.fn_completar_membresia_general(jsonb) to authenticated;

commit;
