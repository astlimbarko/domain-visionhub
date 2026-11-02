import { useAuthStore } from '@/store/auth.store';
/** Transport fence used only by the experimental frontend. Business services remain original. */
const readRpcs = new Set([
  'fn_es_super_admin', 'fn_mis_iglesias_detalle', 'fn_mis_roles_dashboard', 'fn_mi_titulo',
  'fn_mi_membresia_incompleta', 'fn_mi_actualizacion_membresia_pendiente',
  'fn_es_evangelista_en', 'fn_puede_otorgar_evangelista', 'fn_mi_colaboracion_activa',
  'fn_mis_notificaciones', 'fn_notificaciones_no_leidas_count', 'fn_anuncios_pendientes',
  'fn_dashboard_lider_cdp', 'fn_dashboard_sublider_cdp', 'fn_dashboard_lider_red',
  'fn_dashboard_supervisor', 'fn_dashboard_pastor', 'fn_lista_miembros_cdp',
  'fn_cdp_contexto_reporte', 'fn_personas_de_cdp', 'fn_visitas_cdp', 'fn_visitas_regulares_cdp',
  'fn_criterio', 'fn_config_formulario', 'fn_es_lider_afirmacion_en', 'fn_es_lider_evangelismo_en',
  'fn_es_lider_jovenes_en', 'fn_es_encargado_matrimonios_en', 'fn_tasa_evangelismo',
  'fn_ingresos_cdp', 'fn_ingresos_red', 'fn_testimonios_cdp', 'fn_listar_tipos_discipulado',
  'fn_buscar_personas', 'fn_persona_ficha', 'fn_historial_reporte_cdp', 'fn_puede_solicitar_edicion_fuera_ventana',
  'fn_puede_editar_reporte_cdp', 'fn_puede_anular_reporte_cdp', 'fn_mi_cdp_perfil',
]);

export async function readOnlyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let request = new Request(input, init);
  const url = new URL(request.url);
  const origin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
  const method = request.method.toUpperCase();
  let allowed = false;
  // Owner authorized real leader actions only; server RLS remains authoritative.
  const state = useAuthStore.getState();
  const leader = state.isAuthenticated && state.contextoActivo?.rolUI === 'LIDER_CDP';
  if (leader && url.origin === origin && (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/storage/v1/object/') || url.pathname.startsWith('/functions/v1/'))) return fetch(request);
  if (url.origin === origin) {
    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      allowed = ['password', 'refresh_token'].includes(url.searchParams.get('grant_type') ?? '');
    } else if (url.pathname === '/auth/v1/logout' && method === 'POST') {
      // Do not terminate sessions opened in the production site or other devices.
      url.searchParams.set('scope', 'local');
      request = new Request(url, request);
      allowed = true;
    } else if (['/auth/v1/user', '/auth/v1/settings'].includes(url.pathname) && method === 'GET') {
      allowed = true;
    } else if (url.pathname.startsWith('/rest/v1/rpc/')) {
      allowed = ['GET', 'POST'].includes(method) && readRpcs.has(decodeURIComponent(url.pathname.slice('/rest/v1/rpc/'.length)));
    } else if (url.pathname.startsWith('/rest/v1/') && ['GET', 'HEAD'].includes(method)) {
      allowed = true;
    } else if (url.pathname.startsWith('/storage/v1/object/') && ['GET', 'HEAD'].includes(method)) {
      allowed = true;
    }
  }
  if (!allowed) {
    window.dispatchEvent(new CustomEvent('preview-write-blocked'));
    return new Response(JSON.stringify({ code: 'PREVIEW_READ_ONLY', message: 'Esta vista es de solo lectura. La acción no se envió al servidor.', details: null, hint: null }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  return fetch(request);
}