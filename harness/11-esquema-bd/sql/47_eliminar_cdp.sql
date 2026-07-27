-- VisionHub -- 47_eliminar_cdp.sql
-- Bug real reportado por el owner (2026-07-26): un Lider de Red con permiso
-- para Activar/Desactivar una Casa de Paz de su propia Red (pol_casa_de_paz_update,
-- via fn_es_rol_superior_de_cdp) recibia "permission denied"/RLS al intentar
-- el nuevo boton "Eliminar", que ademas de `activo=false` marca `fecha_eliminacion`.
--
-- Causa: el UPDATE directo a `casa_de_paz` dispara el trigger
-- trg_cdp_desactivacion_cierra_membresias (fn_cdp_desactivacion_cierra_membresias,
-- SIN SECURITY DEFINER), que a su vez hace UPDATE sobre casa_de_paz_membresia.
-- Esa tabla solo permite UPDATE a fn_es_operativo_en/fn_es_lider_cdp/fn_es_sublider_cdp
-- (pol_casa_de_paz_membresia_update, 27_permisos_estructura.sql) -- un Lider de
-- Red NO esta en esa lista, aunque si pueda operar la CdP en si. Mismo patron
-- de fondo que ya resolvieron fn_fusionar_cdp / fn_multiplicar_cdp: la baja
-- logica de una CdP pasa por una funcion SECURITY DEFINER que valida permiso
-- una sola vez arriba y despues escribe todo lo necesario con privilegio
-- elevado, en vez de depender de que cada tabla hija tenga la misma policy.

CREATE OR REPLACE FUNCTION fn_eliminar_cdp(p_casa_de_paz_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM casa_de_paz WHERE id = p_casa_de_paz_id AND fecha_eliminacion IS NULL) THEN
    RAISE EXCEPTION 'CDP_INEXISTENTE: esa casa de paz no existe o ya fue eliminada' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_es_rol_superior_de_cdp(p_casa_de_paz_id) THEN
    RAISE EXCEPTION 'CDP_ELIMINAR_SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;

  UPDATE casa_de_paz_membresia
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_casa_de_paz_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz
  SET activo = false, fecha_eliminacion = now()
  WHERE id = p_casa_de_paz_id;
END;
$$;
