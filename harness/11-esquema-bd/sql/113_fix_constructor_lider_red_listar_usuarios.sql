-- VisionHub -- 113_fix_constructor_lider_red_listar_usuarios.sql
-- Bug real reportado por el owner 2026-08-21, mismo día que se le dio acceso
-- al Constructor a Líder/Supervisor de Red (112_/paneles-contexto.ts): "No
-- se puede cargar" -- el Constructor entero (tanto el resumen como el
-- lienzo, EstructuraOrganizacional.tsx, que en teoría ya soportaba este rol
-- desde KAN-78) fallaba para Líder/Supervisor de Red.
--
-- Causa: obtenerEstructuraOrganizacional() (estructura.service.ts) arma
-- todo con un solo Promise.all -- uno de los llamados es
-- supabase.rpc('fn_listar_usuarios', { p_iglesia_id }), que exige
-- fn_es_super_admin() OR fn_es_operativo_en() (Supervisor) OR
-- fn_es_pastor_en() y devuelve ADMIN_FUERA_DE_ALCANCE para cualquier otro
-- rol. Como es un solo Promise.all, ese único rechazo tumbaba TODA la carga
-- (no solo esta lista, sino la estructura completa: redes, CdP, cargos,
-- etc.), aunque el resto de las consultas sí habría funcionado bien para
-- este rol.
--
-- OJO -- intento anterior de este mismo fix falló en producción
-- (42P13: cannot change return type of existing function) porque se había
-- tomado como base 63_pastor_gestion_supervisor.sql (el espejo en harness),
-- que está desactualizado en DOS cosas respecto a lo realmente desplegado:
-- 1) le falta la columna es_principal (KAN-154,
--    20260810010000_super_admin_secundario_y_eliminar_cuenta.sql), y
-- 2) tiene una regresión ya corregida en el JOIN con persona -- filtraba
--    solo por usuario_id sin acotar por iglesia_id, lo que le daba a una
--    persona con ficha en más de una iglesia el persona_id de la iglesia
--    EQUIVOCADA (encontrado por auditoría cruzada, corregido en
--    20260810300000_fix_regresion_listar_usuarios_persona_iglesia.sql,
--    que es la versión real vigente hoy). Este archivo toma esa versión
--    como base real (no el mirror de harness) y solo le agrega el permiso
--    para Líder/Supervisor de Red -- no reintroduce la regresión de arriba.
--
-- El motivo real de que el lienzo necesite esta lista es solo de lectura:
-- mostrar quién es el Pastor/Supervisor vigente en los nodos PASTOR_SLOT/
-- SUPERVISOR_SLOT del lienzo (ver PanelPrincipalEstructura.tsx), visibles
-- para cualquiera que entre -- no se usa para nada administrativo desde ahí.
-- Se agrega fn_es_lider_de_red_en_iglesia(p_iglesia_id) (42_invitacion_
-- lideres.sql, ya incluye SUBLIDER_RED desde 91_) como alternativa válida,
-- mismo criterio de paridad Líder/Supervisor de Red que ya usa el resto del
-- Constructor.

CREATE OR REPLACE FUNCTION public.fn_listar_usuarios(p_iglesia_id UUID DEFAULT NULL)
RETURNS TABLE (usuario_rol_id UUID, usuario_id UUID, correo VARCHAR, rol rol_sistema_enum, iglesia_id UUID, iglesia_nombre VARCHAR, persona_id UUID, persona_nombre TEXT, es_principal BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    fn_es_super_admin()
    OR (p_iglesia_id IS NOT NULL AND (
      fn_es_operativo_en(p_iglesia_id)
      OR fn_es_pastor_en(p_iglesia_id)
      OR fn_es_lider_de_red_en_iglesia(p_iglesia_id)
    ))
  ) THEN
    RAISE EXCEPTION 'ADMIN_FUERA_DE_ALCANCE: se requiere ser Super Admin, Pastor/Supervisor, o Líder/Supervisor de Red de la iglesia'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    ur.id, ur.usuario_id, u.email::VARCHAR, ur.rol,
    ur.iglesia_id, i.nombre, p.id, fn_nombre_completo(p), ur.es_principal
  FROM usuario_rol ur
  JOIN auth.users u ON u.id = ur.usuario_id
  LEFT JOIN iglesia i ON i.id = ur.iglesia_id
  LEFT JOIN persona p ON p.usuario_id = ur.usuario_id AND p.iglesia_id = ur.iglesia_id AND p.fecha_eliminacion IS NULL
  WHERE ur.fecha_eliminacion IS NULL
    AND ur.rol IN ('SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION')
    AND (p_iglesia_id IS NULL OR ur.iglesia_id = p_iglesia_id)
  ORDER BY u.email;
END;
$$;
