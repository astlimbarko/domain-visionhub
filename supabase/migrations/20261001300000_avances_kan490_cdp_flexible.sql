-- Avances (KAN-388) — KAN-490: asignación de Casa de Paz flexible en las puertas
-- de entrada. Se agrega con el merge; se aplica en el próximo deploy junto con
-- la funcionalidad (deploy en pausa), no ahora a mano.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'Al registrar una persona nueva ahora podés indicar quién la invitó y su Casa de Paz',
  'En "Añadir nueva persona" (Altar, Bautismo, RSIL y Membresía desde 0) aparecen dos datos nuevos. "¿Quién lo invitó?": podés buscar a esa persona en el sistema o escribir el nombre si no está cargada. Si el invitador ya tiene Casa de Paz, se sugiere automáticamente la misma (podés cambiarla si la persona va a otra). "Casa de Paz": un buscador donde encontrás la CdP por su nombre, su líder o su Red (incluye las iglesias satélite). Si no elegís ninguna, la persona queda sin asignar y su caso pasa a designaciones para que el líder de Afirmación le asigne una más adelante. Antes, en Altar/Bautismo/RSIL esta Casa de Paz no quedaba guardada; ahora sí.',
  'AFIRMACION', now()
);
