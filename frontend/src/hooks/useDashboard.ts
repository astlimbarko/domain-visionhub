import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  obtenerAsistenciaPromedioPeriodo,
  obtenerDashboardLiderCdp,
  obtenerDashboardLiderRed,
  obtenerDashboardPastor,
  obtenerDashboardSubliderCdp,
  obtenerDashboardSupervisor,
  obtenerIngresosCdpPeriodo,
  obtenerIngresosRedPeriodo,
  obtenerIngresosSupervisorPeriodo,
  obtenerMisRoles,
  obtenerTendenciaAsistencia,
} from '@/services/dashboard.service';
import type { GranularidadTendencia } from '@/utils/periodo-dashboard';

export function useMisRoles(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'mis-roles', iglesiaId],
    queryFn: () => obtenerMisRoles(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useDashboardLiderCdp(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'lider-cdp', casaDePazId],
    queryFn: () => obtenerDashboardLiderCdp(casaDePazId as string),
    enabled: !!casaDePazId,
    // Cambiar de Casa de Paz en el selector no debe tirar toda la vista a un skeleton.
    placeholderData: keepPreviousData,
  });
}

export function useDashboardSubliderCdp(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'sublider-cdp', casaDePazId],
    queryFn: () => obtenerDashboardSubliderCdp(casaDePazId as string),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardLiderRed(redId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'lider-red', redId],
    queryFn: () => obtenerDashboardLiderRed(redId as string),
    enabled: !!redId,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardSupervisor(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'supervisor', iglesiaId],
    queryFn: () => obtenerDashboardSupervisor(iglesiaId as string),
    enabled: !!iglesiaId,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardPastor(habilitado: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'pastor'],
    queryFn: () => obtenerDashboardPastor(),
    enabled: habilitado,
  });
}

export function useTendenciaAsistencia(
  casaDePazId: string | undefined,
  granularidad: GranularidadTendencia,
  cantidad: number,
  rangoPersonalizado?: { desde: string; hasta: string }
) {
  return useQuery({
    queryKey: ['dashboard', 'tendencia-asistencia', casaDePazId, granularidad, cantidad, rangoPersonalizado],
    queryFn: () => obtenerTendenciaAsistencia(casaDePazId as string, granularidad, cantidad, rangoPersonalizado),
    enabled: !!casaDePazId,
    // Cambiar el período/rango no debe vaciar el gráfico mientras llega el nuevo dato.
    placeholderData: keepPreviousData,
  });
}

export function useAsistenciaPromedioPeriodo(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'asistencia-promedio-periodo', casaDePazId, desde, hasta],
    queryFn: () => obtenerAsistenciaPromedioPeriodo(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
  });
}

/** Ingresos de una CdP en el período elegido (reemplaza `kpi.ingresos_mes`, que en el backend siempre es "el mes calendario"). */
export function useIngresosCdpPeriodo(casaDePazId: string | undefined, desde: string, hasta: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'ingresos-cdp-periodo', casaDePazId, desde, hasta],
    queryFn: () => obtenerIngresosCdpPeriodo(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId && habilitado,
    placeholderData: keepPreviousData,
  });
}

/** Ingresos de una Red en el período elegido (reemplaza `kpi.ofrendas_mes`/`ingresos`, fijos al mes calendario). */
export function useIngresosRedPeriodo(redId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'ingresos-red-periodo', redId, desde, hasta],
    queryFn: () => obtenerIngresosRedPeriodo(redId as string, desde, hasta),
    enabled: !!redId,
    placeholderData: keepPreviousData,
  });
}

/** Ingresos de toda la iglesia en el período elegido, sumando por red (ver obtenerIngresosSupervisorPeriodo). */
export function useIngresosSupervisorPeriodo(redIds: string[], desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'ingresos-supervisor-periodo', redIds, desde, hasta],
    queryFn: () => obtenerIngresosSupervisorPeriodo(redIds, desde, hasta),
    enabled: redIds.length > 0,
    placeholderData: keepPreviousData,
  });
}
