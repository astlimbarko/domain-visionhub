export const ROUTES = {
  LOGIN: '/login',
  RECUPERAR_CONTRASENA: '/recuperar-contrasena',
  COMPLETAR_CUENTA: '/completar-cuenta',
  DASHBOARD: '/',
  PERSONAS: '/personas',
  CASAS_DE_PAZ: '/casas-de-paz',
  MINISTERIOS: '/ministerios',
  REPORTES: '/reportes',
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
