-- VisionHub -- Estructura Organizacional: dias de retencion configurables
-- antes de que una Red/Casa de Paz eliminada (agrisada) desaparezca del
-- lienzo -- pedido explicito del owner (KAN-111, relacionado con KAN-87).
--
-- Hoy Red usa un fijo de 365 dias (interval '1 year', sin configurar,
-- 20260806010000_estructura_red_select_periodo_gracia.sql) y Casa de Paz NO
-- TIENE ningun periodo de gracia: al eliminarse (fn_eliminar_cdp, soft-delete
-- con motivo, 109_historico_cdp_eliminadas.sql ya aplicada contra la base
-- real) desaparece del todo de inmediato via la politica generica de RLS
-- (fecha_eliminacion IS NULL, patron generico de 16_rls.sql). Se agregan 2
-- criterios configurables (mismo motor que ya usa Control de Reportes,
-- 108_control_reportes_plazo_configurable.sql: configuracion_definicion +
-- fn_criterio), configurables por el Supervisor desde su propio panel --
-- fn_panel_configuracion ya expone cualquier categoria nueva sin cambios de
-- codigo en el backend, el frontend ya renderiza cualquier categoria nueva
-- (cae en "Otros" si no tiene mapeo de nombre bonito).
--
-- Casa de Paz tambien suma la contraparte de reactivar (no existia ninguna
-- forma de deshacer un fn_eliminar_cdp hasta ahora). Alcance fuera de esta
-- sesion, documentado en KAN-111: la ventana de "borrado definitivo" con
-- cron + deshacer de 60s que ya tiene Red (KAN-85/52) no se replica para
-- CdP -- el borrado permanente de CdP sigue siendo el instantaneo ya
-- existente para Super Admin (fn_estructura_eliminar_casa_de_paz).

begin;

insert into public.configuracion_definicion
  (codigo, nombre, descripcion, tipo, valor_defecto, valor_min, valor_max, unidad, categoria, modulo, orden)
values
  (
    'DIAS_RETENCION_RED',
    'Días de retención de una Red eliminada',
    'Días que una Red eliminada sigue visible (agrisada) en el lienzo de Estructura Organizacional antes de desaparecer del front. Nunca borra la fila de la base de datos.',
    'NUMERICO', '365', 1, 3650, 'días', 'ESTRUCTURA', 1, 90
  ),
  (
    'DIAS_RETENCION_CDP',
    'Días de retención de una Casa de Paz eliminada',
    'Días que una Casa de Paz eliminada sigue visible (agrisada) en el lienzo de Estructura Organizacional antes de desaparecer del front. Nunca borra la fila de la base de datos.',
    'NUMERICO', '365', 1, 3650, 'días', 'ESTRUCTURA', 1, 91
  )
on conflict (codigo) do update set
  nombre = excluded.nombre, descripcion = excluded.descripcion, tipo = excluded.tipo,
  valor_defecto = excluded.valor_defecto, valor_min = excluded.valor_min, valor_max = excluded.valor_max,
  unidad = excluded.unidad, categoria = excluded.categoria, modulo = excluded.modulo, orden = excluded.orden;

-- Red: mismo criterio de visibilidad que ya regia, ahora configurable por
-- iglesia en vez de un intervalo fijo en el codigo.
drop policy if exists pol_red_select on public.red;

create policy pol_red_select on public.red
  for select
  to authenticated
  using (
    iglesia_id in (select fn_mis_iglesias())
    and (
      fecha_eliminacion is null
      or fecha_eliminacion >= now() - (fn_criterio(iglesia_id, 'DIAS_RETENCION_RED')::text || ' days')::interval
    )
  );

-- Casa de Paz: hoy usa la politica generica de dominio (fecha_eliminacion IS
-- NULL), que la oculta de inmediato al eliminarse -- se reemplaza por el
-- mismo patron de gracia que ya tiene Red.
drop policy if exists pol_casa_de_paz_select on public.casa_de_paz;

create policy pol_casa_de_paz_select on public.casa_de_paz
  for select
  to authenticated
  using (
    iglesia_id in (select fn_mis_iglesias())
    and (
      fecha_eliminacion is null
      or fecha_eliminacion >= now() - (fn_criterio(iglesia_id, 'DIAS_RETENCION_CDP')::text || ' days')::interval
    )
  );

-- Contraparte de fn_eliminar_cdp: sin esto, una Casa de Paz eliminada dentro
-- del periodo de gracia recien agregado no tenia ninguna forma de
-- recuperarse (a diferencia de Red, que ya tiene fn_estructura_reactivar_red
-- desde 20260806000000). Mismo criterio de permiso que ya usa fn_eliminar_cdp
-- (fn_es_rol_superior_de_cdp: Lider/Sublider de Red, Pastor o Supervisor) y
-- el mismo patron de OTP que el resto de este modulo.
create or replace function public.fn_estructura_reactivar_casa_de_paz(
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

  select c.iglesia_id into v_iglesia_id
  from public.casa_de_paz c
  where c.id = p_cdp_id and c.fecha_eliminacion is not null;

  if v_iglesia_id is null then
    raise exception 'ESTRUCTURA_CDP_NO_ENCONTRADA: la Casa de Paz no existe o no esta eliminada'
      using errcode = 'P0001';
  end if;

  if not public.fn_es_rol_superior_de_cdp(p_cdp_id) then
    raise exception 'SIN_PERMISO: se requiere ser Lider de la Red de esta CdP, o Pastor/Supervisor'
      using errcode = 'P0001';
  end if;

  perform private.fn_estructura_exigir_otp(v_iglesia_id, p_otp);

  update public.casa_de_paz
  set fecha_eliminacion = null, eliminado_por = null, activo = true
  where id = p_cdp_id;
end;
$$;

revoke all on function public.fn_estructura_reactivar_casa_de_paz(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_estructura_reactivar_casa_de_paz(uuid, text) to authenticated;

commit;
