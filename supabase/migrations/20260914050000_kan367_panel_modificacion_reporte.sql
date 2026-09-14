-- VisionHub -- KAN-367 (Fase 2, seguimiento de la migracion anterior de hoy):
-- panel de modificacion de reportes.
--
-- 1) fn_cdp_contexto_reporte: contexto de la CdP (Lider, Anfitrion,
--    Direccion, Ciudad) para mostrar cuando quien edita un reporte no es el
--    propio Lider/Sublider de esa CdP (Lider/Supervisor de Red, Pastor,
--    Supervisor de la Vision en Accion editando desde Control de Reportes,
--    donde pueden estar tocando reportes de varias CdP distintas). Mismo
--    patron de subconsultas que fn_resolver_url_registro (KAN-380,
--    20260914030000), reusado tal cual.
-- 2) fn_puede_editar_reporte_cdp seguia dejando pasar a fn_es_super_admin()
--    sin cambios -- eso no se toca. Lo que SI se habilita ahora es que
--    fecha_reunion sea parte de lo editable: no hace falta tocar la policy
--    de UPDATE (ya cubre toda la fila via USING), pero se documenta que
--    fecha_creacion (el ancla real de la ventana) nunca es parte de lo que
--    el cliente puede escribir -- ver comentario en technical-design.

begin;

create or replace function public.fn_cdp_contexto_reporte(p_casa_de_paz_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  r record;
begin
  select
    cdp.iglesia_id,
    fn_etiqueta_cdp(cdp.id) as etiqueta,
    (
      select fn_nombre_completo(pan)
      from casa_de_paz_cargo ccan
      join cargo can on can.id = ccan.cargo_id and can.codigo = 'ANFITRION'
      join persona pan on pan.id = ccan.persona_id
      where ccan.casa_de_paz_id = cdp.id
        and ccan.fecha_fin is null and ccan.fecha_eliminacion is null
      order by ccan.fecha_inicio desc
      limit 1
    ) as anfitrion_nombre,
    (
      select nullif(btrim(concat_ws(' ', d.calle, d.numero)), '')
      from direccion_asignacion da
      join direccion d on d.id = da.direccion_id
      where da.casa_de_paz_id = cdp.id and da.activo and da.fecha_eliminacion is null
      order by da.fecha_creacion desc
      limit 1
    ) as direccion_breve,
    (
      select c.nombre
      from direccion_asignacion da
      join direccion d on d.id = da.direccion_id
      left join ciudad c on c.id = d.ciudad_id
      where da.casa_de_paz_id = cdp.id and da.activo and da.fecha_eliminacion is null
      order by da.fecha_creacion desc
      limit 1
    ) as ciudad_nombre
  into r
  from casa_de_paz cdp
  where cdp.id = p_casa_de_paz_id and cdp.fecha_eliminacion is null;

  if not found or r.iglesia_id not in (select fn_mis_iglesias()) then
    raise exception 'CDP_SIN_PERMISO: no tiene acceso a esta Casa de Paz' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'etiqueta', r.etiqueta,
    'anfitrion_nombre', coalesce(r.anfitrion_nombre, ''),
    'direccion', coalesce(r.direccion_breve, ''),
    'ciudad', coalesce(r.ciudad_nombre, '')
  );
end;
$function$;

grant execute on function public.fn_cdp_contexto_reporte(uuid) to authenticated;

commit;
