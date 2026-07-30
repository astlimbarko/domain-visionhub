import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearReporte,
  obtenerCamposObligatorios,
  obtenerEdadMinimaCreyente,
  obtenerFechasReportadas,
  obtenerHistorialAsistencia,
  obtenerLibros,
  obtenerMegaFiestaDelDia,
  obtenerMiembrosCdp,
  obtenerReportesRecientes,
  obtenerReportesRedRango,
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
    // Cambiar de Casa de Paz en el selector no debe vaciar las listas de asistencia.
    placeholderData: keepPreviousData,
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

/** Umbral configurable de edad (niño vs. regular) — ver obtenerEdadMinimaCreyente. */
export function useEdadMinimaCreyente(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'edad-minima-creyente', iglesiaId],
    queryFn: () => obtenerEdadMinimaCreyente(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 60,
  });
}

export function useMegaFiestaDelDia(casaDePazId: string | undefined, fecha: string) {
  return useQuery({
    queryKey: ['reporte', 'megafiesta', casaDePazId, fecha],
    queryFn: () => obtenerMegaFiestaDelDia(casaDePazId as string, fecha),
    enabled: !!casaDePazId && !!fecha,
  });
}

export function useReportesRecientes(casaDePazIds: string[]) {
  return useQuery({
    queryKey: ['reporte', 'recientes', casaDePazIds],
    queryFn: () => obtenerReportesRecientes(casaDePazIds),
    enabled: casaDePazIds.length > 0,
  });
}

/** Reportes de todas las Casas de Paz de la Red en un rango — vista supervisora del Líder de Red. */
export function useReportesRedRango(casaDePazIds: string[], desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte', 'red-rango', [...casaDePazIds].sort(), desde, hasta],
    queryFn: () => obtenerReportesRedRango(casaDePazIds, desde, hasta),
    enabled: casaDePazIds.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useHistorialReportes(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte', 'historial-fechas', casaDePazId, desde, hasta],
    queryFn: () => obtenerFechasReportadas(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
  });
}

export function useHistorialAsistencia(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'historial-asistencia', casaDePazId],
    queryFn: () => obtenerHistorialAsistencia(casaDePazId as string),
    enabled: !!casaDePazId,
  });
}

export function useCrearReporte(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevoReporte) => crearReporte(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'recientes'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-fechas'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-asistencia', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['calendario'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas'] });
      // El reporte cambia asistencia/miembros/ingresos que el Dashboard ya muestra:
      // sin esto, el Dashboard queda con datos viejos hasta el próximo refetch natural.
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
