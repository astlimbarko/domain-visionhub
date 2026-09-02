-- VisionHub -- personas con rol (Pastor/Supervisor de Vision en Accion,
-- asignados directo desde el Constructor) se crean via fn_crear_persona_si_
-- falta (20260811060000). Esa funcion nunca seteaba membresia_completada en
-- el INSERT, asi que tomaba el DEFAULT true de la columna -- quedaban
-- marcadas "Completa" en Afirmacion (y nunca se les volvia a pedir el dato
-- al iniciar sesion, fn_mi_membresia_incompleta las veia ya "true") aunque
-- la Persona solo tuviera nombre/apellido/sexo/correo: sin CI, sin fecha de
-- nacimiento, sin la fila de persona_detalle que crea el wizard de membresia,
-- sin telefono ni ministerio declarados.
--
-- Fix 1: la funcion ahora inserta membresia_completada = false explicito --
-- mismo patron que fn_aceptar_invitacion_lider (KAN-252) y el fix de leads
-- de evangelismo/reportes/directorio (KAN-275).
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

  INSERT INTO persona (iglesia_id, usuario_id, primer_nombre, primer_apellido, sexo, correo, creado_por, membresia_completada)
  VALUES (
    p_iglesia_id, p_usuario_id, trim(p_primer_nombre), trim(p_primer_apellido), p_sexo,
    (SELECT email FROM auth.users WHERE id = p_usuario_id),
    auth.uid(), false
  );
END;
$$;

-- Fix 2 (backfill): corrige las Personas que ya quedaron mal marcadas por
-- este camino. Criterio acotado a proposito -- no toca la base de miembros
-- en general, solo filas que calzan con la firma exacta de este bug:
--   - membresia_completada = true (el estado incorrecto)
--   - sin CI y sin fecha_nacimiento (fn_crear_persona_si_falta nunca los pide)
--   - sin fila en persona_detalle (ningun paso del wizard de membresia corrio)
--   - tiene un cargo/rol vigente (es "alguien con rol", no cualquier lead)
-- Excluye SUPER_ADMIN a proposito, mismo criterio que KAN-266: esas cuentas
-- ya estan excluidas del gate por rol de sesion (fn_mi_membresia_incompleta /
-- fn_mi_actualizacion_membresia_pendiente), no corresponde tocarles el dato.
UPDATE persona p
SET membresia_completada = false
WHERE p.membresia_completada = true
  AND p.fecha_eliminacion IS NULL
  AND p.ci IS NULL
  AND p.fecha_nacimiento IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM persona_detalle pd WHERE pd.persona_id = p.id AND pd.fecha_eliminacion IS NULL
  )
  AND (
    EXISTS (
      SELECT 1 FROM usuario_rol ur
      WHERE ur.usuario_id = p.usuario_id AND ur.iglesia_id = p.iglesia_id
        AND ur.rol <> 'SUPER_ADMIN' AND ur.fecha_eliminacion IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM casa_de_paz_cargo cc
      WHERE cc.persona_id = p.id AND cc.fecha_fin IS NULL AND cc.fecha_eliminacion IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM red_cargo rc
      WHERE rc.persona_id = p.id AND rc.fecha_fin IS NULL AND rc.fecha_eliminacion IS NULL
    )
  );
