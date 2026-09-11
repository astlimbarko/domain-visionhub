-- VisionHub -- 20260910010000_kan358_afirmacion_excluir_semillas.sql
--
-- KAN-358 seguimiento (hallazgo del owner probando en vivo, 2026-09-10):
-- las estadisticas de Afirmacion (KPIs de /afirmacion-personas) contaban
-- personas de tipo "Semilla" -- registros de Evangelismo que son solo un
-- conteo, sin datos reales de la persona (mismo criterio que ya usa
-- fn_buscar_personas via p_excluir_semillas, ver Personas.tsx). Afirmacion
-- es membresia real, esas filas nunca deben sumar ahi.
--
-- Confirmado con censo directo: 4 Anillo tenia 13 personas "Semilla" de 344
-- (real: 331), Montero 5 de 202 (real: 197).

CREATE OR REPLACE FUNCTION public.fn_afirmacion_estadisticas_personas(p_iglesia_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total int;
  v_por_estado jsonb;
  v_hombres int;
  v_mujeres int;
  v_con_profesion int;
  v_por_estado_civil jsonb;
begin
  if not (fn_es_lider_afirmacion_en(p_iglesia_id) or fn_es_operativo_en(p_iglesia_id) or fn_es_pastor_en(p_iglesia_id) or fn_es_super_admin()) then
    raise exception 'AFIRMACION_SIN_PERMISO: no tiene acceso al modulo de Afirmacion en esta iglesia'
      using errcode = 'P0001';
  end if;

  select count(*),
         count(*) filter (where sexo = 'M'),
         count(*) filter (where sexo = 'F')
  into v_total, v_hombres, v_mujeres
  from persona p
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    and not exists (
      select 1 from evangelismo ev
      join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id
      where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null
    );

  select jsonb_object_agg(coalesce(e.sigla, 'SIN_ESTADO'), conteo)
  into v_por_estado
  from (
    select pe.estado_id, count(*) as conteo
    from persona p
    left join persona_estado pe on pe.persona_id = p.id and pe.fecha_fin is null and pe.fecha_eliminacion is null
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
      and not exists (
        select 1 from evangelismo ev
        join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id
        where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null
      )
    group by pe.estado_id
  ) c
  left join estado e on e.id = c.estado_id;

  select count(*) filter (where d.ocupacion is not null and trim(d.ocupacion) <> '')
  into v_con_profesion
  from persona p
  left join persona_detalle d on d.persona_id = p.id
  where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
    and not exists (
      select 1 from evangelismo ev
      join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id
      where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null
    );

  select jsonb_object_agg(coalesce(d.estado_civil::text, 'SIN_ESTADO_CIVIL'), conteo)
  into v_por_estado_civil
  from (
    select d.estado_civil, count(*) as conteo
    from persona p
    left join persona_detalle d on d.persona_id = p.id
    where p.iglesia_id = p_iglesia_id and p.fecha_eliminacion is null and not p.oculto
      and not exists (
        select 1 from evangelismo ev
        join tipo_evangelismo te on te.id = ev.tipo_evangelismo_id
        where ev.persona_id = p.id and te.codigo = 'SEMILLA' and ev.fecha_eliminacion is null
      )
    group by d.estado_civil
  ) d;

  return jsonb_build_object(
    'total', v_total,
    'hombres', v_hombres,
    'mujeres', v_mujeres,
    'por_estado', coalesce(v_por_estado, '{}'::jsonb),
    'con_profesion', v_con_profesion,
    'por_estado_civil', coalesce(v_por_estado_civil, '{}'::jsonb)
  );
end;
$function$;
