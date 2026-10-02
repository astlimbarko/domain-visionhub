-- Avances (KAN-388) — KAN-491/492/493/494: mejoras UX del Formulario de
-- membresía (Afirmación) + reorganización del menú. Se agrega con el merge; se
-- aplica en el próximo deploy junto con la funcionalidad (deploy en pausa).

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'El Formulario de membresía ahora pide los datos completos y agrega Familia',
  'En Afirmación › "Form. de Membresía", los campos obligatorios aparecen marcados con un asterisco (*) — todos salvo el segundo nombre, el segundo apellido y el correo. Si la persona no tiene celular, marcá el casillero "No tiene celular" y el teléfono deja de pedirse. El correo es opcional: si lo cargás, a la persona le llega un correo de bienvenida de la iglesia. Se sumó una sección "Familia" para anotar al cónyuge y a los familiares (con su parentesco y si son miembros).',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'El teléfono ahora permite elegir "Otro país"',
  'En los formularios donde se carga un teléfono (membresía, evangelismo, actualización de datos, registro público) el selector de país tiene ahora la opción "Otro país": al elegirla podés escribir el código de cualquier país, no solo los de la lista corta.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Menú de Afirmación reorganizado',
  'En el menú lateral, dentro de "Dpto. Afirmación", el formulario público antiguo, su URL y las Casas de Paz quedaron agrupados en un submenú desplegable llamado "Membresía por enlace". El formulario público antiguo ahora se llama "Formulario de membresía (antiguos)" y el nuevo (para captar gente desde cero) es "Form. de Membresía". Al entrar a Afirmación se ve una portada simple con el nombre del departamento.',
  'AFIRMACION', now()
);
