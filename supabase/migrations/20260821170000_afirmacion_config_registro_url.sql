-- VisionHub -- pedido explicito del owner (2026-08-21): "REGISTRO_URL_ACTIVO"
-- (interruptor general por iglesia para el registro publico por URL) solo se
-- podia ver/cambiar desde el Panel de Configuracion del Supervisor/Pastor --
-- si alguien trabajaba en el panel de Afirmacion (URL de membresia) y todos
-- los enlaces individuales estaban en ACTIVO, no habia forma de notar desde
-- ahi que el interruptor general seguia apagado ("Enlace no disponible" sin
-- pista visible). Se agrega una RPC de lectura para mostrar el estado actual
-- directamente en el panel de Afirmacion -- el cambio en si sigue yendo por
-- fn_set_configuracion (ya exige ser Pastor/Supervisor, sin tocar eso).
CREATE OR REPLACE FUNCTION public.fn_afirmacion_config_registro_url(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (fn_es_lider_afirmacion_en(p_iglesia_id) OR fn_es_operativo_en(p_iglesia_id) OR fn_es_pastor_en(p_iglesia_id)) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN fn_config_bool(p_iglesia_id, 'REGISTRO_URL_ACTIVO');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_config_registro_url(UUID) TO authenticated;
