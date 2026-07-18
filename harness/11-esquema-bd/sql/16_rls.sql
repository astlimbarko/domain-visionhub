-- VisionHub -- 16_rls.sql
-- RLS de toda la base. Va al final: las politicas invocan funciones creadas
-- en 05/06/12/14/15. Sin politica de DELETE en ninguna tabla (permiso revocado
-- en 02_funciones_base.sql + disparador trg_no_delete_<tabla> en cada tabla).

-- ============================================================
-- Catalogos 100% globales (sin iglesia_id): lectura abierta, escritura SUPER_ADMIN
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['moneda','cobertura','cargo','estado','tipo_relacion',
                           'tipo_telefono','motivo_llegada','cdp_libro','configuracion_definicion']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pol_%1$s_select ON %1$I FOR SELECT TO authenticated USING (fecha_eliminacion IS NULL)', t);
    EXECUTE format('CREATE POLICY pol_%1$s_insert ON %1$I FOR INSERT TO authenticated WITH CHECK (fn_es_super_admin())', t);
    EXECUTE format('CREATE POLICY pol_%1$s_update ON %1$I FOR UPDATE TO authenticated USING (fn_es_super_admin()) WITH CHECK (fn_es_super_admin())', t);
  END LOOP;
END $$;

-- ============================================================
-- iglesia
-- ============================================================
ALTER TABLE iglesia ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_iglesia_select ON iglesia
  FOR SELECT TO authenticated
  USING (id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_iglesia_update ON iglesia
  FOR UPDATE TO authenticated
  USING (fn_es_operativo_en(id))
  WITH CHECK (fn_es_operativo_en(id));

CREATE POLICY pol_iglesia_insert ON iglesia
  FOR INSERT TO authenticated
  WITH CHECK (fn_es_super_admin() OR (iglesia_padre_id IS NOT NULL AND fn_es_pastor_en(iglesia_padre_id)));

-- ============================================================
-- usuario_rol
-- ============================================================
ALTER TABLE usuario_rol ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_usuario_rol_select ON usuario_rol
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_operativo_en(iglesia_id))
  );

CREATE POLICY pol_usuario_rol_insert ON usuario_rol
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IS NULL OR iglesia_id IN (SELECT fn_mis_iglesias()));
-- El resto de las reglas (quien puede asignar que rol, auto-asignacion) las
-- hace cumplir el disparador trg_validar_rol (05_funciones_acceso.sql).

-- ============================================================
-- Catalogos con iglesia_id NULABLE (global o propio de una iglesia)
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['cdp_tema','tipo_evento','finanzas_tipo_ingreso']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pol_%1$s_select ON %1$I FOR SELECT TO authenticated USING (
      fecha_eliminacion IS NULL AND (iglesia_id IS NULL OR iglesia_id IN (SELECT fn_mis_iglesias()))
    )', t);
    EXECUTE format('CREATE POLICY pol_%1$s_insert ON %1$I FOR INSERT TO authenticated WITH CHECK (
      (iglesia_id IS NOT NULL AND fn_es_operativo_en(iglesia_id)) OR (iglesia_id IS NULL AND fn_es_super_admin())
    )', t);
    EXECUTE format('CREATE POLICY pol_%1$s_update ON %1$I FOR UPDATE TO authenticated
      USING (iglesia_id IS NOT NULL AND fn_es_operativo_en(iglesia_id))
      WITH CHECK (iglesia_id IS NOT NULL AND fn_es_operativo_en(iglesia_id))', t);
  END LOOP;
END $$;

-- ============================================================
-- Patron generico: toda tabla de dominio con iglesia_id NOT NULL
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'iglesia_moneda','persona','direccion','direccion_asignacion','telefono','telefono_asignacion',
    'persona_llegada','familia','familia_override','referencia_familiar',
    'red','casa_de_paz','casa_de_paz_red','persona_cargo','red_cargo','casa_de_paz_cargo',
    'casa_de_paz_membresia','ministerio','ministerio_persona','departamento',
    'persona_estado','migracion_propuesta','configuracion_valor'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pol_%1$s_select ON %1$I FOR SELECT TO authenticated USING (
      iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL
    )', t);
    EXECUTE format('CREATE POLICY pol_%1$s_insert ON %1$I FOR INSERT TO authenticated WITH CHECK (
      iglesia_id IN (SELECT fn_mis_iglesias())
    )', t);
    EXECUTE format('CREATE POLICY pol_%1$s_update ON %1$I FOR UPDATE TO authenticated
      USING (iglesia_id IN (SELECT fn_mis_iglesias()))
      WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()))', t);
  END LOOP;
END $$;

-- persona_detalle no tiene iglesia_id propio: se filtra via persona
ALTER TABLE persona_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_persona_detalle_select ON persona_detalle
  FOR SELECT TO authenticated
  USING (
    fecha_eliminacion IS NULL
    AND EXISTS (SELECT 1 FROM persona p WHERE p.id = persona_detalle.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias()))
  );

CREATE POLICY pol_persona_detalle_insert ON persona_detalle
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM persona p WHERE p.id = persona_detalle.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())));

CREATE POLICY pol_persona_detalle_update ON persona_detalle
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM persona p WHERE p.id = persona_detalle.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())))
  WITH CHECK (EXISTS (SELECT 1 FROM persona p WHERE p.id = persona_detalle.persona_id AND p.iglesia_id IN (SELECT fn_mis_iglesias())));

-- ============================================================
-- casa_de_paz_reporte: INSERT/UPDATE exigen mirar el cargo, no solo iglesia_id
-- ============================================================
ALTER TABLE casa_de_paz_reporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_casa_de_paz_reporte_select ON casa_de_paz_reporte
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_casa_de_paz_reporte_insert ON casa_de_paz_reporte
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

CREATE POLICY pol_casa_de_paz_reporte_update ON casa_de_paz_reporte
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      fn_es_operativo_en(iglesia_id)
      OR fn_es_lider_cdp(casa_de_paz_id)
      OR (fn_es_sublider_cdp(casa_de_paz_id) AND fn_config_bool(iglesia_id, 'SUBLIDER_PUEDE_EDITAR_REPORTE'))
    )
  );

-- ============================================================
-- casa_de_paz_asistencia: INSERT exige poder reportar esa CdP
-- ============================================================
ALTER TABLE casa_de_paz_asistencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_casa_de_paz_asistencia_select ON casa_de_paz_asistencia
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_casa_de_paz_asistencia_insert ON casa_de_paz_asistencia
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fn_puede_reportar_cdp((SELECT casa_de_paz_id FROM casa_de_paz_reporte WHERE id = reporte_id))
  );

CREATE POLICY pol_casa_de_paz_asistencia_update ON casa_de_paz_asistencia
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fn_puede_reportar_cdp((SELECT casa_de_paz_id FROM casa_de_paz_reporte WHERE id = reporte_id))
  );

-- ============================================================
-- evangelismo: INSERT exige poder reportar esa CdP (escala CASA_DE_PAZ en Modulo 1)
-- ============================================================
ALTER TABLE evangelismo ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_evangelismo_select ON evangelismo
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_evangelismo_insert ON evangelismo
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

CREATE POLICY pol_evangelismo_update ON evangelismo
  FOR UPDATE TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_puede_reportar_cdp(casa_de_paz_id));

-- ============================================================
-- meta_evangelismo_asignada: solo un rol superior de la CdP asigna
-- ============================================================
ALTER TABLE meta_evangelismo_asignada ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_meta_asignada_select ON meta_evangelismo_asignada
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_meta_asignada_insert ON meta_evangelismo_asignada
  FOR INSERT TO authenticated
  WITH CHECK (iglesia_id IN (SELECT fn_mis_iglesias()) AND fn_es_rol_superior_de_cdp(casa_de_paz_id));

-- ============================================================
-- evento: MEGA_FIESTA solo la crea un rol superior de la CdP o el lider de red
-- ============================================================
ALTER TABLE evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_evento_select ON evento
  FOR SELECT TO authenticated
  USING (iglesia_id IN (SELECT fn_mis_iglesias()) AND fecha_eliminacion IS NULL);

CREATE POLICY pol_evento_insert ON evento
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      (casa_de_paz_id IS NOT NULL AND fn_puede_crear_evento(casa_de_paz_id, tipo_evento_id))
      OR (red_id IS NOT NULL AND fn_es_lider_de_red(red_id))
    )
  );

CREATE POLICY pol_evento_update ON evento
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (
      (casa_de_paz_id IS NOT NULL AND fn_puede_crear_evento(casa_de_paz_id, tipo_evento_id))
      OR (red_id IS NOT NULL AND fn_es_lider_de_red(red_id))
    )
  );

-- ============================================================
-- finanzas_ingreso: SELECT restringido por fn_puede_ver_ingresos_cdp (04-fundacion:
-- restriccion vive en la base, no en el front)
-- ============================================================
ALTER TABLE finanzas_ingreso ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_ingreso_select ON finanzas_ingreso
  FOR SELECT TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fecha_eliminacion IS NULL
    AND (casa_de_paz_id IS NULL OR fn_puede_ver_ingresos_cdp(casa_de_paz_id))
  );

CREATE POLICY pol_ingreso_insert ON finanzas_ingreso
  FOR INSERT TO authenticated
  WITH CHECK (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (casa_de_paz_id IS NULL OR fn_puede_reportar_cdp(casa_de_paz_id))
  );

CREATE POLICY pol_ingreso_update ON finanzas_ingreso
  FOR UPDATE TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND (casa_de_paz_id IS NULL OR fn_puede_reportar_cdp(casa_de_paz_id))
  );

-- ============================================================
-- Vistas de vigentes (00-fundacion): se exponen ademas de las tablas base
-- ============================================================
CREATE VIEW v_persona AS SELECT * FROM persona WHERE fecha_eliminacion IS NULL;
CREATE VIEW v_casa_de_paz AS SELECT * FROM casa_de_paz WHERE fecha_eliminacion IS NULL;
CREATE VIEW v_red AS SELECT * FROM red WHERE fecha_eliminacion IS NULL;
CREATE VIEW v_iglesia AS SELECT * FROM iglesia WHERE fecha_eliminacion IS NULL;
