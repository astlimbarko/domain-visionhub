-- Avances (KAN-388) -- KAN-475: fix de permisos de "Ocultar de búsquedas".

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'CORRECCION', 'Personas',
  'Permiso correcto para ocultar a una persona de las búsquedas',
  'El botón "Ocultar de búsquedas" en la ficha de una persona ahora aparece solo para Pastor y Supervisor de la Visión en Acción -- antes se mostraba también a otros roles que no podían usarlo, y no se mostraba al Pastor cuando correspondía.',
  'SUPERVISION', now()
);
