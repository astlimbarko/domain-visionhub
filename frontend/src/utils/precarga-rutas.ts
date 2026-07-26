import type { QueryClient } from '@tanstack/react-query';
import { obtenerMisCasasDePaz } from '@/services/calendario.service';
import { obtenerMisRoles } from '@/services/dashboard.service';
import { obtenerTiposEvangelismo } from '@/services/evangelismo.service';
import { ROUTES } from '@/utils/constants';

/**
 * Módulos que se cargan bajo demanda en App.tsx (React.lazy): el import()
 * de acá tiene que apuntar al mismo archivo para que dispare la misma
 * promesa y el chunk quede en cache del navegador antes de que el click
 * realmente llegue.
 */
const CHUNK_POR_RUTA: Partial<Record<string, () => Promise<unknown>>> = {
  [ROUTES.PERSONAS]: () => import('@/pages/Personas'),
  [ROUTES.CASAS_DE_PAZ]: () => import('@/pages/CasasDePaz'),
  [ROUTES.MINISTERIOS]: () => import('@/pages/Ministerios'),
  [ROUTES.REPORTES]: () => import('@/pages/Reportes'),
  [ROUTES.HISTORIAL_REPORTES]: () => import('@/pages/HistorialReportes'),
  [ROUTES.HISTORIAL_ASISTENCIA]: () => import('@/pages/HistorialAsistencia'),
  [ROUTES.CALENDARIO]: () => import('@/pages/Calendario'),
  [ROUTES.EVANGELISMO]: () => import('@/pages/Evangelismo'),
  [ROUTES.FINANZAS]: () => import('@/pages/Finanzas'),
  [ROUTES.PANEL_SUPERVISOR]: () => import('@/pages/PanelSupervisor'),
  [ROUTES.ADMINISTRACION]: () => import('@/pages/Administracion'),
};

// Casas de Paz (vista de líder/sublíder), Evangelismo y Reportes arrancan
// pidiendo "mis casas de paz" antes de poder pedir cualquier otra cosa
// (cdpActiva). Precargar eso de entrada le saca un viaje de ida y vuelta a
// la cascada de queries.
const RUTAS_CON_MIS_CASAS = new Set<string>([
  ROUTES.CALENDARIO,
  ROUTES.EVANGELISMO,
  ROUTES.REPORTES,
  ROUTES.HISTORIAL_REPORTES,
  ROUTES.HISTORIAL_ASISTENCIA,
  ROUTES.CASAS_DE_PAZ,
]);

/**
 * Se llama al pasar el mouse (o el foco) por un link del sidebar: el
 * movimiento del mouse hacia el link ya tarda más que esto, así que para
 * cuando llega el click el chunk y el primer dato ya suelen estar listos —
 * el cambio de sección deja de sentirse con retraso.
 */
export function precargarRuta(path: string, queryClient: QueryClient, personaId: string | null, iglesiaId: string | undefined) {
  CHUNK_POR_RUTA[path]?.();

  if (RUTAS_CON_MIS_CASAS.has(path) && personaId) {
    queryClient.prefetchQuery({
      queryKey: ['calendario', 'mis-cdp', personaId],
      queryFn: () => obtenerMisCasasDePaz(personaId),
    });
  }

  // Evangelismo: el catálogo de tipos no depende de la Casa de Paz activa
  // (solo de la iglesia), así que se puede pedir en paralelo con "mis casas"
  // en vez de esperar a que esa resuelva para recién arrancarlo.
  if (path === ROUTES.EVANGELISMO && iglesiaId) {
    queryClient.prefetchQuery({
      queryKey: ['evangelismo', 'tipos', iglesiaId],
      queryFn: () => obtenerTiposEvangelismo(iglesiaId),
      staleTime: 1000 * 60 * 60,
    });
  }

  if (path === ROUTES.DASHBOARD && iglesiaId) {
    queryClient.prefetchQuery({
      queryKey: ['dashboard', 'mis-roles', iglesiaId],
      queryFn: () => obtenerMisRoles(iglesiaId),
    });
  }
}
