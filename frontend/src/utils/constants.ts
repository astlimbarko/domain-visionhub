export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  REGISTRO_PUBLICO: '/registro/:slug',
} as const;

export function rutaRegistroPublico(slug: string) {
  return `/registro/${slug}`;
}
