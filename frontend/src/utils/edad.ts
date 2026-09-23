/** Edad en años cumplidos a hoy, a partir de una fecha de nacimiento ISO (YYYY-MM-DD). */
export function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const noCumplioAunEsteAnio =
    hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (noCumplioAunEsteAnio) edad -= 1;
  return edad;
}

/** Mismos 5 rangos que ya usa Afirmación/Membresía (`RangoEdadFiltro` en
 * afirmacion.service.ts) y el backend (`fn_listar_personas_afirmacion`,
 * ver 20260920010000_kan401...sql) -- una sola fuente de verdad para
 * "a qué grupo etario pertenece esta edad", sin repetir los cortes 11/17/30/59. */
export type RangoEdad = 'NINOS' | 'ADOLESCENTES' | 'JOVENES' | 'ADULTOS' | 'MAYORES';

/** KAN-435 (2026-09-23, pedido explícito del owner): en pantallas donde se
 * toma asistencia, mostrar la edad exacta de una persona ("32 años") no
 * aporta tanto como saber a qué grupo pertenece de un vistazo -- se
 * reemplaza por esta etiqueta en singular (persona a persona), a
 * diferencia de las etiquetas en plural que usa Membresía como nombre de
 * categoría de filtro (mismos rangos, distinto uso). */
export const RANGO_EDAD_LABEL_PERSONA: Record<RangoEdad, string> = {
  NINOS: 'Niño/a',
  ADOLESCENTES: 'Adolescente',
  JOVENES: 'Joven',
  ADULTOS: 'Adulto',
  MAYORES: 'Adulto mayor',
};

export function clasificarEdad(edad: number): RangoEdad {
  if (edad <= 11) return 'NINOS';
  if (edad <= 17) return 'ADOLESCENTES';
  if (edad <= 30) return 'JOVENES';
  if (edad <= 59) return 'ADULTOS';
  return 'MAYORES';
}
