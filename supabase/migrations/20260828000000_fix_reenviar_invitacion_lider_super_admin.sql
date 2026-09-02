-- VisionHub -- fix: "Reenviar invitación" (mecanismo viejo, invitacion_lider
-- todavía PENDIENTE) fallaba con 403 "No tenes permiso, o la invitación ya
-- no está pendiente" para Super Admin.
--
-- Causa: fn_correo_invitacion_lider_si_puedo_gestionar (harness/11-esquema-bd/
-- sql/42_invitacion_lideres.sql, diseño original -- no es una regresión de
-- esta semana) nunca incluyó fn_es_super_admin() en su chequeo de permiso,
-- a diferencia de fn_puede_invitar_lider (el flujo "Invitar por correo"
-- nuevo, que sí lo tiene) y de private.fn_estructura_puede_administrar (el
-- del Constructor). Un Super Admin sin cargo operativo/pastor/líder de red
-- directo en la iglesia/red/CdP de esa invitación puntual quedaba sin poder
-- reenviarla -- justo el caso más común al usar el Constructor como owner.
--
-- Fix aditivo: se agrega fn_es_super_admin() como rama OR más, sin tocar
-- ninguna de las demás (fn_es_operativo_en/fn_es_pastor_en/fn_es_lider_de_red/
-- fn_es_lider_cdp), ni el chequeo de estado='PENDIENTE'. No quita permisos a
-- nadie, solo agrega el que faltaba.

CREATE OR REPLACE FUNCTION public.fn_correo_invitacion_lider_si_puedo_gestionar(p_invitacion_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invitacion_lider;
  v_puede BOOLEAN;
BEGIN
  SELECT * INTO v_inv FROM invitacion_lider WHERE id = p_invitacion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND OR v_inv.estado <> 'PENDIENTE' THEN RETURN NULL; END IF;

  v_puede := fn_es_super_admin()
    OR fn_es_operativo_en(v_inv.iglesia_id)
    OR fn_es_pastor_en(v_inv.iglesia_id)
    OR (v_inv.red_id IS NOT NULL AND fn_es_lider_de_red(v_inv.red_id))
    OR (v_inv.casa_de_paz_id IS NOT NULL AND fn_es_lider_cdp(v_inv.casa_de_paz_id))
    OR (v_inv.casa_de_paz_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM casa_de_paz_red cr WHERE cr.casa_de_paz_id = v_inv.casa_de_paz_id
            AND cr.fecha_eliminacion IS NULL AND fn_es_lider_de_red(cr.red_id)
        ));

  IF NOT v_puede THEN RETURN NULL; END IF;
  RETURN v_inv.correo;
END;
$$;
