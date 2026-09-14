-- VisionHub -- KAN-380 seguimiento (2026-09-14): 2 ajustes pedidos por el
-- owner tras ver el resultado en vivo.
--
-- 1) Agrega Ciudad (via direccion.ciudad_id -> ciudad.nombre -- el campo
--    de texto libre "direccion.ciudad" quedo sin usar, la fuente real hoy
--    es el catalogo normalizado). Se devuelve junto con anfitrion/direccion.
-- 2) anfitrion_nombre/direccion/ciudad ya NO se omiten cuando faltan --
--    ahora vienen como '' (string vacio) en vez de NULL, para que el
--    frontend siempre muestre la etiqueta ("Anfitrion: ", en blanco) y el
--    Lider vea de un vistazo que le falta cargar ese dato, en vez de que
--    la linea entera desaparezca sin dejar rastro.

begin;

create or replace function public.fn_resolver_url_registro(p_slug character varying)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  r record;
begin
  select cpu.estado, fn_config_bool(cpu.iglesia_id, 'REGISTRO_URL_ACTIVO') as iglesia_activa,
         fn_nombre_completo(p) as lider_nombre,
         fn_etiqueta_cdp(cdp.id) as cdp_nombre,
         r_.nombre as red_nombre,
         i.nombre as iglesia_nombre,
         cpu.iglesia_id as iglesia_id,
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
  from casa_paz_url cpu
  join persona p on p.id = cpu.persona_id
  join casa_de_paz cdp on cdp.id = cpu.casa_de_paz_id
  join iglesia i on i.id = cpu.iglesia_id
  left join casa_de_paz_red cdr on cdr.casa_de_paz_id = cdp.id
       and cdr.fecha_fin is null and cdr.fecha_eliminacion is null
  left join red r_ on r_.id = cdr.red_id
  where cpu.slug = p_slug and cpu.fecha_eliminacion is null;

  if not found or r.estado <> 'ACTIVO' or not r.iglesia_activa then
    return jsonb_build_object('admite_registro', false);
  end if;

  return jsonb_build_object(
    'admite_registro', true,
    'lider_nombre', r.lider_nombre,
    'casa_de_paz_nombre', r.cdp_nombre,
    'red_nombre', r.red_nombre,
    'anfitrion_nombre', coalesce(r.anfitrion_nombre, ''),
    'direccion', coalesce(r.direccion_breve, ''),
    'ciudad', coalesce(r.ciudad_nombre, ''),
    'iglesia_nombre', r.iglesia_nombre,
    'campos_obligatorios', jsonb_build_object(
      'ci', fn_config_bool(r.iglesia_id, 'MEMBRESIA_CI_OBLIGATORIO'),
      'fecha_nacimiento', fn_config_bool(r.iglesia_id, 'MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO'),
      'ocupacion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_OCUPACION_OBLIGATORIO'),
      'grado_instruccion', fn_config_bool(r.iglesia_id, 'MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO')
    )
  );
end;
$function$;

commit;
