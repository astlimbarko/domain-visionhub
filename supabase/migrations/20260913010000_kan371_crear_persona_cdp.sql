-- VisionHub -- kan371_crear_persona_cdp.sql
-- KAN-371: alta rapida de persona con datos principales, para el Lider de
-- Casa de Paz -- CrearPersonaDialog.tsx ya existia (usado hoy solo por
-- Supervisor/Pastor en la busqueda global) pero solo crea la persona, sin
-- membresia -- para el Lider de CdP el punto es que la persona quede como
-- miembro de SU CdP. Una sola RPC transaccional (mismo criterio de
-- KAN-277: si el insert de membresia falla, no debe quedar una persona
-- huerfana). SECURITY INVOKER a proposito: reusa las RLS ya existentes de
-- persona (cualquiera de la iglesia) y casa_de_paz_membresia
-- (fn_es_lider_cdp) en vez de duplicar el chequeo de permiso aca -- por
-- eso hoy queda acotado a Lider, no a Sublider (pol_casa_de_paz_membresia_insert
-- no incluye fn_es_sublider_cdp).

CREATE OR REPLACE FUNCTION public.fn_crear_persona_cdp(p_datos JSONB, p_casa_de_paz_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_persona_id UUID;
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'CDP_NO_ENCONTRADA: la Casa de Paz no existe' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona (iglesia_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento, ci, correo, membresia_completada)
  VALUES (
    v_iglesia_id,
    p_datos->>'primer_nombre',
    NULLIF(p_datos->>'segundo_nombre', ''),
    p_datos->>'primer_apellido',
    NULLIF(p_datos->>'segundo_apellido', ''),
    (p_datos->>'sexo')::sexo_enum,
    NULLIF(p_datos->>'fecha_nacimiento', '')::DATE,
    NULLIF(p_datos->>'ci', ''),
    NULLIF(p_datos->>'correo', ''),
    false
  )
  RETURNING id INTO v_persona_id;

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  VALUES (v_iglesia_id, p_casa_de_paz_id, v_persona_id, true, current_date);

  RETURN v_persona_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_crear_persona_cdp(JSONB, UUID) TO authenticated;
