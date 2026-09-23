-- Reparación puntual (2026-09-23, pedido explícito del owner en vivo):
-- juannylp@gmail.com fue invitada como Líder de Casa de Paz (Red "Vino
-- Nuevo", Centro de Vida Montero) el 2026-09-20. Confirmó su cuenta y
-- llegó a entrar una vez, pero nunca completó el formulario de membresía
-- (no se llegó a crear su `persona`). Minutos después, quien la invitó
-- canceló la invitación (fn_cancelar_invitacion_lider), dejando su
-- auth.users huérfana: existe y está confirmada, pero sin invitación
-- PENDIENTE y sin persona -- por eso volver a "Invitar" por ese correo
-- daba 409 ("Ya existe una cuenta... sin Persona vinculada... avisale al
-- equipo técnico"). No fue el bug de baneo de 100 años (KAN-278/279) --
-- banned_until siguió en null todo este tiempo, confirmado antes de tocar
-- nada.
--
-- No se puede volver a invitarla por el flujo normal (Supabase Auth
-- rechaza inviteUserByEmail/createUser para un correo que ya tiene
-- cuenta), así que se recrean a mano las 2 filas que fn_invitar_lider
-- crea en un alta normal (usuario_rol + invitacion_lider PENDIENTE) para
-- SU usuario_id ya existente, sin tocar auth.users vía SQL. La contraseña
-- temporal (12345678, debe_cambiar_contrasena=true) ya se asignó aparte
-- vía Admin API, mismo patrón que establecer-contrasena-temporal (KAN-278).
-- Con esto, al entrar y guardar la contraseña, el flujo normal de
-- fn_completar_membresia la va a llevar al wizard de membresía (ella
-- carga su propio nombre/apellido/sexo/etc., no hace falta que un admin
-- los sepa de antemano).

begin;

-- trg_validar_rol exige un actor autenticado real (auth.uid()) con
-- autoridad para asignar el rol -- corriendo esta reparación como
-- administrador de base directo no hay JWT de por medio. Se desactiva
-- solo para este INSERT puntual (se reactiva antes de terminar la misma
-- transacción) -- es la restauración exacta de una fila que un admin real
-- ya había creado legítimamente el 2026-09-20 y que se canceló por error.
alter table usuario_rol disable trigger trg_validar_rol;

insert into usuario_rol (usuario_id, rol, iglesia_id)
select 'f8df53fd-f8b1-4836-b222-05df8163e776', 'LIDER_CDP', 'a6eba075-2d26-4ef7-bd65-d3d7d4603af0'
where not exists (
  select 1 from usuario_rol
  where usuario_id = 'f8df53fd-f8b1-4836-b222-05df8163e776'
    and rol = 'LIDER_CDP'
    and iglesia_id = 'a6eba075-2d26-4ef7-bd65-d3d7d4603af0'
    and fecha_eliminacion is null
);

alter table usuario_rol enable trigger trg_validar_rol;

insert into invitacion_lider (usuario_id, correo, iglesia_id, rol, casa_de_paz_id, cargo_id)
select
  'f8df53fd-f8b1-4836-b222-05df8163e776',
  'juannylp@gmail.com',
  'a6eba075-2d26-4ef7-bd65-d3d7d4603af0',
  'LIDER_CDP',
  '37d591b7-5fb1-421d-a688-55cd43abbe1d',
  '63db20d2-2f0a-4ac1-a16d-7056032f55f0'
where not exists (
  select 1 from invitacion_lider
  where usuario_id = 'f8df53fd-f8b1-4836-b222-05df8163e776'
    and estado = 'PENDIENTE'
    and fecha_eliminacion is null
);

commit;
