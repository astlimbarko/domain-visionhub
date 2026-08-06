-- VisionHub — fn_validar_asignacion_rol (trigger de usuario_rol) bloqueaba a
-- Super Admin al asignar LIDER_RED/LIDER_CDP/SUBLIDER_CDP (exigía
-- fn_es_operativo_en, sin bypass de Super Admin, a diferencia de PASTOR que
-- sí lo tiene). Bug real encontrado probando "Designar por correo" desde el
-- Constructor de Estructura Organizacional con la cuenta Super Admin
-- (REQ-PER-1). Mismo criterio que ya se usa en toda la épica: agregar
-- fn_es_super_admin() como vía adicional, sin quitar ninguna de las que ya
-- funcionaban.

begin;

create or replace function fn_validar_asignacion_rol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id = auth.uid() then
    raise exception 'ROL_AUTOASIGNACION: un usuario no puede asignarse un rol a si mismo'
      using errcode = 'P0001';
  end if;

  if new.rol = 'SUPER_ADMIN' and not fn_es_super_admin() then
    raise exception 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede crear otro SUPER_ADMIN'
      using errcode = 'P0001';
  end if;

  if new.rol = 'PASTOR' and not fn_es_super_admin() then
    raise exception 'ROL_NIVEL_SUPERIOR: solo un SUPER_ADMIN puede asignar el rol PASTOR'
      using errcode = 'P0001';
  end if;

  if new.rol = 'SUPERVISOR_VISION_ACCION' and not (fn_es_super_admin() or fn_es_pastor_en(new.iglesia_id)) then
    raise exception 'ROL_NIVEL_SUPERIOR: se requiere ser PASTOR de la iglesia % para asignar SUPERVISOR_VISION_ACCION', new.iglesia_id
      using errcode = 'P0001';
  end if;

  if new.rol = 'LIDER_RED' and not (fn_es_super_admin() or fn_es_operativo_en(new.iglesia_id)) then
    raise exception 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor o Supervisor en la iglesia % para asignar %', new.iglesia_id, new.rol
      using errcode = 'P0001';
  end if;

  if new.rol in ('LIDER_CDP', 'SUBLIDER_CDP')
     and not (fn_es_super_admin() or fn_es_operativo_en(new.iglesia_id) or fn_es_lider_de_red_en_iglesia(new.iglesia_id)) then
    raise exception 'ROL_NIVEL_SUPERIOR: se requiere ser Pastor, Supervisor o Lider de Red en la iglesia % para asignar %', new.iglesia_id, new.rol
      using errcode = 'P0001';
  end if;

  if new.rol in ('PASTOR', 'SUPERVISOR_VISION_ACCION', 'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP')
     and exists (select 1 from usuario_rol where usuario_id = new.usuario_id and rol = 'SUPER_ADMIN' and fecha_eliminacion is null) then
    raise exception 'ROL_SUPER_ADMIN_NO_OPERATIVO: un Super Admin no puede tener roles operativos; se necesita una cuenta separada' using errcode = 'P0001';
  end if;

  if new.iglesia_id is not null and new.iglesia_id not in (select fn_mis_iglesias()) then
    raise exception 'ROL_FUERA_DE_ALCANCE: la iglesia % no esta entre sus iglesias accesibles', new.iglesia_id
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

commit;
