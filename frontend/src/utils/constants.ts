export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  PERSONAS: '/personas',
  CASAS_DE_PAZ: '/casas-de-paz',
  CALENDARIO: '/calendario',
  EVANGELISMO: '/evangelismo',
  FINANZAS: '/finanzas',
  PANEL_SUPERVISOR: '/panel-supervisor',
  REGISTRO_PUBLICO: '/registro/:slug',
} as const;

export function rutaRegistroPublico(slug: string) {
  return `/registro/${slug}`;
}
