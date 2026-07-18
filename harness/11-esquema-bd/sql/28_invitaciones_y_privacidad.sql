-- VisionHub -- 28_invitaciones_y_privacidad.sql
-- Dos pedidos del owner (2026-07-19), sin relacion entre si mas que llegar
-- juntos en la misma conversacion:
--
-- 1. Alta de usuarios por invitacion (Super Admin, o Pastor/Supervisor
--    dentro de su propia iglesia): la Edge Function `invitar-usuario` crea
--    la cuenta con el correo (unica columna que exige) y manda el enlace de
--    Supabase para elegir contrasena. Esta funcion SQL es el filtro grueso
--    que la Edge Function consulta ANTES de gastar una invitacion: evita
--    que cualquiera cree cuentas nuevas via la funcion, aunque la decision
--    fina de que rol puede asignar quien ya la hace `trg_validar_rol`
--    (05_funciones_acceso.sql) en el INSERT de usuario_rol que sigue.
--
-- 2. Privacidad de datos personales para cargos ministeriales (Apostol,
--    Profeta, Evangelista, Maestro, Pastor): el nombre y los cargos de esa
--    Persona siguen visibles para cualquiera con acceso a la iglesia (nadie
--    deja de aparecer en un buscador de cargos), pero CI, telefono,
--    direccion y los datos de persona_detalle solo los ve un SUPER_ADMIN o
--    el Pastor de esa iglesia.
--
--    Limite real de Postgres: RLS filtra FILAS, no columnas. `ci`,
--    `correo` y `fecha_nacimiento` viven en la propia tabla `persona`
--    junto con `primer_nombre` (que sí debe seguir visible) -- no se pueden
--    ocultar sin mover esas columnas a otra tabla, y eso es una migracion
--    real que toca Reportes (chequeo `es_menor` por `fecha_nacimiento`) y
--    Calendario (`fn_cumpleanos_cdp`), ambos ya construidos y probados. NO
--    se hace en esta pasada -- queda pendiente, a decidir con el owner,
--    probablemente cuando se construya el modulo Personas (que va a crear
--    la primera pantalla que muestra la ficha completa de una persona).
--
--    Lo que SI se puede cerrar ahora sin tocar nada ya construido:
--    `persona_detalle`, `direccion_asignacion` y `telefono_asignacion` son
--    tablas separadas que ningun modulo de frontend usa todavia (Personas
--    no existe aun) -- se les acota el SELECT sin ningun riesgo.

-- ============================================================
-- 1. Invitaciones
-- ============================================================
CREATE OR REPLACE FUNCTION fn_puede_invitar(p_iglesia_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fn_es_super_admin() OR (p_iglesia_id IS NOT NULL AND fn_es_operativo_en(p_iglesia_id));
$$;

-- ============================================================
-- 2. Privacidad de cargos ministeriales
-- ============================================================
CREATE OR REPLACE FUNCTION fn_es_dato_confidencial(p_persona_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM persona_cargo pc
    JOIN cargo c ON c.id = pc.cargo_id
    WHERE pc.persona_id = p_persona_id
      AND c.codigo IN ('APOSTOL', 'PROFETA', 'EVANGELISTA', 'MAESTRO', 'PASTOR')
      AND pc.fecha_fin IS NULL AND pc.fecha_eliminacion IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_puede_ver_confidencial(p_persona_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    NOT fn_es_dato_confidencial(p_persona_id)
    OR fn_es_super_admin()
    OR fn_es_pastor_en((SELECT iglesia_id FROM persona WHERE id = p_persona_id));
$$;

DROP POLICY IF EXISTS pol_persona_detalle_select ON persona_detalle;
CREATE POLICY pol_persona_detalle_select ON persona_detalle
  FOR SELECT TO authenticated
  USING (
    fecha_eliminacion IS NULL
    AND persona_id IN (SELECT id FROM persona WHERE iglesia_id IN (SELECT fn_mis_iglesias()))
    AND fn_puede_ver_confidencial(persona_id)
  );

DROP POLICY IF EXISTS pol_direccion_asignacion_select ON direccion_asignacion;
CREATE POLICY pol_direccion_asignacion_select ON direccion_asignacion
  FOR SELECT TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fecha_eliminacion IS NULL
    AND (persona_id IS NULL OR fn_puede_ver_confidencial(persona_id))
  );

DROP POLICY IF EXISTS pol_telefono_asignacion_select ON telefono_asignacion;
CREATE POLICY pol_telefono_asignacion_select ON telefono_asignacion
  FOR SELECT TO authenticated
  USING (
    iglesia_id IN (SELECT fn_mis_iglesias())
    AND fecha_eliminacion IS NULL
    AND (persona_id IS NULL OR fn_puede_ver_confidencial(persona_id))
  );
