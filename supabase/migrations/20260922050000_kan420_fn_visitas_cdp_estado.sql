-- KAN-420 seguimiento (2026-09-22, pedido explícito del owner): en el
-- reporte de Casa de Paz, un "Asistente Nuevo" (visita sin membresía
-- formal) que ya llegó a NC (Nuevo Convertido) tiene que verse en su zona
-- de "menores de 12 años" cuando corresponda, con la etiqueta corta "NC" --
-- hoy fn_visitas_cdp no devuelve el estado, así que el frontend no tiene
-- con qué mostrarlo ni agruparlo. Se agrega estado_sigla (SIM/NC/CRE/RE
-- vigente) a la firma. También se agrega edad_aproximada (KAN-406) como
-- respaldo de la edad cuando no hay fecha_nacimiento real, mismo criterio
-- ya usado en el resto del proyecto.

begin;

DROP FUNCTION IF EXISTS public.fn_visitas_cdp(uuid);

CREATE OR REPLACE FUNCTION public.fn_visitas_cdp(p_casa_de_paz_id uuid)
 RETURNS TABLE(persona_id uuid, nombre_completo text, sexo sexo_enum, tiene_fecha_nacimiento boolean, edad integer, estado_sigla text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not fn_puede_ver_cdp(p_casa_de_paz_id) then
    raise exception 'CDP_FUERA_DE_ALCANCE' using errcode = 'P0001';
  end if;

  return query
  select p.id, fn_nombre_completo(p), p.sexo, p.fecha_nacimiento is not null,
         case
           when p.fecha_nacimiento is not null then extract(year from age(p.fecha_nacimiento))::int
           else p.edad_aproximada
         end,
         e.sigla
  from persona p
  left join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
  left join estado e on e.id = pe.estado_id
  where p.fecha_eliminacion is null
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

GRANT EXECUTE ON FUNCTION public.fn_visitas_cdp(uuid) TO authenticated;

commit;
