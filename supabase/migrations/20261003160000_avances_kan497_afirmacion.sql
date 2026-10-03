-- Avances (KAN-388) -- KAN-497: correcciones y mejoras del flujo
-- Bautismo -> Membresía en Afirmación. Se agrega con el merge; se aplica en
-- el próximo deploy junto con la funcionalidad (deploy en pausa), no ahora
-- a mano.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'CORRECCION', 'Afirmación',
  'Bautizar a alguien ya no lo registra como miembro por error',
  'Antes, al registrar un Bautismo, la persona aparecía automáticamente en la lista de Miembros sin haber completado su membresía -- y si después se le cargaba la membresía, podía quedar duplicada. Ahora bautizar a alguien solo deja constancia de que fue bautizado; recién pasa a ser miembro cuando se completa y guarda su "Formulario de membresía".',
  'AFIRMACION', now()
),
(
  'CORRECCION', 'Afirmación',
  'El indicador de guardado automático del formulario de membresía ya no se queda girando',
  'En "Formulario de membresía", el ícono que avisa que se está guardando tu borrador a veces se quedaba dando vueltas sin parar. Ahora desaparece apenas termina de guardar.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Se puede quitar a la persona elegida por error en el formulario de membresía',
  'En "Formulario de membresía", si elegiste a alguien de la búsqueda por error, tocá la "x" al lado de su nombre -- te pregunta si estás seguro y, si confirmás, la desvincula sin borrar el resto de los datos que ya cargaste.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Ajustes a los campos obligatorios del formulario de membresía',
  'En "Formulario de membresía": el número de documento ahora es obligatorio, pero si la persona no lo recuerda hay un casillero "No lo recuerda" que cuenta como respuesta. La fecha de nacimiento pasó a ser obligatoria. La ocupación dejó de serlo. Y la pregunta se renombró a "¿Ya asiste a esta iglesia?".',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'La búsqueda de Casa de Paz ahora encuentra por dirección o ciudad',
  'En el selector de Casa de Paz del formulario de membresía, además de buscar por nombre, Red o líder, ahora también encuentra escribiendo la dirección o la ciudad de la Casa de Paz.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Nueva pestaña "Registro" para ver quién cargó cada membresía',
  'El "Formulario de membresía" ahora tiene 2 pestañas: "Nuevo" (el formulario de siempre) y "Registro" (la lista de personas que se fueron cargando, con quién tomó cada dato). Lo mismo se ve en Afirmación › Membresía, en su propia pestaña "Registro" -- ahí Afirmación ve todo lo cargado por todos, y cada colaborador ve solo lo suyo. La pestaña "Miembros" de esa misma pantalla ahora solo muestra a quien ya completó su membresía.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Se puede editar a una persona desde su ficha en Altar, Bautismo, RSIL y Membresía',
  'Al tocar una persona en la pestaña "Datos" de Altar/Bautismo/RSIL o en "Registro" de Membresía, se abre su ficha completa. Con el botón rojo "Editar" se pueden corregir sus datos sin crear una persona repetida.',
  'AFIRMACION', now()
),
(
  'CORRECCION', 'Afirmación',
  'Registrar en el Altar ahora es un solo paso',
  'Antes, cargar a una persona nueva en Altar pedía confirmar dos veces para una sola acción. Ahora "Guardar" ya registra todo de una vez.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Buscador dentro de cada módulo (Altar, Bautismo, RSIL, Membresía)',
  'Las pestañas "Datos"/"Registro" de Altar, Bautismo, RSIL y Membresía tienen ahora un buscador propio -- cada uno busca solo entre las personas de su propio módulo.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Aviso más certero cuando una persona que estás por cargar ya existe',
  'Al crear una persona nueva en Altar, Bautismo, RSIL o Membresía, el sistema ahora también compara teléfono y sexo (además del nombre, y el número de documento en Membresía) antes de avisar "¿es esta persona?" -- cuantos más datos cargues, más certero es el aviso.',
  'AFIRMACION', now()
);
