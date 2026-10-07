-- Avances (KAN-388): Panel de Eventos de Afirmación (2026-10-07).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'Ahora podés agrupar los registros por evento (ej. "Bautismo Global")',
  'En el menú de Afirmación entrá a "Eventos": creás un evento (título, tipo, fechas) y te muestra una tarjeta con sus números (total de personas, bautismos, membresías). Al entrar a un evento ves solo la gente registrada en él. Y en Altar/Bautismo/RSIL/Membresía hay arriba un selector de "Evento activo": lo que registres queda asociado a ese evento, y la lista de "Registro" se filtra al evento elegido. Así podés ver lo de una actividad puntual sin que se mezcle con el acumulado.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Las listas de registro ahora muestran la edad y la hora',
  'En la pestaña "Registro" de Altar, Bautismo y RSIL, cada persona muestra su edad (calculada de la fecha de nacimiento) al lado del nombre, y la hora en que se registró junto a la fecha.',
  'AFIRMACION', now()
);
