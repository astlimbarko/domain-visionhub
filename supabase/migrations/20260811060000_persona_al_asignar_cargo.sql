-- VisionHub -- KAN-173: permitir cargar los datos minimos de Persona (nombre,
-- apellido, sexo) en el mismo momento de asignar un cargo con iglesia
-- (Pastor/Supervisor de Vision en Accion) desde el panel de administracion,
-- en vez de depender exclusivamente del gate de "completar membresia" al
-- iniciar sesion.
--
-- Bug real encontrado por el owner (2026-08-11): fn_mi_membresia_incompleta
-- y fn_completar_membresia_general chequean "existe alguna Persona para este
-- usuario_id" GLOBAL, sin filtrar por iglesia -- pero Persona esta modelada
-- por iglesia_id. Resultado: una cuenta que ya tiene Persona en una iglesia
-- (ej. Pastor en Centro de Vida El Eden) y despues recibe un segundo cargo en
-- OTRA iglesia (ej. Supervisor en Centro de Vida Montero) NUNCA vuelve a
-- pasar por el gate de membresia para esa segunda iglesia -- fn_listar_usuarios
-- la muestra para siempre como "sin persona asociada todavia", sin que nadie
-- lo note salvo mirando la lista de Usuarios. Mismo patron reproducido en el
-- camino de invitar-usuario/index.ts cuando el correo ya existe
-- (fn_correo_tiene_persona tambien es global, no por iglesia).
--
-- Solucion elegida (acotada, sin tocar el gate de membresia en si, que sigue
-- sirviendo para el alta normal por invitacion): el admin que asigna el cargo
-- puede opcionalmente cargar nombre/apellido/sexo ahi mismo. Si los datos
-- vienen y todavia no existe Persona para ese usuario_id+iglesia_id, se crea
-- de una vez -- sin reemplazar ni tocar Personas ya existentes.

CREATE OR REPLACE FUNCTION public.fn_crear_persona_si_falta(
  p_usuario_id UUID,
  p_iglesia_id UUID,
  p_primer_nombre VARCHAR,
  p_primer_apellido VARCHAR,
  p_sexo sexo_enum
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_primer_nombre IS NULL OR trim(p_primer_nombre) = ''
     OR p_primer_apellido IS NULL OR trim(p_primer_apellido) = ''
     OR p_sexo IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM persona
    WHERE usuario_id = p_usuario_id AND iglesia_id = p_iglesia_id AND fecha_eliminacion IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, primer_apellido, sexo, correo, creado_por)
  VALUES (
    p_iglesia_id, p_usuario_id, trim(p_primer_nombre), trim(p_primer_apellido), p_sexo,
    (SELECT email FROM auth.users WHERE id = p_usuario_id),
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_crear_persona_si_falta(UUID, UUID, VARCHAR, VARCHAR, sexo_enum) TO authenticated, service_role;

-- fn_crear_usuario_rol: asignar cargo a una cuenta EXISTENTE (modo "Buscar
-- existente" de InvitarUsuarioDialog). Se recrea con 3 parametros nuevos,
-- todos opcionales (DEFAULT NULL) -- las llamadas existentes que no los
-- mandan siguen funcionando exactamente igual que antes.
DROP FUNCTION IF EXISTS public.fn_crear_usuario_rol(UUID, rol_sistema_enum, UUID, TEXT);

CREATE FUNCTION public.fn_crear_usuario_rol(
  p_usuario_id UUID,
  p_rol rol_sistema_enum,
  p_iglesia_id UUID,
  p_pin TEXT DEFAULT NULL,
  p_persona_primer_nombre VARCHAR DEFAULT NULL,
  p_persona_primer_apellido VARCHAR DEFAULT NULL,
  p_persona_sexo sexo_enum DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)))) THEN
    RAISE EXCEPTION 'USUARIO_ROL_SIN_PERMISO: no tenes permiso para invitar usuarios aqui' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO usuario_rol (usuario_id, rol, iglesia_id) VALUES (p_usuario_id, p_rol, p_iglesia_id);

  IF p_iglesia_id IS NOT NULL THEN
    PERFORM fn_crear_persona_si_falta(p_usuario_id, p_iglesia_id, p_persona_primer_nombre, p_persona_primer_apellido, p_persona_sexo);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_crear_usuario_rol(UUID, rol_sistema_enum, UUID, TEXT, VARCHAR, VARCHAR, sexo_enum) TO authenticated, service_role;

-- fn_asignar_rol_recien_invitado: mismo agregado para el camino server-side
-- de invitar-usuario/index.ts cuando el correo invitado ya tenia cuenta
-- (KAN-156) -- hoy solo asignaba el cargo, nunca creaba Persona para la
-- iglesia nueva.
DROP FUNCTION IF EXISTS public.fn_asignar_rol_recien_invitado(UUID, rol_sistema_enum, UUID);

CREATE FUNCTION public.fn_asignar_rol_recien_invitado(
  p_usuario_id UUID,
  p_rol rol_sistema_enum,
  p_iglesia_id UUID,
  p_persona_primer_nombre VARCHAR DEFAULT NULL,
  p_persona_primer_apellido VARCHAR DEFAULT NULL,
  p_persona_sexo sexo_enum DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND (fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)))) THEN
    RAISE EXCEPTION 'USUARIO_ROL_SIN_PERMISO: no tenes permiso para invitar usuarios aqui' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO usuario_rol (usuario_id, rol, iglesia_id) VALUES (p_usuario_id, p_rol, p_iglesia_id);

  IF p_iglesia_id IS NOT NULL THEN
    PERFORM fn_crear_persona_si_falta(p_usuario_id, p_iglesia_id, p_persona_primer_nombre, p_persona_primer_apellido, p_persona_sexo);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_asignar_rol_recien_invitado(UUID, rol_sistema_enum, UUID, VARCHAR, VARCHAR, sexo_enum) TO authenticated, service_role;
