import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearEventoAfirmacion,
  listarEventosAfirmacion,
  listarTiposEvento,
  obtenerDetalleEventoAfirmacion,
  obtenerHistorialProcesoConEvento,
} from '@/services/afirmacion-eventos.service';
import type { ProcesoAfirmacionCodigo } from '@/types/afirmacion-eventos.types';

export const queryKeys = {
  tiposEvento: ['afirmacion', 'eventos', 'tipos'] as const,
  eventos: (iglesiaId: string | null, soloActivos?: boolean, procesoCodigo?: string | null) =>
    ['afirmacion', 'eventos', iglesiaId, soloActivos, procesoCodigo ?? null] as const,
  eventoDetalle: (eventoId: string | null) => ['afirmacion', 'eventos', 'detalle', eventoId] as const,
  historial: (
    iglesiaId: string | null,
    procesoCodigo: string,
    eventoId: string | null,
    registradoPor: string | null
  ) => ['afirmacion', 'historial', iglesiaId, procesoCodigo, eventoId, registradoPor] as const,
};

export function useTiposEvento() {
  return useQuery({
    queryKey: queryKeys.tiposEvento,
    queryFn: () => listarTiposEvento(),
  });
}

export function useEventosAfirmacion(
  iglesiaId: string | null,
  soloActivos = false,
  procesoCodigo: string | null = null
) {
  return useQuery({
    queryKey: queryKeys.eventos(iglesiaId, soloActivos, procesoCodigo),
    queryFn: () => listarEventosAfirmacion(iglesiaId as string, soloActivos, procesoCodigo),
    enabled: !!iglesiaId,
  });
}

export function useEventoDetalle(eventoId: string | null) {
  return useQuery({
    queryKey: queryKeys.eventoDetalle(eventoId),
    queryFn: () => obtenerDetalleEventoAfirmacion(eventoId as string),
    enabled: !!eventoId,
  });
}

export function useCrearEventoAfirmacion(iglesiaId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      titulo: string;
      fechaInicio: string;
      fechaFin: string | null;
      descripcion: string | null;
      actividades: string[];
    }) =>
      crearEventoAfirmacion(
        iglesiaId as string,
        params.titulo,
        params.fechaInicio,
        params.fechaFin,
        params.descripcion,
        params.actividades
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['afirmacion', 'eventos', iglesiaId] });
    },
  });
}

export function useHistorialProcesoConEvento(
  iglesiaId: string | null,
  procesoCodigo: ProcesoAfirmacionCodigo | string,
  eventoId: string | null,
  registradoPor: string | null = null
) {
  return useQuery({
    queryKey: queryKeys.historial(iglesiaId, procesoCodigo, eventoId, registradoPor),
    queryFn: () =>
      obtenerHistorialProcesoConEvento(iglesiaId as string, procesoCodigo, registradoPor, eventoId),
    enabled: !!iglesiaId,
  });
}
