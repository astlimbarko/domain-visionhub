-- VisionHub -- 111_fix_moneda_iglesia_y_revertir_reporte.sql
-- Dos bugs de produccion en Casa de Paz, investigados a fondo con el reporte
-- real de un Sublider que no podia enviar su reporte semanal.
--
-- 1) fn_crear_iglesia (62_crear_iglesia_hija_pastor.sql) inserta la iglesia
-- pero nunca la fila correspondiente en iglesia_moneda -- toda iglesia nueva
-- queda con CERO monedas activas desde el dia uno. Eso deja el selector de
-- moneda de Reportes.tsx vacio, moneda_id nunca se completa, y el envio del
-- reporte se bloquea (ver bug 2). Se agrega el INSERT que faltaba, mas un
-- backfill de una sola vez para las iglesias que ya existen hoy con este
-- problema (que son todas -- la funcion nunca lo hizo bien).
--
-- Tambien se agrega fn_activar_moneda: hasta ahora no existia ningun camino,
-- ni en la UI ni en el backend, para que un Pastor/Supervisor active en su
-- iglesia una moneda del catalogo global (moneda) mas alla de la que ya
-- trae por defecto -- el Panel del Supervisor solo dejaba elegir la moneda
-- default entre las que YA estaban en iglesia_moneda. Sigue el mismo patron
-- que fn_toggle_departamento/fn_cambiar_moneda_defecto (fn_es_operativo_en +
-- fn_exigir_pin), y resuelve a mano el upsert contra el indice parcial
-- uq_iglesia_moneda (iglesia_id, moneda_id) WHERE fecha_eliminacion IS NULL,
-- para no dejar dos filas si la moneda ya existio para esa iglesia y fue
-- desactivada antes.
--
-- 2) reporte.service.ts (crearReporte) hace el INSERT de casa_de_paz_reporte
-- confirmado, y recien despues intenta escribir asistencia/ingresos. Si algo
-- de eso falla, el catch revierte el reporte con un UPDATE directo
-- (fecha_eliminacion = now()) que pol_casa_de_paz_reporte_update
-- (16_rls.sql) bloquea para un Sublider salvo que SUBLIDER_PUEDE_EDITAR_REPORTE
-- este prendido (por defecto apagado, seed_02_configuracion.sql). El UPDATE
-- no lanza excepcion (0 filas afectadas, sin .select()), asi que el reporte
-- queda huerfano sin ningun aviso.
--
-- Se agrega fn_revertir_reporte_cdp, que valida el MISMO permiso que dejo
-- crear el reporte (fn_puede_reportar_cdp, igual que pol_casa_de_paz_reporte_insert)
-- con privilegio elevado -- pero a proposito NO se convierte en una via
-- general para que cualquier Sublider borre reportes viejos: exige ademas
-- que quien llama sea quien lo creo (creado_por = auth.uid()) y que el
-- reporte tenga menos de 10 minutos de antiguedad. Dentro de esa ventana muy
-- acotada, revierte tambien la asistencia que ese mismo intento fallido ya
-- haya alcanzado a escribir (el escenario real mas probable es que la
-- asistencia se inserte bien y falle un paso posterior). No hace falta tocar
-- finanzas_ingreso a mano: trg_reporte_cascada_ingresos (14_finanzas.sql) ya
-- lo soft-borra automaticamente en cuanto se setea fecha_eliminacion en
-- casa_de_paz_reporte.

-- ============================================================
-- 1. Fix fn_crear_iglesia + backfill de iglesias existentes
-- ============================================================
CREATE OR REPLACE FUNCTION fn_crear_iglesia(
  p_sufijo VARCHAR,
  p_ciudad VARCHAR,
  p_iglesia_padre_id UUID DEFAULT NULL,
  p_tipo iglesia_tipo_enum DEFAULT 'HIJA',
  p_pastor_usuario_id UUID DEFAULT NULL,
  p_pin TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cobertura_id UUID;
  v_moneda_id UUID;
  v_iglesia_id UUID;
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'IGLESIA_SOLO_SUPER_ADMIN: solo un Super Admin puede crear iglesias'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  IF p_iglesia_padre_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM iglesia WHERE id = p_iglesia_padre_id AND fecha_eliminacion IS NULL
  ) THEN
    RAISE EXCEPTION 'IGLESIA_MADRE_NO_ENCONTRADA: la iglesia madre % no existe', p_iglesia_padre_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_cobertura_id FROM cobertura LIMIT 1;
  SELECT id INTO v_moneda_id FROM moneda WHERE codigo = 'BOB';

  INSERT INTO iglesia (sufijo, ciudad, cobertura_id, moneda_defecto_id, iglesia_padre_id, tipo)
  VALUES (p_sufijo, p_ciudad, v_cobertura_id, v_moneda_id, p_iglesia_padre_id, p_tipo)
  RETURNING id INTO v_iglesia_id;

  -- Bug de produccion (KAN-pendiente): faltaba esta fila -- toda iglesia
  -- nueva quedaba con cero monedas activas, lo que dejaba el selector de
  -- moneda de Reportes.tsx vacio y bloqueaba el envio del reporte semanal.
  INSERT INTO iglesia_moneda (iglesia_id, moneda_id, activa)
  VALUES (v_iglesia_id, v_moneda_id, true);

  IF p_pastor_usuario_id IS NOT NULL THEN
    INSERT INTO usuario_rol (usuario_id, iglesia_id, rol)
    VALUES (p_pastor_usuario_id, v_iglesia_id, 'PASTOR');
  END IF;

  RETURN v_iglesia_id;
END;
$$;

-- Backfill de una sola vez: toda iglesia ya creada antes de este fix que no
-- tenga a su propia moneda_defecto_id activa en iglesia_moneda. Idempotente
-- (el NOT EXISTS evita duplicar si se corre esta migracion mas de una vez).
INSERT INTO iglesia_moneda (iglesia_id, moneda_id, activa)
SELECT i.id, i.moneda_defecto_id, true
FROM iglesia i
WHERE i.fecha_eliminacion IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM iglesia_moneda im
    WHERE im.iglesia_id = i.id AND im.moneda_id = i.moneda_defecto_id AND im.fecha_eliminacion IS NULL
  );

-- ============================================================
-- 2. fn_activar_moneda: Pastor/Supervisor activa una moneda del catalogo
--    global para su iglesia (falta esto en la UI hoy)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_activar_moneda(p_iglesia_id UUID, p_moneda_id UUID, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existente_id UUID;
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  IF NOT EXISTS (SELECT 1 FROM moneda WHERE id = p_moneda_id AND fecha_eliminacion IS NULL AND activo) THEN
    RAISE EXCEPTION 'MONEDA_INEXISTENTE: esa moneda no existe en el catalogo o esta inactiva' USING ERRCODE = 'P0001';
  END IF;

  -- uq_iglesia_moneda es un indice parcial (WHERE fecha_eliminacion IS NULL):
  -- un INSERT ciego duplicaria la fila si esta iglesia ya tuvo esta moneda
  -- alguna vez y la desactivo. Se busca primero (sin filtrar fecha_eliminacion)
  -- para decidir INSERT vs reactivar.
  SELECT id INTO v_existente_id FROM iglesia_moneda
  WHERE iglesia_id = p_iglesia_id AND moneda_id = p_moneda_id
  ORDER BY fecha_eliminacion NULLS FIRST LIMIT 1;

  IF v_existente_id IS NOT NULL THEN
    UPDATE iglesia_moneda SET activa = true, fecha_eliminacion = NULL, eliminado_por = NULL
    WHERE id = v_existente_id;
  ELSE
    INSERT INTO iglesia_moneda (iglesia_id, moneda_id, activa) VALUES (p_iglesia_id, p_moneda_id, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_activar_moneda(UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- 3. fn_revertir_reporte_cdp: reversion segura de un reporte huerfano
--    creado por ESTE MISMO flujo (crearReporte) cuando un paso posterior
--    falla -- acotada para no reabrir el hueco que evitaba
--    pol_casa_de_paz_reporte_update
-- ============================================================
CREATE OR REPLACE FUNCTION fn_revertir_reporte_cdp(p_reporte_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reporte casa_de_paz_reporte;
BEGIN
  SELECT * INTO v_reporte FROM casa_de_paz_reporte WHERE id = p_reporte_id;

  -- Ya no existe, o ya fue revertido antes (ej. reintento del catch): no es
  -- un error, no hay nada que hacer.
  IF v_reporte.id IS NULL OR v_reporte.fecha_eliminacion IS NOT NULL THEN
    RETURN;
  END IF;

  -- Mismo criterio de permiso que dejo crear el reporte (pol_casa_de_paz_reporte_insert).
  IF NOT fn_puede_reportar_cdp(v_reporte.casa_de_paz_id) THEN
    RAISE EXCEPTION 'REPORTE_REVERTIR_SIN_PERMISO: no puede revertir el reporte de esta casa de paz'
      USING ERRCODE = 'P0001';
  END IF;

  -- Acotamiento a proposito, para no reintroducir el hueco que
  -- SUBLIDER_PUEDE_EDITAR_REPORTE evita a proposito: esto NO es una via
  -- general para borrar reportes ajenos ni viejos. Solo revierte un reporte
  -- (a) creado por el mismo usuario que llama, y (b) con menos de 10 minutos
  -- de antiguedad -- la ventana de un intento de guardado que fallo a mitad
  -- de camino, no un reporte real ya asentado.
  IF v_reporte.creado_por IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'REPORTE_REVERTIR_SIN_PERMISO: solo quien creo el reporte puede revertirlo'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reporte.fecha_creacion < now() - INTERVAL '10 minutes' THEN
    RAISE EXCEPTION 'REPORTE_REVERTIR_EXPIRADO: este reporte ya no se puede revertir automaticamente, es demasiado antiguo'
      USING ERRCODE = 'P0001';
  END IF;

  -- Limpieza de lo que este mismo intento fallido ya haya alcanzado a
  -- escribir en casa_de_paz_asistencia (no hay trigger de cascada para esa
  -- tabla, a diferencia de finanzas_ingreso que si se soft-borra solo via
  -- trg_reporte_cascada_ingresos en cuanto se setea fecha_eliminacion abajo).
  UPDATE casa_de_paz_asistencia SET fecha_eliminacion = now()
  WHERE reporte_id = p_reporte_id AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz_reporte SET fecha_eliminacion = now() WHERE id = p_reporte_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_revertir_reporte_cdp(UUID) TO authenticated;
