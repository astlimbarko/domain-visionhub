-- Fix: fn_puede_gestionar_afirmacion (KAN-481, Altar) no incluia el bypass
-- de Super Admin -- unico gate de escritura de Afirmacion en todo el
-- proyecto sin `OR fn_es_super_admin()` (comparar con
-- fn_listar_redes_afirmacion, fn_afirmacion_config_registro_url, etc., que
-- si lo tienen). Reportado en vivo 2026-09-29: un Super Admin (sin fila en
-- usuario_rol por iglesia) recibia "AFIRMACION_SIN_PERMISO" al intentar
-- registrar el Altar de una persona real (Mariana Flores Olivera, iglesia
-- Centro de Vida Montero), sin importar la iglesia.

CREATE OR REPLACE FUNCTION fn_puede_gestionar_afirmacion(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_super_admin()
    OR fn_es_operativo_en(p_iglesia_id)
    OR fn_es_pastor_en(p_iglesia_id)
    OR fn_es_lider_afirmacion_en(p_iglesia_id)
    OR fn_es_colaborador_activo_en(p_iglesia_id, 'AFIRMACION');
$$;
