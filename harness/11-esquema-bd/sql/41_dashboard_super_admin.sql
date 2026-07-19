-- VisionHub -- 41_dashboard_super_admin.sql
-- Dashboard tecnico del Super Admin: crecimiento, resumen por iglesia,
-- cuentas y salud de la base de datos. Nada de ofrendas/asistencia/datos
-- operativos por iglesia -- eso quedo cortado en 40_acotar_super_admin.sql.
-- v1 explicitamente acotado a lo que se puede leer con SQL directo, sin
-- credenciales nuevas (decision del owner, 2026-07-19): las metricas de
-- infraestructura real (CPU, ancho de banda, cuota de correo) viven en el
-- dashboard de Supabase, no aca.

CREATE OR REPLACE FUNCTION fn_dashboard_super_admin()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_resultado JSONB;
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'DASHBOARD_SOLO_SUPER_ADMIN: se requiere ser Super Admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'crecimiento', jsonb_build_object(
      'total_personas', (SELECT count(*) FROM persona WHERE fecha_eliminacion IS NULL),
      'por_mes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('mes', mes, 'nuevas', nuevas) ORDER BY mes)
        FROM (
          SELECT to_char(date_trunc('month', fecha_creacion), 'YYYY-MM') AS mes, count(*) AS nuevas
          FROM persona
          WHERE fecha_eliminacion IS NULL AND fecha_creacion >= date_trunc('month', now()) - interval '5 months'
          GROUP BY 1
        ) x
      ), '[]'::jsonb)
    ),
    'iglesias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'nombre', i.nombre, 'ciudad', i.ciudad, 'activa', i.activo,
        'iglesia_padre', ip.nombre,
        'redes', (SELECT count(*) FROM red r WHERE r.iglesia_id = i.id AND r.activo AND r.fecha_eliminacion IS NULL),
        'cdp', (SELECT count(*) FROM casa_de_paz c WHERE c.iglesia_id = i.id AND c.activo AND c.fecha_eliminacion IS NULL),
        'personas', (SELECT count(*) FROM persona p WHERE p.iglesia_id = i.id AND p.fecha_eliminacion IS NULL)
      ) ORDER BY i.nombre)
      FROM iglesia i
      LEFT JOIN iglesia ip ON ip.id = i.iglesia_padre_id
      WHERE i.fecha_eliminacion IS NULL
    ), '[]'::jsonb),
    'cuentas', jsonb_build_object(
      'total', (SELECT count(*) FROM auth.users),
      'por_rol', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('rol', rol, 'cantidad', cantidad) ORDER BY cantidad DESC)
        FROM (
          SELECT rol::text AS rol, count(*) AS cantidad
          FROM usuario_rol WHERE fecha_eliminacion IS NULL
          GROUP BY rol
        ) x
      ), '[]'::jsonb),
      'sin_persona_vinculada', (
        SELECT count(*) FROM auth.users u
        WHERE NOT EXISTS (SELECT 1 FROM persona p WHERE p.usuario_id = u.id AND p.fecha_eliminacion IS NULL)
      ),
      'nunca_inicio_sesion', (SELECT count(*) FROM auth.users WHERE last_sign_in_at IS NULL)
    ),
    'salud_bd', jsonb_build_object(
      'tamano_mb', round(pg_database_size(current_database()) / 1024.0 / 1024.0, 1),
      'tablas_mas_grandes', (
        SELECT jsonb_agg(jsonb_build_object('tabla', tabla, 'mb', mb))
        FROM (
          SELECT relname AS tabla, round(pg_total_relation_size(c.oid) / 1024.0 / 1024.0, 2) AS mb
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
          ORDER BY pg_total_relation_size(c.oid) DESC
          LIMIT 8
        ) x
      ),
      'rls_cobertura', jsonb_build_object(
        'con_rls', (
          SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        ),
        'total', (
          SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
        )
      ),
      'super_admin_con_rol_operativo', (
        SELECT count(*) FROM usuario_rol ur
        WHERE ur.fecha_eliminacion IS NULL
          AND ur.rol IN ('PASTOR', 'SUPERVISOR_VISION_ACCION', 'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP')
          AND EXISTS (
            SELECT 1 FROM usuario_rol s WHERE s.usuario_id = ur.usuario_id AND s.rol = 'SUPER_ADMIN' AND s.fecha_eliminacion IS NULL
          )
      )
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
