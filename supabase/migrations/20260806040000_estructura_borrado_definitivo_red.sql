-- VisionHub — Estructura Organizacional: borrado DEFINITIVO de una Red ya
-- eliminada (agrisada), pedido explicito del owner (KAN-85). Solo Super
-- Admin puede iniciarlo; Supervisor de la Vision solo puede reactivar (sin
-- cambios en fn_estructura_reactivar_red). Ventana de 60 segundos para
-- deshacer, respaldada en la base (no solo en el navegador) via una columna
-- + una tarea programada (pg_cron) que recien borra de verdad cuando pasan
-- los 60s sin deshacer. Deshacer NO reactiva la Red -- vuelve a verse
-- agrisada, tal como estaba antes de programar el borrado.

begin;

alter table public.red
  add column if not exists fecha_borrado_definitivo_programado timestamptz;

-- Ocultar de inmediato (para todos, no solo quien lo pidio) en cuanto se
-- programa el borrado -- ademas del corte de 1 año ya existente.
drop policy if exists pol_red_select on public.red;

create policy pol_red_select on public.red
  for select
  to authenticated
  using (
    iglesia_id in (select fn_mis_iglesias())
    and fecha_borrado_definitivo_programado is null
    and (fecha_eliminacion is null or fecha_eliminacion >= now() - interval '1 year')
  );

create or replace function public.fn_estructura_programar_borrado_red(
  p_red_id uuid,
  p_otp text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_red_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'SOLO_SUPER_ADMIN: solo Super Admin puede eliminar una Red de la base de datos'
      using errcode = 'P0001';
  end if;

  select r.id into v_red_id
  from public.red r
  where r.id = p_red_id
    and r.fecha_eliminacion is not null
    and r.fecha_borrado_definitivo_programado is null;

  if v_red_id is null then
    raise exception 'ESTRUCTURA_RED_NO_ENCONTRADA: la Red no existe, no esta eliminada, o ya tiene un borrado programado'
      using errcode = 'P0001';
  end if;

  if not public.fn_verificar_otp(p_otp) then
    raise exception 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      using errcode = 'P0001';
  end if;

  update public.red
  set fecha_borrado_definitivo_programado = now()
  where id = v_red_id;
end;
$$;

create or replace function public.fn_estructura_deshacer_borrado_red(
  p_red_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'SOLO_SUPER_ADMIN' using errcode = 'P0001';
  end if;

  update public.red
  set fecha_borrado_definitivo_programado = null
  where id = p_red_id and fecha_borrado_definitivo_programado is not null;
end;
$$;

revoke all on function public.fn_estructura_programar_borrado_red(uuid, text) from public, anon, authenticated;
revoke all on function public.fn_estructura_deshacer_borrado_red(uuid) from public, anon, authenticated;
grant execute on function public.fn_estructura_programar_borrado_red(uuid, text) to authenticated;
grant execute on function public.fn_estructura_deshacer_borrado_red(uuid) to authenticated;

-- ============================================================
-- Barrido programado: borra de verdad las Redes cuyo borrado definitivo
-- fue programado hace 60+ segundos y nadie deshizo. Mismo patron de
-- deshabilitar trg_no_delete_* usado hoy para purgar Redes de prueba a
-- mano -- acá corre solo, sin intervencion, via pg_cron.
-- ============================================================

create extension if not exists pg_cron;

create or replace function public.fn_estructura_ejecutar_borrados_programados()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_red_ids uuid[];
  v_red_id uuid;
  v_cdp_ids uuid[];
begin
  -- Materializar los ids ANTES de tocar triggers: un ALTER TABLE no puede
  -- correr mientras esta sesion todavia tiene un cursor/plan abierto sobre
  -- esa misma tabla (bug real encontrado probando esta migracion: "cannot
  -- ALTER TABLE red because it is being used by active queries in this
  -- session" cuando el disable estaba DENTRO de un `for v_red in select ...
  -- from red loop`).
  select array_agg(id) into v_red_ids
  from public.red
  where fecha_borrado_definitivo_programado is not null
    and fecha_borrado_definitivo_programado <= now() - interval '60 seconds';

  if v_red_ids is null then
    return;
  end if;

  alter table public.red disable trigger trg_no_delete_red;
  alter table public.casa_de_paz disable trigger trg_no_delete_casa_de_paz;
  alter table public.casa_de_paz_cargo disable trigger trg_no_delete_casa_de_paz_cargo;
  alter table public.casa_de_paz_membresia disable trigger trg_no_delete_casa_de_paz_membresia;
  alter table public.casa_de_paz_red disable trigger trg_no_delete_casa_de_paz_red;
  alter table public.estructura_nodo_posicion disable trigger trg_no_delete_estructura_nodo_posicion;
  alter table public.evento disable trigger trg_no_delete_evento;
  alter table public.fusion_casa_de_paz disable trigger trg_no_delete_fusion_casa_de_paz;
  alter table public.fusion_red disable trigger trg_no_delete_fusion_red;
  alter table public.invitacion_lider disable trigger trg_no_delete_invitacion_lider;
  alter table public.meta_evangelismo_asignada disable trigger trg_no_delete_meta_evangelismo_asignada;
  alter table public.multiplicacion_casa_de_paz disable trigger trg_no_delete_multiplicacion_casa_de_paz;
  alter table public.multiplicacion_red disable trigger trg_no_delete_multiplicacion_red;
  alter table public.red_cargo disable trigger trg_no_delete_red_cargo;
  alter table public.visita_cdp disable trigger trg_no_delete_visita_cdp;
  alter table public.casa_de_paz_reporte disable trigger trg_no_delete_casa_de_paz_reporte;
  alter table public.casa_paz_url disable trigger trg_no_delete_casa_paz_url;
  alter table public.direccion_asignacion disable trigger trg_no_delete_direccion_asignacion;
  alter table public.evangelismo disable trigger trg_no_delete_evangelismo;
  alter table public.finanzas_ingreso disable trigger trg_no_delete_finanzas_ingreso;
  alter table public.migracion_propuesta disable trigger trg_no_delete_migracion_propuesta;
  alter table public.telefono_asignacion disable trigger trg_no_delete_telefono_asignacion;
  alter table public.casa_de_paz_asistencia disable trigger trg_no_delete_casa_de_paz_asistencia;
  alter table public.persona_llegada disable trigger trg_no_delete_persona_llegada;

  foreach v_red_id in array v_red_ids loop
    select array_agg(casa_de_paz_id) into v_cdp_ids
    from public.casa_de_paz_red where red_id = v_red_id;
    v_cdp_ids := coalesce(v_cdp_ids, array[]::uuid[]);

    delete from public.persona_llegada where casa_paz_url_id in (
      select id from public.casa_paz_url where casa_de_paz_id = any(v_cdp_ids)
        or casa_de_paz_cargo_id in (select id from public.casa_de_paz_cargo where casa_de_paz_id = any(v_cdp_ids))
    );
    delete from public.casa_de_paz_asistencia where reporte_id in (
      select id from public.casa_de_paz_reporte where casa_de_paz_id = any(v_cdp_ids)
    );
    delete from public.finanzas_ingreso where casa_de_paz_id = any(v_cdp_ids)
      or reporte_id in (select id from public.casa_de_paz_reporte where casa_de_paz_id = any(v_cdp_ids));
    delete from public.casa_paz_url where casa_de_paz_id = any(v_cdp_ids)
      or casa_de_paz_cargo_id in (select id from public.casa_de_paz_cargo where casa_de_paz_id = any(v_cdp_ids));
    delete from public.casa_de_paz_cargo where casa_de_paz_id = any(v_cdp_ids);
    delete from public.casa_de_paz_reporte where casa_de_paz_id = any(v_cdp_ids);
    delete from public.casa_de_paz_membresia where casa_de_paz_id = any(v_cdp_ids);
    delete from public.direccion_asignacion where casa_de_paz_id = any(v_cdp_ids);
    delete from public.evangelismo where casa_de_paz_id = any(v_cdp_ids);
    delete from public.evento where casa_de_paz_id = any(v_cdp_ids) or red_id = v_red_id;
    delete from public.telefono_asignacion where casa_de_paz_id = any(v_cdp_ids);
    delete from public.visita_cdp where casa_de_paz_id = any(v_cdp_ids) or red_id = v_red_id;
    delete from public.meta_evangelismo_asignada where casa_de_paz_id = any(v_cdp_ids) or red_id = v_red_id;
    delete from public.migracion_propuesta where cdp_origen_id = any(v_cdp_ids) or cdp_destino_id = any(v_cdp_ids);
    delete from public.multiplicacion_casa_de_paz where casa_de_paz_origen_id = any(v_cdp_ids) or casa_de_paz_nueva_id = any(v_cdp_ids);
    delete from public.fusion_casa_de_paz where casa_de_paz_origen_id = any(v_cdp_ids) or casa_de_paz_destino_id = any(v_cdp_ids);
    delete from public.casa_de_paz_red where casa_de_paz_id = any(v_cdp_ids) or red_id = v_red_id;
    delete from public.invitacion_lider where casa_de_paz_id = any(v_cdp_ids) or red_id = v_red_id;
    delete from public.red_cargo where red_id = v_red_id;
    delete from public.fusion_red where red_origen_id = v_red_id or red_destino_id = v_red_id;
    delete from public.multiplicacion_red where red_origen_id = v_red_id or red_nueva_id = v_red_id;
    delete from public.solicitud_estructura where red_id = v_red_id;
    delete from public.estructura_nodo_posicion where entidad_id = v_red_id or entidad_id = any(v_cdp_ids);

    delete from public.casa_de_paz where id = any(v_cdp_ids);
    delete from public.red where id = v_red_id;
  end loop;

    alter table public.red enable trigger trg_no_delete_red;
    alter table public.casa_de_paz enable trigger trg_no_delete_casa_de_paz;
    alter table public.casa_de_paz_cargo enable trigger trg_no_delete_casa_de_paz_cargo;
    alter table public.casa_de_paz_membresia enable trigger trg_no_delete_casa_de_paz_membresia;
    alter table public.casa_de_paz_red enable trigger trg_no_delete_casa_de_paz_red;
    alter table public.estructura_nodo_posicion enable trigger trg_no_delete_estructura_nodo_posicion;
    alter table public.evento enable trigger trg_no_delete_evento;
    alter table public.fusion_casa_de_paz enable trigger trg_no_delete_fusion_casa_de_paz;
    alter table public.fusion_red enable trigger trg_no_delete_fusion_red;
    alter table public.invitacion_lider enable trigger trg_no_delete_invitacion_lider;
    alter table public.meta_evangelismo_asignada enable trigger trg_no_delete_meta_evangelismo_asignada;
    alter table public.multiplicacion_casa_de_paz enable trigger trg_no_delete_multiplicacion_casa_de_paz;
    alter table public.multiplicacion_red enable trigger trg_no_delete_multiplicacion_red;
    alter table public.red_cargo enable trigger trg_no_delete_red_cargo;
    alter table public.visita_cdp enable trigger trg_no_delete_visita_cdp;
    alter table public.casa_de_paz_reporte enable trigger trg_no_delete_casa_de_paz_reporte;
    alter table public.casa_paz_url enable trigger trg_no_delete_casa_paz_url;
    alter table public.direccion_asignacion enable trigger trg_no_delete_direccion_asignacion;
    alter table public.evangelismo enable trigger trg_no_delete_evangelismo;
    alter table public.finanzas_ingreso enable trigger trg_no_delete_finanzas_ingreso;
    alter table public.migracion_propuesta enable trigger trg_no_delete_migracion_propuesta;
    alter table public.telefono_asignacion enable trigger trg_no_delete_telefono_asignacion;
    alter table public.casa_de_paz_asistencia enable trigger trg_no_delete_casa_de_paz_asistencia;
    alter table public.persona_llegada enable trigger trg_no_delete_persona_llegada;
end;
$$;

revoke all on function public.fn_estructura_ejecutar_borrados_programados() from public, anon, authenticated;

select cron.schedule(
  'estructura-borrar-redes-programadas',
  '* * * * *',
  $$select public.fn_estructura_ejecutar_borrados_programados();$$
);

commit;
