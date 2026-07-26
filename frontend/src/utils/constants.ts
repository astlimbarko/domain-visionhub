export const ROUTES = {
  LOGIN: '/login',
  RECUPERAR_CONTRASENA: '/recuperar-contrasena',
  COMPLETAR_CUENTA: '/completar-cuenta',
  DASHBOARD: '/',
  PERSONAS: '/personas',
  CASAS_DE_PAZ: '/casas-de-paz',
  MINISTERIOS: '/ministerios',
  REPORTES: '/reportes',
  HISTORIAL_REPORTES: '/historial-reportes',
  HISTORIAL_ASISTENCIA: '/historial-asistencia',
  CALENDARIO: '/calendario',
  EVANGELISMO: '/evangelismo',
  FINANZAS: '/finanzas',
  PANEL_SUPERVISOR: '/panel-supervisor',
  CUENTA: '/cuenta',
  ADMINISTRACION: '/administracion',
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
