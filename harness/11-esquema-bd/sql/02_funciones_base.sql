-- VisionHub -- 02_funciones_base.sql
-- Fundacion: auditoria automatica y bloqueo de DELETE fisico (00-fundacion/design.md)

CREATE OR REPLACE FUNCTION fn_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.fecha_creacion := now();
    NEW.creado_por := auth.uid();
    NEW.fecha_actualizacion := NULL;
    NEW.actualizado_por := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.fecha_creacion := OLD.fecha_creacion;
    NEW.creado_por := OLD.creado_por;
    NEW.fecha_actualizacion := now();
    NEW.actualizado_por := auth.uid();

    IF NEW.fecha_eliminacion IS NOT NULL AND OLD.fecha_eliminacion IS NULL THEN
      NEW.fecha_eliminacion := now();
      NEW.eliminado_por := auth.uid();
    ELSIF NEW.fecha_eliminacion IS NULL AND OLD.fecha_eliminacion IS NOT NULL THEN
      NEW.eliminado_por := NULL;
    ELSE
      NEW.fecha_eliminacion := OLD.fecha_eliminacion;
      NEW.eliminado_por := OLD.eliminado_por;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_bloquear_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Borrado fisico prohibido en %. Use borrado logico: UPDATE % SET fecha_eliminacion = now()',
    TG_TABLE_NAME, TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;

-- Bloqueo de DELETE, capa 1 (permisos). La capa 2 (disparador) se agrega por
-- tabla en cada archivo de creacion, con el nombre trg_no_delete_<tabla>.
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE DELETE ON TABLES FROM anon, authenticated;
