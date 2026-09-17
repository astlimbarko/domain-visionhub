-- VisionHub -- KAN-388 (2026-09-17, ticket escrito por el owner en Jira):
-- "Avances de VisionHub" -- changelog funcional de solo lectura en /avances,
-- visibilidad por jerarquía general + alcances especiales (Evangelismo/
-- Afirmación). Fuente de datos: sin UI de creación a propósito (pedido
-- explícito del ticket, "Sin formularios... Sin botones de creación") --
-- se carga por INSERT directo (Claude Code o el owner), como este mismo
-- archivo hace más abajo con las publicaciones de hoy.

CREATE TYPE avance_tipo_enum AS ENUM ('EN_CURSO', 'TERMINADO', 'CORRECCION');

-- Catálogo de alcances -- extensible sin tocar el frontend: agregar un
-- alcance nuevo es un INSERT acá + la regla de visibilidad correspondiente
-- en fn_avances_visibles (el único lugar que sabe RESOLVER quién ve qué;
-- la página /avances solo pinta lo que esta tabla ya le dice que puede ver).
CREATE TABLE avance_alcance_definicion (
  codigo      VARCHAR(40) PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  orden       SMALLINT NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO avance_alcance_definicion (codigo, nombre, orden) VALUES
  ('GLOBAL', 'Todos', 0),
  ('CDP', 'Líder/Sub-líder de Casa de Paz', 1),
  ('RED', 'Líder de Red', 2),
  ('SUPERVISION', 'Supervisor de la Visión en Acción / Pastor', 3),
  ('EVANGELISMO', 'Departamento de Evangelismo', 10),
  ('AFIRMACION', 'Departamento de Afirmación', 11);

CREATE TABLE avance (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                 avance_tipo_enum NOT NULL,
  area                 VARCHAR(60),
  titulo               VARCHAR(150) NOT NULL,
  descripcion          TEXT NOT NULL,
  alcance_codigo       VARCHAR(40) NOT NULL REFERENCES avance_alcance_definicion(codigo),
  fecha_publicacion    TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_avance_fecha_publicacion ON avance (fecha_publicacion DESC) WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_avance BEFORE INSERT OR UPDATE ON avance FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_avance BEFORE DELETE ON avance FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

-- RLS: no hace falta política de INSERT (nadie inserta desde el cliente,
-- solo por SQL directo con service role) -- SELECT tampoco se usa directo,
-- todo pasa por fn_avances_visibles (SECURITY DEFINER) para que la
-- resolución de alcance quede en un solo lugar, no repetida en una policy.
ALTER TABLE avance ENABLE ROW LEVEL SECURITY;
ALTER TABLE avance_alcance_definicion ENABLE ROW LEVEL SECURITY;

-- fn_avances_visibles: única función que decide qué ve cada usuario.
-- Jerarquía general (ascendente): CDP < RED < SUPERVISION < Super Admin.
-- Alcances especiales (Evangelismo/Afirmación): aparte de la jerarquía --
-- solo miembros del depto correspondiente + Supervision/Pastor/SuperAdmin,
-- un Líder de Red NO los ve solo por estar arriba en la jerarquía general
-- (pedido explícito del ticket).
CREATE OR REPLACE FUNCTION fn_avances_visibles()
RETURNS TABLE (
  id uuid, tipo avance_tipo_enum, area varchar, titulo varchar, descripcion text,
  alcance_codigo varchar, alcance_nombre varchar, fecha_publicacion timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_super_admin boolean := fn_es_super_admin();
  v_tiene_cdp boolean;
  v_tiene_red boolean;
  v_tiene_supervision boolean;
  v_tiene_evangelismo boolean := false;
  v_tiene_afirmacion boolean := false;
  v_iglesia_id uuid;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND rol IN ('LIDER_CDP','SUBLIDER_CDP')
      AND fecha_eliminacion IS NULL
  ) INTO v_tiene_cdp;

  SELECT EXISTS(
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND rol = 'LIDER_RED'
      AND fecha_eliminacion IS NULL
  ) INTO v_tiene_red;

  SELECT EXISTS(
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND rol IN ('SUPERVISOR_VISION_ACCION','PASTOR')
      AND fecha_eliminacion IS NULL
  ) INTO v_tiene_supervision;

  -- Departamentos: no hace falta si ya es Super Admin o Supervision (esos
  -- ya ven Evangelismo/Afirmación igual) -- se evita recorrer iglesias de más.
  IF NOT v_super_admin AND NOT v_tiene_supervision THEN
    FOR v_iglesia_id IN SELECT * FROM fn_mis_iglesias() LOOP
      IF fn_es_lider_departamento(v_iglesia_id, 'EVANGELISMO') THEN v_tiene_evangelismo := true; END IF;
      IF fn_es_lider_departamento(v_iglesia_id, 'AFIRMACION') THEN v_tiene_afirmacion := true; END IF;
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT a.id, a.tipo, a.area, a.titulo, a.descripcion, a.alcance_codigo, ad.nombre, a.fecha_publicacion
  FROM avance a
  JOIN avance_alcance_definicion ad ON ad.codigo = a.alcance_codigo
  WHERE a.fecha_eliminacion IS NULL
    AND (
      v_super_admin
      OR a.alcance_codigo = 'GLOBAL'
      OR (a.alcance_codigo = 'CDP' AND (v_tiene_cdp OR v_tiene_red OR v_tiene_supervision))
      OR (a.alcance_codigo = 'RED' AND (v_tiene_red OR v_tiene_supervision))
      OR (a.alcance_codigo = 'SUPERVISION' AND v_tiene_supervision)
      OR (a.alcance_codigo = 'EVANGELISMO' AND (v_tiene_evangelismo OR v_tiene_supervision))
      OR (a.alcance_codigo = 'AFIRMACION' AND (v_tiene_afirmacion OR v_tiene_supervision))
    )
  ORDER BY a.fecha_publicacion DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_avances_visibles() TO authenticated;

-- Publicaciones reales de hoy (2026-09-17), como primer contenido real de
-- la vista -- no son datos de prueba, son las funcionalidades que de verdad
-- se entregaron hoy, redactadas en lenguaje funcional (sin nombres de
-- archivos/tickets/SQL, como pide el ticket).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
  ('TERMINADO', 'Casas de Paz', 'Ahora podés registrar cuando una reunión de Casa de Paz no se realizó', 'Si una semana no hubo reunión, marcalo en el reporte con el motivo -- ya no queda como reporte pendiente, queda como semana justificada.', 'CDP', now()),
  ('TERMINADO', 'Casas de Paz', 'El buscador de asistencia ahora es uno solo', 'Antes había que elegir entre 3 campos distintos para anotar asistentes nuevos, regulares o niños. Ahora es un solo buscador que reconoce a la persona y la clasifica sola.', 'CDP', now()),
  ('TERMINADO', 'Evangelismo', 'Ahora se puede marcar cuando alguien se reconcilió', 'Al tomar asistencia, si alguien volvió después de mucho tiempo, ahora se puede marcar que se reconcilió con Dios en ese momento.', 'CDP', now());
