/**
 * Paleta propia del panel personal de Evangelista (KAN-428, base de UI v2) --
 * cálida (naranja/rojo), pedida por el owner para distinguirse visualmente
 * del resto de la app (bocetos `evangelismo1/2/3.jpeg`). Independiente de
 * `EVANGELISMO_COLOR` (el módulo de Evangelismo de CdP, azul/verde/morado) y
 * de la paleta compartida de `DashboardUI.tsx` -- mismo criterio ya usado
 * por ambos módulos: colores propios por módulo, sin tocar la paleta
 * genérica. No reusar para otras pantallas sin que el owner lo pida.
 */
export const EVANGELISTA_COLOR = {
  NARANJA_OSCURO: '#D9480F',
  NARANJA: '#FF7A1A',
  AMBAR: '#FFB020',
} as const;

export const EVANGELISTA_GRADIENTE_HERO =
  `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO} 0%, ${EVANGELISTA_COLOR.NARANJA} 55%, ${EVANGELISTA_COLOR.AMBAR} 100%)`;

export const EVANGELISTA_GRADIENTE_BOTON =
  `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})`;
