-- VisionHub -- 30_fusiones_y_pin.sql
-- Pedido del owner (2026-07-19): fusionar Casas de Paz y Redes, con ventana
-- para deshacer, motivo obligatorio en todo cambio de fusion/configuracion,
-- y un PIN de 6 digitos adicional para Super Admin en todo cambio de
-- configuracion del sistema.
--
-- Simplificacion consciente sobre la ventana de deshacer: el pedido original
-- decia "hasta 7 dias antes de la primera reunion fusionada". El sistema no
-- tiene ningun concepto de "proxima reunion programada" -- los Reportes se
-- registran despues de que la reunion ya paso, nunca se agenda una fecha
-- futura. Sin ese dato no hay forma real de calcular "7 dias antes de una
-- reunion que todavia no existe". Se implementa como una ventana fija de 7
-- dias corridos desde la fusion, para Casas de Paz y para Redes por igual
-- (coincide con lo que el owner ya eligio explicitamente para Redes). Si
-- mas adelante el Calendario agrega reuniones programadas de antemano, esto
-- se puede afinar.

-- ============================================================
-- 1. PIN de Super Admin
-- ============================================================
CREATE TABLE usuario_pin (
  usuario_id           UUID PRIMARY KEY REFERENCES auth.users(id),
  pin_hash             TEXT NOT NULL,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ
);

ALTER TABLE usuario_pin ENABLE ROW LEVEL SECURITY;

-- Solo lectura de la propia fila (para saber "tengo PIN configurado o no");
-- escribir el PIN siempre pasa por fn_establecer_pin (hashea con crypt()).
CREATE POLICY pol_usuario_pin_select ON usuario_pin
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

CREATE OR REPLACE FUNCTION fn_tengo_pin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM usuario_pin WHERE usuario_id = auth.uid());
$$;

-- SET search_path = public, extensions: pgcrypto (crypt/gen_salt) vive en
-- el esquema extensions en Supabase, no en public. Sin extensions en el
-- search_path, crypt() no se encuentra ("function crypt(text, text) does
-- not exist") -- encontrado al probar el PIN por primera vez.
CREATE OR REPLACE FUNCTION fn_establecer_pin(p_pin_nuevo TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'PIN_SOLO_SUPER_ADMIN: el PIN es exclusivo de Super Admin'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_pin_nuevo !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN_FORMATO_INVALIDO: el PIN debe tener exactamente 6 digitos'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO usuario_pin (usuario_id, pin_hash, fecha_actualizacion)
  VALUES (auth.uid(), crypt(p_pin_nuevo, gen_salt('bf')), now())
  ON CONFLICT (usuario_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, fecha_actualizacion = now();
END;
$$;

CREATE OR REPLACE FUNCTION fn_verificar_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_hash TEXT;
BEGIN
  SELECT pin_hash INTO v_hash FROM usuario_pin WHERE usuario_id = auth.uid();
  IF v_hash IS NULL THEN RETURN false; END IF;
  RETURN crypt(COALESCE(p_pin, ''), v_hash) = v_hash;
END;
$$;

-- Helper que las funciones de escritura llaman al principio: si el que
-- llama es Super Admin, exige un PIN correcto. Cualquier otro rol sigue
-- exactamente igual que antes -- el PIN es una capa extra solo para Super
-- Admin, no un requisito nuevo para Pastor/Supervisor.
CREATE OR REPLACE FUNCTION fn_exigir_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF fn_es_super_admin() THEN
    IF NOT fn_verificar_pin(p_pin) THEN
      RAISE EXCEPTION 'PIN_INCORRECTO: el PIN de confirmacion es incorrecto o no esta configurado'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 2. Cerrar un hueco real encontrado de paso: fn_set_configuracion no
-- verificaba NINGUN permiso -- al ser SECURITY DEFINER, cualquier usuario
-- autenticado podia cambiar cualquier configuracion de cualquier iglesia
-- via RPC directo, sin pasar por el frontend. Se agrega el chequeo que
-- debio existir desde el principio, mas el PIN para Super Admin.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_configuracion(p_iglesia_id UUID, p_codigo VARCHAR, p_valor TEXT, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_def_id UUID;
  v_existente UUID;
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  SELECT id INTO v_def_id FROM configuracion_definicion WHERE codigo = p_codigo;
  IF v_def_id IS NULL THEN
    RAISE EXCEPTION 'CONFIG_CODIGO_INEXISTENTE: no existe la configuracion %', p_codigo USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existente FROM configuracion_valor
  WHERE iglesia_id = p_iglesia_id AND definicion_id = v_def_id AND fecha_eliminacion IS NULL;

  IF v_existente IS NOT NULL THEN
    UPDATE configuracion_valor SET valor = p_valor WHERE id = v_existente;
  ELSE
    INSERT INTO configuracion_valor (iglesia_id, definicion_id, valor) VALUES (p_iglesia_id, v_def_id, p_valor);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_toggle_departamento(p_departamento_id UUID, p_activo BOOLEAN, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM departamento WHERE id = p_departamento_id;
  IF v_iglesia_id IS NULL OR NOT fn_es_operativo_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de esa iglesia' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE departamento SET activo = p_activo WHERE id = p_departamento_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_cambiar_moneda_defecto(p_iglesia_id UUID, p_moneda_id UUID, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT fn_es_operativo_en(p_iglesia_id) THEN
    RAISE EXCEPTION 'CONFIG_SIN_PERMISO: se requiere ser Pastor o Supervisor de la iglesia %', p_iglesia_id
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  UPDATE iglesia SET moneda_defecto_id = p_moneda_id WHERE id = p_iglesia_id;
END;
$$;

-- ============================================================
-- 3. Fusion de Casas de Paz
-- ============================================================
CREATE TABLE fusion_casa_de_paz (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id              UUID NOT NULL REFERENCES iglesia(id),
  casa_de_paz_origen_id   UUID NOT NULL REFERENCES casa_de_paz(id),
  casa_de_paz_destino_id  UUID NOT NULL REFERENCES casa_de_paz(id),
  fecha_fusion            TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo                  TEXT NOT NULL,
  deshecha_en             TIMESTAMPTZ,
  deshecha_motivo         TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_fusion_cdp_distintas CHECK (casa_de_paz_origen_id <> casa_de_paz_destino_id),
  CONSTRAINT chk_fusion_cdp_motivo CHECK (btrim(motivo) <> '')
);

CREATE TRIGGER trg_auditoria_fusion_cdp BEFORE INSERT OR UPDATE ON fusion_casa_de_paz FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_fusion_cdp BEFORE DELETE ON fusion_casa_de_paz FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE fusion_casa_de_paz ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_fusion_cdp_select ON fusion_casa_de_paz
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);
-- Sin policy de INSERT/UPDATE: todo pasa por fn_fusionar_cdp / fn_deshacer_fusion_cdp (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION fn_fusionar_cdp(p_origen_id UUID, p_destino_id UUID, p_motivo TEXT, p_pin TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_iglesia_origen UUID;
  v_red_destino UUID;
  v_fusion_id UUID;
BEGIN
  IF p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'FUSION_MISMA_CDP: no se puede fusionar una casa de paz consigo misma' USING ERRCODE = 'P0001';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la fusion' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz WHERE id = p_destino_id AND fecha_eliminacion IS NULL;
  SELECT iglesia_id INTO v_iglesia_origen FROM casa_de_paz WHERE id = p_origen_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL OR v_iglesia_origen IS NULL THEN
    RAISE EXCEPTION 'FUSION_CDP_INEXISTENTE: alguna de las casas de paz no existe' USING ERRCODE = 'P0001';
  END IF;
  IF v_iglesia_id IS DISTINCT FROM v_iglesia_origen THEN
    RAISE EXCEPTION 'FUSION_IGLESIAS_DISTINTAS: las dos casas de paz deben ser de la misma iglesia' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_destino FROM casa_de_paz_red
  WHERE casa_de_paz_id = p_destino_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_iglesia_id) OR (v_red_destino IS NOT NULL AND fn_es_lider_de_red(v_red_destino))) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: se requiere ser Lider de la Red destino, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO fusion_casa_de_paz (iglesia_id, casa_de_paz_origen_id, casa_de_paz_destino_id, motivo)
  VALUES (v_iglesia_id, p_origen_id, p_destino_id, p_motivo)
  RETURNING id INTO v_fusion_id;

  -- Cerrar membresias vigentes de origen y reabrirlas en destino, con el
  -- mismo dia de referencia (fecha_fusion) para que deshacer pueda
  -- encontrarlas con precision.
  UPDATE casa_de_paz_membresia
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO casa_de_paz_membresia (iglesia_id, casa_de_paz_id, persona_id, es_principal, fecha_inicio)
  SELECT v_iglesia_id, p_destino_id, m.persona_id, m.es_principal, CURRENT_DATE
  FROM casa_de_paz_membresia m
  WHERE m.casa_de_paz_id = p_origen_id AND m.fecha_fin = CURRENT_DATE AND m.fecha_eliminacion IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM casa_de_paz_membresia m2
      WHERE m2.persona_id = m.persona_id AND m2.casa_de_paz_id = p_destino_id
        AND m2.fecha_fin IS NULL AND m2.fecha_eliminacion IS NULL
    );

  -- Cerrar los cargos de origen: esa CdP deja de operar de forma independiente.
  UPDATE casa_de_paz_cargo
  SET fecha_fin = CURRENT_DATE
  WHERE casa_de_paz_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz SET activo = false WHERE id = p_origen_id;

  RETURN v_fusion_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_deshacer_fusion_cdp(p_fusion_id UUID, p_motivo TEXT, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fusion fusion_casa_de_paz%ROWTYPE;
  v_red_destino UUID;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo para deshacer' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_fusion FROM fusion_casa_de_paz WHERE id = p_fusion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FUSION_NO_ENCONTRADA: no existe esa fusion' USING ERRCODE = 'P0001';
  END IF;
  IF v_fusion.deshecha_en IS NOT NULL THEN
    RAISE EXCEPTION 'FUSION_YA_DESHECHA: esta fusion ya fue deshecha' USING ERRCODE = 'P0001';
  END IF;
  IF now() > v_fusion.fecha_fusion + interval '7 days' THEN
    RAISE EXCEPTION 'FUSION_VENTANA_VENCIDA: ya pasaron los 7 dias para deshacer esta fusion' USING ERRCODE = 'P0001';
  END IF;

  SELECT red_id INTO v_red_destino FROM casa_de_paz_red
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_destino_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  IF NOT (fn_es_operativo_en(v_fusion.iglesia_id) OR (v_red_destino IS NOT NULL AND fn_es_lider_de_red(v_red_destino))) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: se requiere ser Lider de la Red destino, o Pastor/Supervisor' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  -- Orden importante: cerrar primero la membresia en destino, despues
  -- reabrir la de origen. Al reves, si la persona era principal en ambas
  -- filas (se copia es_principal al fusionar), por un instante quedarian
  -- dos filas vigentes principales de la misma persona a la vez y
  -- uq_membresia_principal_vigente lo rechaza (encontrado al probar).
  UPDATE casa_de_paz_membresia
  SET fecha_fin = v_fusion.fecha_fusion::date
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_destino_id
    AND fecha_inicio = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    AND persona_id IN (
      SELECT persona_id FROM casa_de_paz_membresia
      WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id AND fecha_fin = v_fusion.fecha_fusion::date
        AND fecha_eliminacion IS NULL
    );

  UPDATE casa_de_paz_membresia
  SET fecha_fin = NULL
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz_cargo
  SET fecha_fin = NULL
  WHERE casa_de_paz_id = v_fusion.casa_de_paz_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE casa_de_paz SET activo = true WHERE id = v_fusion.casa_de_paz_origen_id;

  UPDATE fusion_casa_de_paz
  SET deshecha_en = now(), deshecha_motivo = p_motivo
  WHERE id = p_fusion_id;
END;
$$;

-- ============================================================
-- 4. Fusion de Redes -- solo Pastor/Supervisor (fn_es_operativo_en), nunca
-- Lider de Red, a diferencia de la fusion de CdP.
-- ============================================================
CREATE TABLE fusion_red (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id       UUID NOT NULL REFERENCES iglesia(id),
  red_origen_id    UUID NOT NULL REFERENCES red(id),
  red_destino_id   UUID NOT NULL REFERENCES red(id),
  fecha_fusion     TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo           TEXT NOT NULL,
  deshecha_en      TIMESTAMPTZ,
  deshecha_motivo  TEXT,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_fusion_red_distintas CHECK (red_origen_id <> red_destino_id),
  CONSTRAINT chk_fusion_red_motivo CHECK (btrim(motivo) <> '')
);

CREATE TRIGGER trg_auditoria_fusion_red BEFORE INSERT OR UPDATE ON fusion_red FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_fusion_red BEFORE DELETE ON fusion_red FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE fusion_red ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_fusion_red_select ON fusion_red
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE OR REPLACE FUNCTION fn_fusionar_red(p_origen_id UUID, p_destino_id UUID, p_motivo TEXT, p_pin TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
  v_iglesia_origen UUID;
  v_fusion_id UUID;
BEGIN
  IF p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'FUSION_MISMA_RED: no se puede fusionar una red consigo misma' USING ERRCODE = 'P0001';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo de la fusion' USING ERRCODE = 'P0001';
  END IF;

  SELECT iglesia_id INTO v_iglesia_id FROM red WHERE id = p_destino_id AND fecha_eliminacion IS NULL;
  SELECT iglesia_id INTO v_iglesia_origen FROM red WHERE id = p_origen_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL OR v_iglesia_origen IS NULL THEN
    RAISE EXCEPTION 'FUSION_RED_INEXISTENTE: alguna de las redes no existe' USING ERRCODE = 'P0001';
  END IF;
  IF v_iglesia_id IS DISTINCT FROM v_iglesia_origen THEN
    RAISE EXCEPTION 'FUSION_IGLESIAS_DISTINTAS: las dos redes deben ser de la misma iglesia' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_es_operativo_en(v_iglesia_id) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: solo el Pastor o el Supervisor de Vision en Accion pueden fusionar redes'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO fusion_red (iglesia_id, red_origen_id, red_destino_id, motivo)
  VALUES (v_iglesia_id, p_origen_id, p_destino_id, p_motivo)
  RETURNING id INTO v_fusion_id;

  -- Mover las Casas de Paz vigentes de origen a destino (cierra el vinculo
  -- anterior, abre uno nuevo -- mismo patron que un cambio de red comun).
  UPDATE casa_de_paz_red
  SET fecha_fin = CURRENT_DATE
  WHERE red_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  INSERT INTO casa_de_paz_red (iglesia_id, casa_de_paz_id, red_id, fecha_inicio)
  SELECT v_iglesia_id, cdr.casa_de_paz_id, p_destino_id, CURRENT_DATE
  FROM casa_de_paz_red cdr
  WHERE cdr.red_id = p_origen_id AND cdr.fecha_fin = CURRENT_DATE AND cdr.fecha_eliminacion IS NULL;

  -- Cerrar los cargos de la red de origen: deja de operar de forma independiente.
  UPDATE red_cargo
  SET fecha_fin = CURRENT_DATE
  WHERE red_id = p_origen_id AND fecha_fin IS NULL AND fecha_eliminacion IS NULL;

  UPDATE red SET activo = false WHERE id = p_origen_id;

  RETURN v_fusion_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_deshacer_fusion_red(p_fusion_id UUID, p_motivo TEXT, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fusion fusion_red%ROWTYPE;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'FUSION_MOTIVO_OBLIGATORIO: hay que escribir el motivo para deshacer' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_fusion FROM fusion_red WHERE id = p_fusion_id AND fecha_eliminacion IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FUSION_NO_ENCONTRADA: no existe esa fusion' USING ERRCODE = 'P0001';
  END IF;
  IF v_fusion.deshecha_en IS NOT NULL THEN
    RAISE EXCEPTION 'FUSION_YA_DESHECHA: esta fusion ya fue deshecha' USING ERRCODE = 'P0001';
  END IF;
  IF now() > v_fusion.fecha_fusion + interval '7 days' THEN
    RAISE EXCEPTION 'FUSION_VENTANA_VENCIDA: ya pasaron los 7 dias para deshacer esta fusion' USING ERRCODE = 'P0001';
  END IF;

  IF NOT fn_es_operativo_en(v_fusion.iglesia_id) THEN
    RAISE EXCEPTION 'FUSION_SIN_PERMISO: solo el Pastor o el Supervisor de Vision en Accion pueden deshacer esta fusion'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  -- Volver las Casas de Paz movidas por ESTA fusion a la red de origen.
  UPDATE casa_de_paz_red
  SET fecha_fin = v_fusion.fecha_fusion::date
  WHERE red_id = v_fusion.red_destino_id
    AND fecha_inicio = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    AND casa_de_paz_id IN (
      SELECT casa_de_paz_id FROM casa_de_paz_red
      WHERE red_id = v_fusion.red_origen_id AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL
    );

  UPDATE casa_de_paz_red
  SET fecha_fin = NULL
  WHERE red_id = v_fusion.red_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE red_cargo
  SET fecha_fin = NULL
  WHERE red_id = v_fusion.red_origen_id
    AND fecha_fin = v_fusion.fecha_fusion::date AND fecha_eliminacion IS NULL;

  UPDATE red SET activo = true WHERE id = v_fusion.red_origen_id;

  UPDATE fusion_red
  SET deshecha_en = now(), deshecha_motivo = p_motivo
  WHERE id = p_fusion_id;
END;
$$;

-- ============================================================
-- 5. Listados para el frontend
-- ============================================================
CREATE OR REPLACE FUNCTION fn_listar_fusiones_cdp(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, fecha_fusion TIMESTAMPTZ, motivo TEXT, deshecha_en TIMESTAMPTZ, deshecha_motivo TEXT,
  origen_id UUID, origen_etiqueta TEXT, destino_id UUID, destino_etiqueta TEXT,
  puede_deshacer BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    f.id, f.fecha_fusion, f.motivo, f.deshecha_en, f.deshecha_motivo,
    f.casa_de_paz_origen_id, fn_etiqueta_cdp(f.casa_de_paz_origen_id),
    f.casa_de_paz_destino_id, fn_etiqueta_cdp(f.casa_de_paz_destino_id),
    (f.deshecha_en IS NULL AND now() <= f.fecha_fusion + interval '7 days')
  FROM fusion_casa_de_paz f
  WHERE f.iglesia_id = p_iglesia_id AND f.fecha_eliminacion IS NULL
  ORDER BY f.fecha_fusion DESC;
$$;

CREATE OR REPLACE FUNCTION fn_listar_fusiones_red(p_iglesia_id UUID)
RETURNS TABLE (
  id UUID, fecha_fusion TIMESTAMPTZ, motivo TEXT, deshecha_en TIMESTAMPTZ, deshecha_motivo TEXT,
  origen_id UUID, origen_nombre VARCHAR, destino_id UUID, destino_nombre VARCHAR,
  puede_deshacer BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    f.id, f.fecha_fusion, f.motivo, f.deshecha_en, f.deshecha_motivo,
    f.red_origen_id, ro.nombre, f.red_destino_id, rd.nombre,
    (f.deshecha_en IS NULL AND now() <= f.fecha_fusion + interval '7 days')
  FROM fusion_red f
  JOIN red ro ON ro.id = f.red_origen_id
  JOIN red rd ON rd.id = f.red_destino_id
  WHERE f.iglesia_id = p_iglesia_id AND f.fecha_eliminacion IS NULL
  ORDER BY f.fecha_fusion DESC;
$$;

-- ============================================================
-- 6. Administracion: crear iglesia e invitar usuario tambien son "cambios
-- de configuracion del sistema" hechos por Super Admin -- se envuelven en
-- funciones para poder exigir el PIN (un INSERT de tabla suelto no puede
-- pedir un parametro extra).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_crear_iglesia(p_sufijo VARCHAR, p_ciudad VARCHAR, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cobertura_id UUID;
  v_moneda_id UUID;
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'IGLESIA_SOLO_SUPER_ADMIN: solo un Super Admin puede crear iglesias' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  SELECT id INTO v_cobertura_id FROM cobertura LIMIT 1;
  SELECT id INTO v_moneda_id FROM moneda WHERE codigo = 'BOB';

  INSERT INTO iglesia (sufijo, ciudad, cobertura_id, moneda_defecto_id)
  VALUES (p_sufijo, p_ciudad, v_cobertura_id, v_moneda_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_crear_usuario_rol(p_usuario_id UUID, p_rol rol_sistema_enum, p_iglesia_id UUID, p_pin TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND fn_es_operativo_en(p_iglesia_id))) THEN
    RAISE EXCEPTION 'USUARIO_ROL_SIN_PERMISO: no tenes permiso para invitar usuarios aqui' USING ERRCODE = 'P0001';
  END IF;
  PERFORM fn_exigir_pin(p_pin);

  INSERT INTO usuario_rol (usuario_id, rol, iglesia_id) VALUES (p_usuario_id, p_rol, p_iglesia_id);
END;
$$;
