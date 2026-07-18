import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearReporte,
  obtenerCamposObligatorios,
  obtenerLibros,
  obtenerMegaFiestaDelDia,
  obtenerMiembrosCdp,
  obtenerReportesRecientes,
  obtenerTemas,
} from '@/services/reporte.service';
import type { NuevoReporte } from '@/types/reporte.types';

export function useLibros() {
  return useQuery({ queryKey: ['reporte', 'libros'], queryFn: obtenerLibros, staleTime: 1000 * 60 * 60 });
}

export function useTemas(libroId: string | undefined, iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'temas', libroId, iglesiaId],
    queryFn: () => obtenerTemas(libroId as string, iglesiaId as string),
    enabled: !!libroId && !!iglesiaId,
  });
}

export function useMiembrosCdp(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'miembros', casaDePazId],
    queryFn: () => obtenerMiembrosCdp(casaDePazId as string),
    enabled: !!casaDePazId,
  });
}

export function useCamposObligatoriosReporte(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'campos-obligatorios', iglesiaId],
    queryFn: () => obtenerCamposObligatorios(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useMegaFiestaDelDia(casaDePazId: string | undefined, fecha: string) {
  return useQuery({
    queryKey: ['reporte', 'megafiesta', casaDePazId, fecha],
    queryFn: () => obtenerMegaFiestaDelDia(casaDePazId as string, fecha),
    enabled: !!casaDePazId && !!fecha,
  });
}

export function useReportesRecientes(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'recientes', casaDePazId],
    queryFn: () => obtenerReportesRecientes(casaDePazId as string),
    enabled: !!casaDePazId,
  });
}

export function useCrearReporte(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevoReporte) => crearReporte(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'recientes', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['calendario'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas'] });
    },
  });
}
