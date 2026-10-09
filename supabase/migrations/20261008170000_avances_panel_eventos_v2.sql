-- Avances (KAN-388): mejoras al Panel de Eventos de Afirmación (2026-10-08).
INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'Ahora los eventos se arman por actividad (Altar / RSIL / Bautismo + Membresía)',
  'En Afirmación → Eventos → "Crear evento" ya no elegís un "tipo": ponés el nombre y la descripción, marcás si es un solo día (y ahí queda una sola fecha), y tildás las actividades que va a tener el evento. Después, en cada puerta (Altar, RSIL, etc.), el selector "Evento activo" solo muestra los eventos de esa actividad, y lo que registres queda agrupado en ese evento.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Dentro de cada evento: estadísticas, colaboradores y listas descargables en PDF/Excel',
  'Al entrar a un evento ves cuántas personas y cuántos colaboradores participaron, y una tarjeta por cada actividad. Tocá una actividad para ver la lista de personas (con edad, teléfono, quién la invitó, red, líder de Casa de Paz y de qué iglesia es —madre o satélite—). Podés editar a cada persona con el lápiz, descargar la lista en PDF o Excel con el nombre del evento, y editar el evento con el lápiz de arriba.',
  'AFIRMACION', now()
);
