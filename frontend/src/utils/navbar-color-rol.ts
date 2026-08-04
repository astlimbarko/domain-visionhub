import type { RolUI } from '@/utils/permisos';

/**
 * Color de fondo del navbar (barra superior, móvil y de escritorio) por rol
 * activo -- pedido explícito del owner: "cada navbar tiene un color distinto
 * para cada rol". Roles sin entrada acá usan el navbar claro de siempre.
 *
 * Ojo: esto es intencionalmente un manejador aparte de `FILA_ROL_VISUAL`
 * (seleccionar-rol-visual.ts, colores de las tarjetas del selector) y de
 * `ROL_UI_META` (permisos.ts, color de los chips de navegación) -- los 3
 * sirven a pantallas distintas y hoy no coinciden entre sí a propósito
 * (cada uno se fue definiendo en su propio momento). Reconciliarlos en una
 * sola fuente es un cambio más grande, no parte de este pedido puntual.
 *
 * Super Admin no pasa por acá: tiene su propio tema oscuro fijo (`esOscuro`
 * en AppShell), que además de la barra cubre sidebar y cuerpo.
 */
export const NAVBAR_COLOR_ROL: Partial<Record<RolUI, string>> = {
  LIDER_RED: '#4E73B7',
};
