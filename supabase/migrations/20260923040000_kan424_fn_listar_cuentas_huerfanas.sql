-- KAN-424 (2026-09-23, pedido explícito del owner): panel de Super Admin
-- para ver/reparar cuentas huérfanas (auth.users sin ninguna Persona
-- vinculada -- ver el caso real de juannylp@gmail.com, KAN-425). La
-- reparación en sí ya la resuelve sola cualquier "Invitar por correo"
-- (KAN-425) -- esta función es solo el listado para que el Super Admin
-- sepa que existen, sin tener que toparse con el caso por accidente.
--
-- Excluye cuentas ya baneadas (se interpretan como "ya descartadas" --
-- ver accion "descartar_huerfana" del edge function invitar-lider, o
-- cuentas viejas ya baneadas por el bug de KAN-278/279).
--
-- Todos los casts a ::text son a propósito (varchar vs text rompe
-- RETURNS TABLE en runtime -- bug real encontrado en fn_visitas_cdp,
-- 2026-09-21).

begin;

CREATE OR REPLACE FUNCTION public.fn_listar_cuentas_huerfanas()
RETURNS TABLE (
  usuario_id uuid,
  correo text,
  fecha_creacion timestamptz,
  confirmada boolean,
  ultimo_rol text,
  ultima_iglesia_id uuid,
  ultima_iglesia_nombre text,
  ultimo_red_id uuid,
  ultimo_casa_de_paz_id uuid,
  ultimo_departamento_id uuid,
  ultimo_destino_nombre text,
  ultima_invitacion_cancelada_en timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT fn_es_super_admin() THEN
    RAISE EXCEPTION 'CUENTAS_HUERFANAS_SOLO_SUPER_ADMIN: se requiere ser Super Admin' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    (u.email_confirmed_at IS NOT NULL),
    il.rol::text,
    il.iglesia_id,
    ig.nombre::text,
    il.red_id,
    il.casa_de_paz_id,
    il.departamento_id,
    -- fn_etiqueta_cdp(NULL) devuelve 'Casa de Paz sin líder' en vez de NULL
    -- (bug preexistente del helper) -- se lo esquiva acá llamándolo solo
    -- cuando de verdad hay un casa_de_paz_id, para no mostrar un destino
    -- falso en las cuentas que nunca tuvieron ninguna invitación.
    CASE
      WHEN il.red_id IS NOT NULL THEN red.nombre::text
      WHEN il.casa_de_paz_id IS NOT NULL THEN fn_etiqueta_cdp(il.casa_de_paz_id)
      WHEN il.departamento_id IS NOT NULL THEN dep.nombre::text
      ELSE NULL
    END,
    il.fecha_eliminacion
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT * FROM invitacion_lider il2
    WHERE il2.usuario_id = u.id
    ORDER BY il2.fecha_creacion DESC
    LIMIT 1
  ) il ON true
  LEFT JOIN iglesia ig ON ig.id = il.iglesia_id
  LEFT JOIN red ON red.id = il.red_id
  LEFT JOIN departamento dep ON dep.id = il.departamento_id
  WHERE NOT EXISTS (SELECT 1 FROM persona p WHERE p.usuario_id = u.id AND p.fecha_eliminacion IS NULL)
    AND (u.banned_until IS NULL OR u.banned_until < now())
  ORDER BY u.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_listar_cuentas_huerfanas() TO authenticated;

commit;
