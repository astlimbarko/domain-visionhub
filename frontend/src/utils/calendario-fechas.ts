const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function nombreMes(anio: number, mes: number) {
  return `${NOMBRES_MES[mes]} ${anio}`;
}

export function nombresDias() {
  return NOMBRES_DIA;
}

export function aISO(fecha: Date) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Grilla de 42 celdas (6 semanas) para el mes dado, empezando en domingo. */
export function grillaMes(anio: number, mes: number): { fecha: Date; delMes: boolean }[] {
  const primerDia = new Date(anio, mes, 1);
  const inicioGrilla = new Date(anio, mes, 1 - primerDia.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const fecha = new Date(inicioGrilla);
    fecha.setDate(inicioGrilla.getDate() + i);
    return { fecha, delMes: fecha.getMonth() === mes };
  });
}

/**
 * Igual que `grillaMes`, pero recorta las filas (semanas de 7) que quedan
 * enteramente fuera del mes -- ya no se reserva una sexta fila entera solo
 * para mostrar días del mes siguiente. Las filas que sí tienen algún día del
 * mes conservan sus 7 celdas (para no romper el alineado de columnas por
 * día de semana); las celdas de relleno que sobran en esas filas siguen
 * viniendo con `delMes: false` para que el componente las pinte en blanco.
 */
export function grillaMesRecortada(anio: number, mes: number): { fecha: Date; delMes: boolean }[] {
  const celdas = grillaMes(anio, mes);
  const filas: { fecha: Date; delMes: boolean }[][] = [];
  for (let i = 0; i < celdas.length; i += 7) filas.push(celdas.slice(i, i + 7));
  return filas.filter((fila) => fila.some((c) => c.delMes)).flat();
}

export function esHoy(fecha: Date) {
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

function desdeISO(fechaISO: string): Date {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Lunes de la semana ISO que contiene la fecha dada. */
export function inicioSemanaISO(fechaISO: string): string {
  const fecha = desdeISO(fechaISO);
  const diasDesdeLunes = (fecha.getDay() + 6) % 7;
  fecha.setDate(fecha.getDate() - diasDesdeLunes);
  return aISO(fecha);
}

/** Domingo de la semana ISO que contiene la fecha dada. */
export function finSemanaISO(fechaISO: string): string {
  const inicio = desdeISO(inicioSemanaISO(fechaISO));
  inicio.setDate(inicio.getDate() + 6);
  return aISO(inicio);
}

export function fechaLegible(fechaISO: string): string {
  const fecha = desdeISO(fechaISO);
  return `${fecha.getDate()} de ${NOMBRES_MES[fecha.getMonth()].toLowerCase()}`;
}
