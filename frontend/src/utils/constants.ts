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
  VISITAS: '/visitas',
  FINANZAS: '/finanzas',
  PANEL_SUPERVISOR: '/panel-supervisor',
  DEPARTAMENTOS: '/departamentos',
  GESTION_REDES: '/gestion-redes',
  CUENTA: '/cuenta',
  ADMINISTRACION: '/administracion',
  // KAN-101: gestion de anuncios (Supervisor de la Vision en Accion /
  // Pastor / Encargado de Anuncios / Lider de Red / Supervisor de Red). Sin
  // item de nav todavia; se llega por URL directa.
  ANUNCIOS: '/anuncios',
  // Formulario en pagina propia (2026-08-15, pedido explicito del owner:
  // "control un poco mas" que un modal) -- no dialog.
  ANUNCIO_NUEVO: '/anuncios/nuevo',
  ANUNCIO_EDITAR: '/anuncios/:anuncioId/editar',
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
  // KAN-127: Casas de Paz de toda la iglesia (todas las Redes), no solo las
  // que tienen lider vigente + URL (eso ya lo cubren AFIRMACION_URLS y el
  // selector del formulario).
  AFIRMACION_CASAS_DE_PAZ: '/afirmacion-casas-de-paz',
  // Plan panel Afirmación 2026-08-20, punto 3/4: tabla de todas las personas
  // de la iglesia con KPIs, ordenable/filtrable.
  AFIRMACION_PERSONAS: '/afirmacion-personas',
  // Roles globales de solo lectura, ortogonales al RolUI (2026-08-02): mismo
  // patron que Afirmación, un item de nav propio cada uno.
  JOVENES: '/jovenes',
  MATRIMONIOS: '/matrimonios',
  REGISTRO_PUBLICO: '/registro/:slug',
  // Constructor visual de la estructura organizacional (KAN-52): sin
  // AppShell a proposito, barra superior oscura propia -- se entra desde la
  // lista de Iglesias del panel de Super Admin, una iglesia a la vez.
  ESTRUCTURA_ORGANIZACIONAL: '/estructura-organizacional/:iglesiaId',
  // Resumen del Constructor (2026-08-11): landing con AppShell normal, antes
  // de entrar al lienzo -- muestra el resumen de entidades/lideres de la
  // iglesia y, si tiene hijas/satelite, un boton por cada una para entrar a
  // SU propio Constructor (antes no habia forma de verlas por separado).
  CONSTRUCTOR_RESUMEN: '/constructor/:iglesiaId',
} as const;

export function rutaRegistroPublico(slug: string) {
  return `/registro/${slug}`;
}

export function rutaEstructuraOrganizacional(iglesiaId: string) {
  return `/estructura-organizacional/${iglesiaId}`;
}

export function rutaConstructorResumen(iglesiaId: string) {
  return `/constructor/${iglesiaId}`;
}

/**
 * Login con Google: requiere credenciales OAuth cargadas en Google Cloud
 * Console + Supabase Dashboard (Auth → Providers → Google) y la URL de
 * callback del dominio en la whitelist de Redirect URLs.
 */
export const GOOGLE_AUTH_HABILITADO = true;
