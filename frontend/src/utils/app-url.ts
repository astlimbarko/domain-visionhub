/**
 * Bug real 2026-08-01: una invitación (rol Pastor, mattfrs1345@gmail.com)
 * llevó al invitado a www.somoscdv.com (landing) en vez de
 * app.somoscdv.com (la SPA) -- porque el redirectTo de cada invitación se
 * calculaba con `window.location.origin`, y ese dominio depende de en cuál
 * de los dos hosts (ambos sirven la misma app hoy) estaba la persona que
 * hizo la invitación. `VITE_APP_URL` fija ese origen en los builds de
 * producción (`.env.production`); en desarrollo/Docker no está seteada, así
 * que cae en `window.location.origin` (localhost) como siempre.
 */
export function obtenerUrlBase(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}
