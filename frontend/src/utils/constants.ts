export const ROUTES = {
  LOGIN: '/login',
  RECUPERAR_CONTRASENA: '/recuperar-contrasena',
  COMPLETAR_CUENTA: '/completar-cuenta',
  SELECCIONAR_ROL: '/seleccionar-rol',
  AUTH_CALLBACK: '/auth/callback',
  DASHBOARD: '/',
  PERSONAS: '/personas',
  CASAS_DE_PAZ: '/casas-de-paz',
  MINISTERIOS: '/ministerios',
  REPORTES: '/reportes',
  CONTROL_REPORTES: '/control-reportes',
  HISTORIAL_REPORTES: '/historial-reportes',
  HISTORIAL_ASISTENCIA: '/historial-asistencia',
  CALENDARIO: '/calendario',
  EVANGELISMO: '/evangelismo',
  FINANZAS: '/finanzas',
  PANEL_SUPERVISOR: '/panel-supervisor',
  CUENTA: '/cuenta',
  ADMINISTRACION: '/administracion',
  REGISTRO_PUBLICO: '/registro/:slug',
} as const;

export function rutaRegistroPublico(slug: string) {
  return `/registro/${slug}`;
}

/**
 * Login con Google: la UI ya está lista, pero requiere credenciales OAuth
 * (Google Cloud Console + Supabase Dashboard) que todavía no están cargadas.
 * Cambiar a true recién cuando esas credenciales estén configuradas.
 */
export const GOOGLE_AUTH_HABILITADO = false;
