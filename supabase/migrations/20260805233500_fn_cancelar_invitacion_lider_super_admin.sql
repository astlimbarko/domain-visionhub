-- Fix inmediato: fn_cancelar_invitacion_lider (recién creada) tenía el mismo
-- gap que fn_puede_invitar_lider y fn_validar_asignacion_rol — sin bypass de
-- Super Admin. Detectado probando "Corregir correo" en vivo.

begin;

create or replace function public.fn_cancelar_invitacion_lider(
  p_invitacion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitacion_lider;
  v_puede boolean;
  v_cargo_codigo text;
  v_usuario_a_borrar uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NO_AUTENTICADO' using errcode = 'P0001';
  end if;

  select * into v_inv from public.invitacion_lider
  where id = p_invitacion_id and fecha_eliminacion is null;

  if not found or v_inv.estado <> 'PENDIENTE' then
    raise exception 'INVITACION_NO_ENCONTRADA_O_YA_RESUELTA' using errcode = 'P0001';
  end if;

  v_puede := public.fn_es_super_admin()
    or public.fn_es_operativo_en(v_inv.iglesia_id)
    or (v_inv.red_id is not null and public.fn_es_lider_de_red(v_inv.red_id))
    or (v_inv.casa_de_paz_id is not null and exists (
          select 1 from public.casa_de_paz_red cr where cr.casa_de_paz_id = v_inv.casa_de_paz_id
            and cr.fecha_eliminacion is null and public.fn_es_lider_de_red(cr.red_id)
        ));

  if not v_puede then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;

  select c.codigo into v_cargo_codigo from public.cargo c where c.id = v_inv.cargo_id;

  update public.invitacion_lider
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where id = v_inv.id;

  update public.usuario_rol
  set fecha_eliminacion = now(), eliminado_por = (select auth.uid())
  where usuario_id = v_inv.usuario_id and rol = v_inv.rol and iglesia_id = v_inv.iglesia_id
    and fecha_eliminacion is null;

  if not exists (select 1 from public.persona where usuario_id = v_inv.usuario_id and fecha_eliminacion is null)
     and not exists (select 1 from public.usuario_rol where usuario_id = v_inv.usuario_id and fecha_eliminacion is null)
  then
    v_usuario_a_borrar := v_inv.usuario_id;
  end if;

  return jsonb_build_object(
    'usuario_id_a_borrar', v_usuario_a_borrar,
    'rol', v_inv.rol,
    'cargo_codigo', v_cargo_codigo,
    'red_id', v_inv.red_id,
    'casa_de_paz_id', v_inv.casa_de_paz_id
  );
end;
$$;

commit;
