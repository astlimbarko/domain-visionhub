import { useQuery } from '@tanstack/react-query';
import {
  obtenerDashboardLiderCdp,
  obtenerDashboardLiderRed,
  obtenerDashboardPastor,
  obtenerDashboardSubliderCdp,
  obtenerDashboardSupervisor,
  obtenerMisRoles,
} from '@/services/dashboard.service';

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
  });
}

export function useDashboardSubliderCdp(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'sublider-cdp', casaDePazId],
    queryFn: () => obtenerDashboardSubliderCdp(casaDePazId as string),
    enabled: !!casaDePazId,
  });
}

export function useDashboardLiderRed(redId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'lider-red', redId],
    queryFn: () => obtenerDashboardLiderRed(redId as string),
    enabled: !!redId,
  });
}

export function useDashboardSupervisor(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'supervisor', iglesiaId],
    queryFn: () => obtenerDashboardSupervisor(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useDashboardPastor(habilitado: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'pastor'],
    queryFn: () => obtenerDashboardPastor(),
    enabled: habilitado,
  });
}
