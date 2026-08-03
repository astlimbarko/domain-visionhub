-- VisionHub -- 89_super_admin_puede_invitar_lider.sql
-- Bug real encontrado 2026-08-02 (reportado por el owner: "cuando quiero
-- invitar por correo me sale que no se puede"): fn_puede_invitar_lider (la
-- que usa el edge function invitar-lider para Lider de Red/CdP/Sublider de
-- CdP) solo reconocia fn_es_operativo_en (Supervisor) o ser Lider de esa Red
-- puntual -- nunca incluyo a Super Admin, a diferencia de su funcion hermana
-- fn_puede_invitar (63_pastor_gestion_supervisor.sql), que si lo hace
-- explicito ("fn_es_super_admin() OR ..."). Un Super Admin -- el nivel de
-- mayor privilegio del sistema -- no podia invitar un Lider/Sublider de CdP.
-- Mismo signature (parametro nuevo con DEFAULT desde 71_), CREATE OR REPLACE
-- alcanza.

CREATE OR REPLACE FUNCTION fn_puede_invitar_lider(
  p_rol rol_sistema_enum, p_red_id UUID, p_casa_de_paz_id UUID, p_departamento_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_red_de_cdp UUID;
BEGIN
  IF fn_es_super_admin() THEN RETURN true; END IF;

  IF p_departamento_id IS NOT NULL THEN
    SELECT iglesia_id INTO v_iglesia_id FROM departamento WHERE id = p_departamento_id;
    RETURN v_iglesia_id IS NOT NULL AND fn_es_operativo_en(v_iglesia_id);
  END IF;

  IF p_rol = 'LIDER_RED' THEN
    IF p_red_id IS NULL THEN RETURN false; END IF;
    SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_red_id;
    RETURN v_iglesia_id IS NOT NULL AND fn_es_operativo_en(v_iglesia_id);

  ELSIF p_rol IN ('LIDER_CDP', 'SUBLIDER_CDP') THEN
    IF p_casa_de_paz_id IS NULL THEN RETURN false; END IF;
    SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_casa_de_paz_id;
    IF v_iglesia_id IS NULL THEN RETURN false; END IF;
    IF fn_es_operativo_en(v_iglesia_id) THEN RETURN true; END IF;

    SELECT cr.red_id INTO v_red_de_cdp FROM casa_de_paz_red cr
    WHERE cr.casa_de_paz_id = p_casa_de_paz_id AND cr.fecha_eliminacion IS NULL;
    RETURN v_red_de_cdp IS NOT NULL AND fn_es_lider_de_red(v_red_de_cdp);

  ELSE
    RETURN false;
  END IF;
END;
$$;
