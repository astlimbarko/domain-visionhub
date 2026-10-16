-- Avances (KAN-388): export y más datos en el Registro de Afirmación (2026-10-15).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'Ahora podés descargar la lista de cada etapa (Altar, Bautismo, RSIL, Membresía) en PDF o Excel',
  'En Afirmación → Altar, Bautismo, RSIL y Form. de Membresía, entrá a la pestaña "Registro": con el botón rojo "Exportar" (arriba a la derecha) bajás la lista en PDF o Excel, con el nombre de la etapa y la fecha. Además la lista ahora muestra más datos de cada persona: edad, fecha y hora del registro, quién la cargó, quién la invitó y su red. El export respeta el filtro por colaborador que tengas aplicado.',
  'AFIRMACION', now()
);
