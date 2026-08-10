-- VisionHub — KAN-152 (Problema 4 de la auditoria): al crear una iglesia
-- nueva, `fn_crear_iglesia` solo insertaba la fila en `iglesia` -- no
-- sembraba los 4 Departamentos oficiales ni la fila de
-- `estructura_organigrama`. Una iglesia como "El Eden" funciona distinto
-- de una nueva ("Sion") porque sus Departamentos se crearon a mano en
-- algun momento, no porque el sistema los siembre solo.
--
-- Se resuelve con un trigger AFTER INSERT en `iglesia` en vez de editar
-- `fn_crear_iglesia` directamente: cubre cualquier camino de alta (RPC
-- actual, uno futuro, o un INSERT directo), sin depender de conocer la
-- version exacta ya desplegada de esa funcion. Solo afecta iglesias
-- NUEVAS -- no toca ninguna fila existente (El Eden, Montero, etc. quedan
-- exactamente igual).

begin;

create or replace function public.fn_sembrar_defaults_iglesia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.departamento (iglesia_id, codigo, nombre, color, color_nombre)
  values
    (new.id, 'EVANGELISMO', 'Evangelismo', '#F5C518', 'Amarillo'),
    (new.id, 'AFIRMACION', 'Afirmación', '#0071E3', 'Azul'),
    (new.id, 'DISCIPULADO', 'Discipulado', '#FF3B30', 'Rojo'),
    (new.id, 'ENVIO', 'Envío', '#8E8E93', 'Gris')
  on conflict do nothing;

  insert into public.estructura_organigrama (iglesia_id)
  values (new.id)
  on conflict (iglesia_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_sembrar_defaults_iglesia on public.iglesia;
create trigger trg_sembrar_defaults_iglesia
  after insert on public.iglesia
  for each row execute function public.fn_sembrar_defaults_iglesia();

revoke all on function public.fn_sembrar_defaults_iglesia() from public, anon, authenticated;

commit;
