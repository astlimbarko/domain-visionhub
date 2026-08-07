-- VisionHub — Constructor de Estructura Organizacional: eliminar una Casa de
-- Paz de verdad (pedido del owner, 2026-08-07). A diferencia de Red, la CdP
-- no tenia ningun estado de "eliminada" (ni agrisado, ni retencion) -- se
-- salta directo al borrado definitivo porque hoy no hay datos reales que
-- proteger. Solo Super Admin, respeta el switch de OTP del modulo, sin
-- ventana de deshacer (a diferencia de Red): la confirmacion es el propio
-- modal antes de ejecutar.

begin;

create or replace function public.fn_estructura_eliminar_casa_de_paz(
  p_cdp_id uuid,
  p_otp text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iglesia_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  if not public.fn_es_super_admin() then
    raise exception 'SOLO_SUPER_ADMIN: solo Super Admin puede eliminar una Casa de Paz de la base de datos'
      using errcode = 'P0001';
  end if;

  select c.iglesia_id into v_iglesia_id
  from public.casa_de_paz c
  where c.id = p_cdp_id;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_CDP_NO_ENCONTRADA' using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  alter table public.casa_de_paz disable trigger trg_no_delete_casa_de_paz;
  alter table public.casa_de_paz_cargo disable trigger trg_no_delete_casa_de_paz_cargo;
  alter table public.casa_de_paz_membresia disable trigger trg_no_delete_casa_de_paz_membresia;
  alter table public.casa_de_paz_red disable trigger trg_no_delete_casa_de_paz_red;
  alter table public.estructura_nodo_posicion disable trigger trg_no_delete_estructura_nodo_posicion;
  alter table public.evento disable trigger trg_no_delete_evento;
  alter table public.fusion_casa_de_paz disable trigger trg_no_delete_fusion_casa_de_paz;
  alter table public.invitacion_lider disable trigger trg_no_delete_invitacion_lider;
  alter table public.meta_evangelismo_asignada disable trigger trg_no_delete_meta_evangelismo_asignada;
  alter table public.multiplicacion_casa_de_paz disable trigger trg_no_delete_multiplicacion_casa_de_paz;
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

  delete from public.persona_llegada where casa_paz_url_id in (
    select id from public.casa_paz_url where casa_de_paz_id = p_cdp_id
      or casa_de_paz_cargo_id in (select id from public.casa_de_paz_cargo where casa_de_paz_id = p_cdp_id)
  );
  delete from public.casa_de_paz_asistencia where reporte_id in (
    select id from public.casa_de_paz_reporte where casa_de_paz_id = p_cdp_id
  );
  delete from public.finanzas_ingreso where casa_de_paz_id = p_cdp_id
    or reporte_id in (select id from public.casa_de_paz_reporte where casa_de_paz_id = p_cdp_id);
  delete from public.casa_paz_url where casa_de_paz_id = p_cdp_id
    or casa_de_paz_cargo_id in (select id from public.casa_de_paz_cargo where casa_de_paz_id = p_cdp_id);
  delete from public.casa_de_paz_cargo where casa_de_paz_id = p_cdp_id;
  delete from public.casa_de_paz_reporte where casa_de_paz_id = p_cdp_id;
  delete from public.casa_de_paz_membresia where casa_de_paz_id = p_cdp_id;
  delete from public.direccion_asignacion where casa_de_paz_id = p_cdp_id;
  delete from public.evangelismo where casa_de_paz_id = p_cdp_id;
  delete from public.evento where casa_de_paz_id = p_cdp_id;
  delete from public.telefono_asignacion where casa_de_paz_id = p_cdp_id;
  delete from public.visita_cdp where casa_de_paz_id = p_cdp_id;
  delete from public.meta_evangelismo_asignada where casa_de_paz_id = p_cdp_id;
  delete from public.migracion_propuesta where cdp_origen_id = p_cdp_id or cdp_destino_id = p_cdp_id;
  delete from public.multiplicacion_casa_de_paz where casa_de_paz_origen_id = p_cdp_id or casa_de_paz_nueva_id = p_cdp_id;
  delete from public.fusion_casa_de_paz where casa_de_paz_origen_id = p_cdp_id or casa_de_paz_destino_id = p_cdp_id;
  delete from public.casa_de_paz_red where casa_de_paz_id = p_cdp_id;
  delete from public.invitacion_lider where casa_de_paz_id = p_cdp_id;
  delete from public.estructura_nodo_posicion where entidad_id = p_cdp_id;

  delete from public.casa_de_paz where id = p_cdp_id;

  alter table public.casa_de_paz enable trigger trg_no_delete_casa_de_paz;
  alter table public.casa_de_paz_cargo enable trigger trg_no_delete_casa_de_paz_cargo;
  alter table public.casa_de_paz_membresia enable trigger trg_no_delete_casa_de_paz_membresia;
  alter table public.casa_de_paz_red enable trigger trg_no_delete_casa_de_paz_red;
  alter table public.estructura_nodo_posicion enable trigger trg_no_delete_estructura_nodo_posicion;
  alter table public.evento enable trigger trg_no_delete_evento;
  alter table public.fusion_casa_de_paz enable trigger trg_no_delete_fusion_casa_de_paz;
  alter table public.invitacion_lider enable trigger trg_no_delete_invitacion_lider;
  alter table public.meta_evangelismo_asignada enable trigger trg_no_delete_meta_evangelismo_asignada;
  alter table public.multiplicacion_casa_de_paz enable trigger trg_no_delete_multiplicacion_casa_de_paz;
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

revoke all on function public.fn_estructura_eliminar_casa_de_paz(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_estructura_eliminar_casa_de_paz(uuid, text) to authenticated;

commit;
