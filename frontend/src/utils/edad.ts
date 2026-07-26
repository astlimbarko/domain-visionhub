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
