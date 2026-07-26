-- VisionHub -- 45_ciudad.sql
-- Catalogo de ciudades donde opera la vision (Santa Cruz y su area metropolitana
-- + provincia). Global (sin iglesia_id), mismo patron que tipo_telefono /
-- motivo_llegada. El Supervisor de la Vision en Accion (cargo todavia sin crear
-- en el sistema) lo administrara a futuro; por ahora solo el Super Admin puede
-- insertar/editar (pedido del owner, 2026-07-22).

CREATE TABLE ciudad (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  VARCHAR(60) NOT NULL UNIQUE,
  nombre  VARCHAR(100) NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT true,
  orden   SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE TRIGGER trg_auditoria_ciudad BEFORE INSERT OR UPDATE ON ciudad FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_ciudad BEFORE DELETE ON ciudad FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

ALTER TABLE ciudad ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_ciudad_select ON ciudad FOR SELECT TO authenticated USING (fecha_eliminacion IS NULL);
CREATE POLICY pol_ciudad_insert ON ciudad FOR INSERT TO authenticated WITH CHECK (fn_es_super_admin());
CREATE POLICY pol_ciudad_update ON ciudad FOR UPDATE TO authenticated USING (fn_es_super_admin()) WITH CHECK (fn_es_super_admin());

-- Domicilio del anfitrion de una Casa de Paz: la ciudad se elige del catalogo
-- en vez de texto libre. La columna `ciudad` (texto libre) de 07_contacto.sql
-- se mantiene intacta para no romper las direcciones que ya carga el modulo
-- Personas (FichaDirecciones).
ALTER TABLE direccion ADD COLUMN ciudad_id UUID REFERENCES ciudad(id);

-- Una Casa de Paz tiene a lo sumo un domicilio vigente (el de la reunion / del
-- anfitrion), mismo patron de exclusividad que uq_cdp_red_vigente (08_estructura.sql).
CREATE UNIQUE INDEX uq_direccion_cdp_vigente
  ON direccion_asignacion (casa_de_paz_id)
  WHERE activo AND casa_de_paz_id IS NOT NULL AND fecha_eliminacion IS NULL;
