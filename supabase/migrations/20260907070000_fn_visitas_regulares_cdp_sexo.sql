-- VisionHub -- fn_visitas_regulares_cdp ahora también devuelve `sexo`, para
-- poder reusarla en "Historial de Asistencia" (obtenerHistorialAsistencia),
-- que hoy solo trae miembros formales de casa_de_paz_membresia -- mismo
-- hueco que ya se tapó en "Asistencia Regular" y "Personas" (2026-09-07).

drop function if exists public.fn_visitas_regulares_cdp(uuid);

create function public.fn_visitas_regulares_cdp(p_casa_de_paz_id uuid)
returns table(persona_id uuid, nombre_completo text, sexo sexo_enum, tiene_fecha_nacimiento boolean, edad int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_orden_nc int;
begin
  if not fn_puede_ver_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  select orden into v_orden_nc from estado where sigla = 'NC' and fecha_eliminacion is null;
  if v_orden_nc is null then
    return;
  end if;

  return query
  select p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento is not null,
         case when p.fecha_nacimiento is null then null
              else extract(year from age(p.fecha_nacimiento))::int end
  from persona p
  join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
  join estado e on e.id = pe.estado_id
  where p.fecha_eliminacion is null
    and e.orden >= v_orden_nc
    and exists (
      select 1 from casa_de_paz_asistencia a
      join casa_de_paz_reporte r on r.id = a.reporte_id
      where a.persona_id = p.id and r.casa_de_paz_id = p_casa_de_paz_id
        and a.fecha_eliminacion is null and r.fecha_eliminacion is null
    )
    and not exists (
      select 1 from casa_de_paz_membresia cm
      where cm.persona_id = p.id and cm.casa_de_paz_id = p_casa_de_paz_id
        and cm.es_principal and cm.fecha_fin is null and cm.fecha_eliminacion is null
    );
end;
$$;

grant execute on function fn_visitas_regulares_cdp(uuid) to authenticated;
