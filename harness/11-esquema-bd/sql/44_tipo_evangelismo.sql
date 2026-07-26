-- VisionHub -- 44_tipo_evangelismo.sql
-- Clasificacion de evangelismo (1+1, Elite, Semilla, ...), elegida al
-- registrar un evangelizado. Mismo patron que tipo_evento (17_calendario y
-- 13_calendario.sql): catalogo global (iglesia_id NULL) u override propio de
-- una iglesia, referenciado desde `evangelismo`.

CREATE TABLE tipo_evangelismo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id  UUID REFERENCES iglesia(id),
  codigo      VARCHAR(30) NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  color       CHAR(7) NOT NULL DEFAULT '#6B7280',
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_tipo_evangelismo_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX uq_tipo_evangelismo_codigo
  ON tipo_evangelismo (COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo)
  WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_tipo_evangelismo BEFORE INSERT OR UPDATE ON tipo_evangelismo FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_tipo_evangelismo BEFORE DELETE ON tipo_evangelismo FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE tipo_evangelismo ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_tipo_evangelismo_select ON tipo_evangelismo FOR SELECT TO authenticated USING (
  fecha_eliminacion IS NULL AND (iglesia_id IS NULL OR iglesia_id IN (SELECT fn_mis_iglesias()))
);
CREATE POLICY pol_tipo_evangelismo_insert ON tipo_evangelismo FOR INSERT TO authenticated WITH CHECK (
  (iglesia_id IS NOT NULL AND fn_es_operativo_en(iglesia_id)) OR (iglesia_id IS NULL AND fn_es_super_admin())
);
CREATE POLICY pol_tipo_evangelismo_update ON tipo_evangelismo FOR UPDATE TO authenticated
  USING (iglesia_id IS NOT NULL AND fn_es_operativo_en(iglesia_id))
  WITH CHECK (iglesia_id IS NOT NULL AND fn_es_operativo_en(iglesia_id));

-- Opcional: el evangelizado puede quedar sin clasificar (registros previos a
-- este cambio, o iglesias que todavia no lo usan).
ALTER TABLE evangelismo ADD COLUMN tipo_evangelismo_id UUID REFERENCES tipo_evangelismo(id);
