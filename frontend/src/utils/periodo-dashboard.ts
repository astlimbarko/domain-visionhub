import { aISO } from './calendario-fechas';

export type PeriodoDashboard = 'SEMANA' | 'MES' | 'TRIMESTRE' | 'ANIO';
export type GranularidadTendencia = 'semana' | 'mes' | 'trimestre' | 'anio';

export const PERIODOS_DASHBOARD: { value: PeriodoDashboard; label: string; etiqueta: string }[] = [
  { value: 'SEMANA', label: 'Semana', etiqueta: 'esta semana' },
  { value: 'MES', label: 'Mes', etiqueta: 'este mes' },
  { value: 'TRIMESTRE', label: 'Trimestre', etiqueta: 'este trimestre' },
  { value: 'ANIO', label: 'Año', etiqueta: 'este año' },
];

function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Rango [desde, hasta] del período actual (semana/mes/trimestre/año en curso), en fechas ISO. */
export function rangoPeriodoActual(periodo: PeriodoDashboard, ahora = new Date()): { desde: string; hasta: string } {
  switch (periodo) {
    case 'SEMANA': {
      const inicio = inicioSemana(ahora);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      return { desde: aISO(inicio), hasta: aISO(fin) };
    }
    case 'TRIMESTRE': {
      const trimestre = Math.floor(ahora.getMonth() / 3);
      return {
        desde: aISO(new Date(ahora.getFullYear(), trimestre * 3, 1)),
        hasta: aISO(new Date(ahora.getFullYear(), trimestre * 3 + 3, 0)),
      };
    }
    case 'ANIO':
      return { desde: aISO(new Date(ahora.getFullYear(), 0, 1)), hasta: aISO(new Date(ahora.getFullYear(), 11, 31)) };
    case 'MES':
    default:
      return {
        desde: aISO(new Date(ahora.getFullYear(), ahora.getMonth(), 1)),
        hasta: aISO(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)),
      };
  }
}

/**
 * Rango [desde, hasta] que abarca `cantidad` períodos hacia atrás desde el
 * actual (ej. período=MES, cantidad=3 → julio a septiembre completo, no solo
 * septiembre). `hasta` es siempre el fin del período actual -- igual que
 * `rangoPeriodoActual` -- así que con cantidad=1 el resultado es idéntico a
 * `rangoPeriodoActual(periodo)`.
 *
 * Antes las tarjetas KPI del dashboard (asistencia promedio, evangelizados,
 * etc.) usaban `rangoPeriodoActual(periodo)` sin mirar `cantidad` -- el
 * selector "Últimos N meses" solo movía el gráfico de tendencia de abajo, no
 * los números de arriba. Elegir "Últimos 3 meses" hacía que el gráfico
 * mostrara jul/ago/sep pero las tarjetas KPI seguían mostrando solo
 * septiembre, dando la sensación de que el filtro "no contaba bien" (pedido
 * del owner, 2026-09-02: que todo el dashboard se mueva junto).
 */
export function rangoPeriodoConCantidad(
  periodo: PeriodoDashboard,
  cantidad: number,
  ahora = new Date()
): { desde: string; hasta: string } {
  const actual = rangoPeriodoActual(periodo, ahora);
  if (cantidad <= 1) return actual;

  switch (periodo) {
    case 'SEMANA': {
      const inicio = inicioSemana(ahora);
      inicio.setDate(inicio.getDate() - 7 * (cantidad - 1));
      return { desde: aISO(inicio), hasta: actual.hasta };
    }
    case 'TRIMESTRE': {
      const trimestre = Math.floor(ahora.getMonth() / 3);
      const inicio = new Date(ahora.getFullYear(), trimestre * 3 - 3 * (cantidad - 1), 1);
      return { desde: aISO(inicio), hasta: actual.hasta };
    }
    case 'ANIO': {
      const inicio = new Date(ahora.getFullYear() - (cantidad - 1), 0, 1);
      return { desde: aISO(inicio), hasta: actual.hasta };
    }
    case 'MES':
    default: {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - (cantidad - 1), 1);
      return { desde: aISO(inicio), hasta: actual.hasta };
    }
  }
}

/** Granularidad de agrupación del gráfico de tendencia para cada período. */
export function granularidadPara(periodo: PeriodoDashboard): GranularidadTendencia {
  switch (periodo) {
    case 'SEMANA':
      return 'semana';
    case 'TRIMESTRE':
      return 'trimestre';
    case 'ANIO':
      return 'anio';
    case 'MES':
    default:
      return 'mes';
  }
}

/** Cuántos períodos hacia atrás puede elegir mostrar el usuario en la tendencia, según el período seleccionado. */
export const OPCIONES_CANTIDAD: Record<PeriodoDashboard, number[]> = {
  SEMANA: [1, 4, 12, 26, 52],
  MES: [1, 3, 6, 12],
  TRIMESTRE: [1, 2, 4],
  ANIO: [1],
};

/** Cantidad seleccionada por defecto al elegir un período (la última opción de la lista, la más completa). */
export function cantidadPorDefecto(periodo: PeriodoDashboard): number {
  const opciones = OPCIONES_CANTIDAD[periodo];
  return opciones[opciones.length - 1];
}

const UNIDAD_SINGULAR: Record<PeriodoDashboard, string> = {
  SEMANA: 'semana',
  MES: 'mes',
  TRIMESTRE: 'trimestre',
  ANIO: 'año',
};

const UNIDAD_PLURAL: Record<PeriodoDashboard, string> = {
  SEMANA: 'semanas',
  MES: 'meses',
  TRIMESTRE: 'trimestres',
  ANIO: 'años',
};

/** Etiqueta legible para una opción del combobox de cantidad, ej. "Últimas 12 semanas". */
export function etiquetaCantidad(periodo: PeriodoDashboard, cantidad: number): string {
  if (cantidad === 1) return `Último ${UNIDAD_SINGULAR[periodo]}`;
  return `Últimos ${cantidad} ${UNIDAD_PLURAL[periodo]}`;
}

/**
 * Etiqueta para usar dentro de una frase ("Evangelizados de {esto}"), coherente
 * con el rango real que devuelve `rangoPeriodoConCantidad` -- si cantidad=1 dice
 * "este mes" (igual que antes), si cantidad>1 dice "los últimos 3 meses". Antes
 * esta frase siempre decía "este mes" sin importar la cantidad elegida, aunque
 * el número mostrado ya sumara varios meses -- confundía (owner, 2026-09-02).
 */
export function etiquetaPeriodoEnFrase(periodo: PeriodoDashboard, cantidad: number): string {
  if (cantidad <= 1) {
    const singular = UNIDAD_SINGULAR[periodo];
    return periodo === 'SEMANA' ? 'esta semana' : `este ${singular}`;
  }
  return `los últimos ${cantidad} ${UNIDAD_PLURAL[periodo]}`;
}
