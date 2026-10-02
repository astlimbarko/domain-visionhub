-- Avances (KAN-388) — KAN-488/harness-21 Req 1: precarga de persona existente
-- en la Membresía desde 0. Se agrega con el merge; se aplica en el próximo
-- deploy junto con la funcionalidad (deploy en pausa), no ahora a mano.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'La Membresía desde 0 ahora puede completar a alguien que ya está registrado',
  'En "Membresía (Nuevos)" apareció un buscador arriba: "¿La persona ya está registrada?". Si la buscás y la elegís, el formulario se abre con todos sus datos ya cargados para que los verifiques y completes lo que falte — sin crear una persona repetida, se actualiza la existente. También pasa automáticamente cuando venís desde el botón "Registrar y llenar membresía" de Bautismo: la persona recién bautizada llega precargada.',
  'AFIRMACION', now()
);
