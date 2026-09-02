-- VisionHub -- Supervisor de la Visión en Acción cruzado madre/satélite.
-- Caso real (Montero, satélite de 4 Anillo): un Supervisor de la satélite es
-- una persona que pertenece a otra iglesia (la madre). Ya tiene el rol
-- SUPERVISOR_VISION_ACCION en la satélite (permiso operativo OK), pero "no se
-- posiciona": aparece SIN NOMBRE en el Constructor de la satélite.
--
-- Causa: un usuario tiene UNA sola persona (uq_persona_usuario, unico sobre
-- usuario_id), que vive en su iglesia madre. fn_listar_usuarios resolvia el
-- nombre con `JOIN persona ON p.usuario_id = ur.usuario_id AND p.iglesia_id =
-- ur.iglesia_id`. Para el supervisor cruzado ese join da NULL -> fila sin
-- nombre. (Ese join con iglesia_id se agregó en 20260810300000 para otro bug
-- -- una persona con ficha en varias iglesias --, hoy imposible por el indice
-- unico.)
--
-- Fix: resolver la persona con preferencia misma-iglesia y FALLBACK a la unica
-- persona activa del usuario (subconsulta lateral). Como cada usuario tiene una
-- sola persona activa, el fallback es determinista y no reintroduce el bug de
-- 20260810300000. Se resuelve el nombre DENTRO del lateral (fn_nombre_completo
-- necesita una fila persona completa).
--
-- Se reproduce la definicion REAL vigente en produccion (10 columnas, incluye
-- membresia_completada de KAN-266) y solo se cambia el join de persona --
-- misma firma, mismo chequeo de permiso, sin cambio de tipo de retorno.

CREATE OR REPLACE FUNCTION public.fn_listar_usuarios(p_iglesia_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(usuario_rol_id uuid, usuario_id uuid, correo character varying, rol rol_sistema_enum, iglesia_id uuid, iglesia_nombre character varying, persona_id uuid, persona_nombre text, es_principal boolean, membresia_completada boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not (fn_es_super_admin() or (p_iglesia_id is not null and (fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id)))) then
    raise exception 'ADMIN_FUERA_DE_ALCANCE: se requiere ser Super Admin o Pastor/Supervisor de la iglesia'
      using errcode = 'P0001';
  end if;

  return query
  select
    ur.id, ur.usuario_id, u.email::varchar, ur.rol,
    ur.iglesia_id, i.nombre, p.id, p.nombre, ur.es_principal,
    coalesce(p.membresia_completada, false)
  from usuario_rol ur
  join auth.users u on u.id = ur.usuario_id
  left join iglesia i on i.id = ur.iglesia_id
  -- Preferencia misma-iglesia; si no hay (supervisor cruzado), la unica persona
  -- del usuario (su ficha en la madre) para que igual muestre nombre.
  left join lateral (
    select pp.id, fn_nombre_completo(pp) as nombre, pp.membresia_completada
    from persona pp
    where pp.usuario_id = ur.usuario_id and pp.fecha_eliminacion is null
    order by (pp.iglesia_id = ur.iglesia_id) desc, pp.fecha_creacion
    limit 1
  ) p on true
  where ur.fecha_eliminacion is null
    and ur.rol in ('SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION')
    and (p_iglesia_id is null or ur.iglesia_id = p_iglesia_id)
  order by u.email;
end;
$function$;
