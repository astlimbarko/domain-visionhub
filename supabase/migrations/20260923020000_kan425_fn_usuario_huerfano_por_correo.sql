-- KAN-425 (2026-09-23, pedido explícito del owner): cuando "Invitar" choca
-- con el 409 de correo ya existente y esa cuenta no tiene ninguna Persona
-- vinculada (huérfana -- quedó a medias de un alta anterior, ver el caso
-- real de juannylp@gmail.com), el backend necesita el usuario_id de esa
-- cuenta para poder recuperarla (armarle una invitación pendiente nueva
-- sin crear una cuenta duplicada). Solo devuelve algo en ese caso puntual
-- (huérfana) -- no es un buscador genérico de usuario_id por correo, para
-- no exponer más de lo que hace falta.

begin;

CREATE OR REPLACE FUNCTION public.fn_usuario_huerfano_por_correo(p_correo text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_correo)
    and not exists (
      select 1 from public.persona p where p.usuario_id = u.id and p.fecha_eliminacion is null
    )
  limit 1;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_usuario_huerfano_por_correo(text) TO authenticated;

commit;
