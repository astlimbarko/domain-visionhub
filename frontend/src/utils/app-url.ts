/**
 * Bug real 2026-08-01: una invitación (rol Pastor, mattfrs1345@gmail.com)
 * llevó al invitado a www.somoscdv.com (landing) en vez de
 * app.somoscdv.com (la SPA) -- porque el redirectTo de cada invitación se
 * calculaba con `window.location.origin`, y ese dominio depende de en cuál
 * de los dos hosts (ambos sirven la misma app hoy) estaba la persona que
 * hizo la invitación. `VITE_APP_URL` fija ese origen en los builds de
 * producción (`.env.production`).
 *
 * Bug real 2026-08-26: en desarrollo local (npm run dev, sin VITE_APP_URL)
 * el fallback caía en `window.location.origin` -- pero el entorno local
 * apunta a la base de datos REAL (no hay Supabase local, ver
 * qa-test-account-y-entorno), así que un admin probando "Restablecer
 * contraseña"/invitar desde su máquina le mandó a una persona real un correo
 * con un enlace a localhost, roto para ella. Si no hay VITE_APP_URL y el
 * origen es localhost, se usa el dominio de producción en su lugar -- nunca
 * hay que mandarle un link de localhost a un usuario real.
 */
const URL_PRODUCCION_DEFECTO = 'https://app.somoscdv.com';

export function obtenerUrlBase(): string {
  if (import.meta.env.VITE_APP_URL) return import.meta.env.VITE_APP_URL;
  const origen = window.location.origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen)) return URL_PRODUCCION_DEFECTO;
  return origen;
}
