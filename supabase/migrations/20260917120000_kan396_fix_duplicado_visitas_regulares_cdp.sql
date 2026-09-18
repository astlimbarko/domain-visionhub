-- VisionHub -- KAN-396 (2026-09-17): fn_visitas_regulares_cdp excluía solo
-- a quien tiene membresía PRINCIPAL en esta CdP -- si una persona tiene una
-- membresía SECUNDARIA (es_principal=false, ej. asiste a 2 CdP) en esta
-- misma CdP, no quedaba excluida, y aparecía duplicada en
-- obtenerMiembrosCdp (reporte.service.ts:142), que trae TODAS las
-- membresías de la CdP (principal o no) en su propia consulta, sin ese
-- filtro. Alinear la exclusión: cualquier membresía activa en esta CdP
-- (principal o secundaria) ya cubre a esa persona por el otro camino, no
-- hace falta que fn_visitas_regulares_cdp la traiga de nuevo.
CREATE OR REPLACE FUNCTION public.fn_visitas_regulares_cdp(p_casa_de_paz_id uuid)
 RETURNS TABLE(persona_id uuid, nombre_completo text, sexo sexo_enum, tiene_fecha_nacimiento boolean, edad integer)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        and cm.fecha_fin is null and cm.fecha_eliminacion is null
    );
end;
$function$;
