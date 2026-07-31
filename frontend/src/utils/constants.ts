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
  DEPARTAMENTOS: '/departamentos',
  CUENTA: '/cuenta',
  ADMINISTRACION: '/administracion',
  // Paneles minimos de 15-gestion-administrativa (Panel 3/4, 2026-07-31):
  // solo funcionalidad de "crear", sin dashboard ni sidebar -- a proposito,
  // pedido explicito del owner para agilizar. La estetica (AppShell, nav,
  // etc.) queda pendiente para una sesion posterior.
  PASTOR_GESTION: '/pastor-gestion',
  SUPERVISOR_GESTION: '/supervisor-gestion',
  // Afirmación: 3 items separados en el nav principal, no una pagina con
  // sub-nav interno (decision del owner, 2026-07-26) -- rutas hermanas sin
  // prefijo compartido para que el resaltado de nav (startsWith) no
  // confunda una con otra.
  AFIRMACION: '/afirmacion',
  AFIRMACION_FORMULARIO: '/afirmacion-formulario',
  AFIRMACION_URLS: '/afirmacion-urls',
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
