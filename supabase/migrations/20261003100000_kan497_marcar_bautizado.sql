-- KAN-497: registrar un bautismo sobre la persona EXISTENTE, marcando el dato
-- con la estructura que ya existe (persona_detalle.bautizado + fecha del
-- bautismo). No crea persona ni membresía: el bautismo no implica membresía
-- (la membresía la completa el formulario de Membresía de Nuevos).
CREATE OR REPLACE FUNCTION public.fn_afirmacion_marcar_bautizado(
  p_persona_id uuid,
  p_iglesia_id uuid,
  p_fecha date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT fn_puede_gestionar_afirmacion(p_iglesia_id) THEN
    RAISE EXCEPTION 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM persona WHERE id = p_persona_id AND iglesia_id = p_iglesia_id
                 AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'BAUTISMO_PERSONA_INVALIDA: la persona no existe en esta iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO persona_detalle (persona_id, bautizado, bautismo_anio, bautismo_mes, bautismo_dia)
  VALUES (p_persona_id, true,
          EXTRACT(YEAR FROM p_fecha)::smallint,
          EXTRACT(MONTH FROM p_fecha)::smallint,
          EXTRACT(DAY FROM p_fecha)::smallint)
  ON CONFLICT (persona_id) DO UPDATE SET
    bautizado = true,
    bautismo_anio = EXCLUDED.bautismo_anio,
    bautismo_mes = EXCLUDED.bautismo_mes,
    bautismo_dia = EXCLUDED.bautismo_dia;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_afirmacion_marcar_bautizado(uuid, uuid, date) TO authenticated;
