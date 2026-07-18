-- VisionHub -- 05_funciones_acceso.sql
-- Funciones SECURITY DEFINER que resuelven el acceso, y usuario_rol.

CREATE TABLE usuario_rol (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES auth.users(id),
  iglesia_id   UUID REFERENCES iglesia(id),
  rol          rol_sistema_enum NOT NULL,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ,
  creado_por           UUID REFERENCES auth.users(id),
  actualizado_por      UUID REFERENCES auth.users(id),
  fecha_eliminacion    TIMESTAMPTZ,
  eliminado_por        UUID REFERENCES auth.users(id),
  CONSTRAINT chk_rol_iglesia CHECK (
    (rol = 'SUPER_ADMIN' AND iglesia_id IS NULL) OR
    (rol <> 'SUPER_ADMIN' AND iglesia_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_usuario_rol_vigente
  ON usuario_rol (usuario_id, COALESCE(iglesia_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE fecha_eliminacion IS NULL;

CREATE TRIGGER trg_auditoria_usuario_rol BEFORE INSERT OR UPDATE ON usuario_rol FOR EACH ROW EXECUTE FUNCTION fn_auditoria();
CREATE TRIGGER trg_no_delete_usuario_rol BEFORE DELETE ON usuario_rol FOR EACH ROW EXECUTE FUNCTION fn_bloquear_delete();

CREATE OR REPLACE FUNCTION fn_es_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND rol = 'SUPER_ADMIN' AND fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_mi_persona_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM persona WHERE usuario_id = auth.uid() AND fecha_eliminacion IS NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_mis_iglesias()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id FROM iglesia i WHERE fn_es_super_admin()
  UNION
  SELECT i.id FROM iglesia i WHERE i.pastor_id = fn_mi_persona_id() AND i.fecha_eliminacion IS NULL
  UNION
  SELECT i.id FROM iglesia i WHERE i.supervisor_id = fn_mi_persona_id() AND i.fecha_eliminacion IS NULL
  UNION
  SELECT p.iglesia_id FROM persona p WHERE p.usuario_id = auth.uid() AND p.fecha_eliminacion IS NULL
  UNION
  SELECT ur.iglesia_id FROM usuario_rol ur
  WHERE ur.usuario_id = auth.uid() AND ur.iglesia_id IS NOT NULL AND ur.fecha_eliminacion IS NULL;
$$;

-- Reemplaza a fn_es_admin_en del modelo generico anterior.
CREATE OR REPLACE FUNCTION fn_es_pastor_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_super_admin() OR EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND iglesia_id = p_iglesia_id AND rol = 'PASTOR' AND fecha_eliminacion IS NULL
  );
$$;

-- Pastor o Supervisor: la regla operativa por defecto en todo el sistema.
CREATE OR REPLACE FUNCTION fn_es_operativo_en(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_pastor_en(p_iglesia_id) OR EXISTS (
    SELECT 1 FROM usuario_rol
    WHERE usuario_id = auth.uid() AND iglesia_id = p_iglesia_id
      AND rol = 'SUPERVISOR_VISION_ACCION' AND fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_mis_iglesias_detalle()
RETURNS TABLE (id UUID, nombre VARCHAR, ciudad VARCHAR, es_operativo BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.nombre, i.ciudad, fn_es_operativo_en(i.id)
  FROM iglesia i
  WHERE i.id IN (SELECT fn_mis_iglesias())
    AND i.activo
    AND i.fecha_eliminacion IS NULL
  ORDER BY i.nombre;
$$;

-- Validacion de asignacion de rol: nadie se auto-asigna, y cada rol exige
-- quien lo asigna segun la cadena de mando (decision del owner, 2026-07-17/19).
CREATE OR REPLACE FUNCTION fn_validar_asignacion_rol()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'ROL_AUTOASIGNACION: un usuario no puede asignarse un rol a si mismo'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPER_ADMIN' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede crear otro SUPER_ADMIN'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'PASTOR' AND NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede asignar el rol PASTOR'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol = 'SUPERVISOR_VISION_ACCION' AND NOT fn_es_pastor_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser PASTOR de la iglesia % para asignar SUPERVISOR_VISION_ACCION', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.rol IN ('LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP') AND NOT fn_es_operativo_en(NEW.iglesia_id) THEN
    RAISE EXCEPTION 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', NEW.iglesia_id, NEW.rol
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.iglesia_id IS NOT NULL AND NEW.iglesia_id NOT IN (SELECT fn_mis_iglesias()) THEN
    RAISE EXCEPTION 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', NEW.iglesia_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_rol
  BEFORE INSERT OR UPDATE ON usuario_rol
  FOR EACH ROW EXECUTE FUNCTION fn_validar_asignacion_rol();

-- El primer usuario (SUPER_ADMIN): ejecutar UNA VEZ, manualmente, tras crear
-- el usuario del admin tecnico en Auth. Ver 01-tenancy-iglesias/design.md.
-- ALTER TABLE usuario_rol DISABLE TRIGGER trg_validar_rol;
-- INSERT INTO usuario_rol (usuario_id, iglesia_id, rol) VALUES ('<uuid-admin-tecnico>', NULL, 'SUPER_ADMIN');
-- ALTER TABLE usuario_rol ENABLE TRIGGER trg_validar_rol;
