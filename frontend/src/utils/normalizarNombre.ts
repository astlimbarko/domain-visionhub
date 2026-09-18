/**
 * KAN-264: normaliza un campo de nombre/apellido a "Primera letra mayúscula,
 * resto minúscula" por palabra -- las personas escriben con Bloq Mayús
 * prendido, todo en minúscula, o mezclado, y el dato debería quedar prolijo
 * sin pedírselo.
 *
 * Respeta partículas típicas de apellidos compuestos en español ("de la
 * Cruz", "Del Castillo" -> "del Castillo"): van en minúscula salvo que sean
 * la primera palabra de todo el nombre completo -- no de cada campo por
 * separado. Como esta función se llama una vez por campo (primer_nombre,
 * segundo_nombre, primer_apellido, segundo_apellido), solo el campo que
 * ocupa la primera posición real del nombre completo (primer_nombre) debe
 * pasar `esPrimerCampoDelNombre = true`; en cualquier otro campo la
 * partícula siempre va en minúscula si aparece, aunque sea la primera
 * palabra de ESE campo (ej. primer_apellido = "de la Cruz" -> se deja "de la
 * Cruz", no "De La Cruz").
 *
 * Lista de partículas razonable, no exhaustiva -- cubre los casos usuales de
 * apellidos hispanohablantes, no reemplaza un diccionario.
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'van', 'von', 'du']);

function capitalizarPalabra(palabra: string): string {
  // Soporta nombres compuestos con guion ("Jose-Luis" -> "Jose-Luis", cada
  // mitad capitalizada por separado).
  return palabra
    .split('-')
    .map((parte) => (parte.length ? parte[0].toUpperCase() + parte.slice(1).toLowerCase() : parte))
    .join('-');
}

export function normalizarNombre(texto: string, esPrimerCampoDelNombre = false): string {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (!limpio) return limpio;

  return limpio
    .split(' ')
    .map((palabra, indice) => {
      const enMinuscula = palabra.toLowerCase();
      const esPrimeraPalabraDelNombreCompleto = esPrimerCampoDelNombre && indice === 0;
      if (!esPrimeraPalabraDelNombreCompleto && PARTICULAS.has(enMinuscula)) {
        return enMinuscula;
      }
      return capitalizarPalabra(palabra);
    })
    .join(' ');
}
