-- VisionHub -- KAN-253 (pedido del owner, 2026-08-23): fn_eliminar_cuenta_usuario
-- solo marcaba fecha_eliminacion en `persona` y `usuario_rol` -- si la cuenta
-- tenia un cargo de Lider/Sublider de Red o Casa de Paz vigente (red_cargo/
-- casa_de_paz_cargo/departamento_cargo, tablas separadas de usuario_rol),
-- ese cargo quedaba "fantasma": seguia apareciendo activo en el Constructor
-- y en Gestion de Red, apuntando a una persona ya eliminada.
--
-- Fix: ademas de persona/usuario_rol, cierra (fecha_fin = hoy) cualquier
-- cargo vigente de Red/CdP/Departamento de TODAS las personas (todas las
-- iglesias) ligadas a esa cuenta -- mismo mecanismo que ya usa "Quitar
-- cargo" en el resto de la app (quitarCargoRed/quitarCargoCdp en
-- casas-de-paz.service.ts: solo fecha_fin, no fecha_eliminacion en la fila
-- del cargo -- ese campo se reserva para corregir un alta hecha por error,
-- no aplica aca).
--
-- Misma firma que la version anterior (20260810010000) -- CREATE OR REPLACE
-- alcanza, no cambia RETURNS ni parametros.
CREATE OR REPLACE FUNCTION public.fn_eliminar_cuenta_usuario(p_usuario_id UUID, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'USUARIO_SOLO_SUPER_ADMIN: solo un Super Admin puede eliminar cuentas'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOMODIFICACION: no podes eliminar tu propia cuenta'
      USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM usuario_rol WHERE usuario_id = p_usuario_id AND rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL
  ) THEN
    IF NOT fn_es_super_admin_principal() THEN
      RAISE EXCEPTION 'SUPER_ADMIN_SOLO_PRINCIPAL: solo el Super Admin principal puede eliminar a otro Super Admin'
        USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM usuario_rol WHERE rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL) <= 1 THEN
      RAISE EXCEPTION 'ULTIMO_SUPER_ADMIN: no se puede eliminar al unico Super Admin del sistema'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM fn_exigir_pin(p_pin);

  UPDATE usuario_rol SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE usuario_id = p_usuario_id AND fecha_eliminacion IS NULL;

  UPDATE red_cargo SET fecha_fin = CURRENT_DATE
  WHERE persona_id IN (SELECT id FROM persona WHERE usuario_id = p_usuario_id)
    AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz_cargo SET fecha_fin = CURRENT_DATE
  WHERE persona_id IN (SELECT id FROM persona WHERE usuario_id = p_usuario_id)
    AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE departamento_cargo SET fecha_fin = CURRENT_DATE
  WHERE persona_id IN (SELECT id FROM persona WHERE usuario_id = p_usuario_id)
    AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE persona SET fecha_eliminacion = now(), eliminado_por = auth.uid()
  WHERE usuario_id = p_usuario_id AND fecha_eliminacion IS NULL;
END;
$$;
