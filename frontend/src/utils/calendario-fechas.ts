const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const NOMBRES_MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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

export function desdeISO(fechaISO: string): Date {
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

/** Número de semana ISO-8601 (1-53, lunes a domingo, la semana 1 es la que
 * contiene el primer jueves del año) -- para mostrar junto al rango de
 * fechas en "Resumen semanal" (KAN-285, pedido explícito del owner). */
export function numeroSemanaISO(fechaISO: string): number {
  const fecha = desdeISO(fechaISO);
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaLunesBase0 = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diaLunesBase0 + 3);
  const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diffSemanas = (d.getTime() - primerJueves.getTime()) / (7 * 24 * 60 * 60 * 1000);
  return 1 + Math.round(diffSemanas);
}

/** Suma (o resta, con n negativo) días a una fecha ISO. */
export function sumarDiasISO(fechaISO: string, n: number): string {
  const fecha = desdeISO(fechaISO);
  fecha.setDate(fecha.getDate() + n);
  return aISO(fecha);
}

/** Primer día del mes que queda `n` meses antes (o después, con n negativo)
 * del mes de la fecha dada -- para armar rangos "últimos N meses" sin
 * problemas de desborde de día (ej. 31 de marzo - 1 mes no es 31 de febrero). */
export function primerDiaMesRelativo(fechaISO: string, n: number): string {
  const fecha = desdeISO(fechaISO);
  const fechaDestino = new Date(fecha.getFullYear(), fecha.getMonth() - n, 1);
  return aISO(fechaDestino);
}

export function nombreMesCorto(mes: number): string {
  return NOMBRES_MES_CORTO[mes];
}
