import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarMetaPropia,
  crearEvangelizado,
  obtenerEvangelizados,
  obtenerMetaPropia,
  obtenerTasaEvangelismo,
  obtenerTiposEvangelismo,
} from '@/services/evangelismo.service';
import type { NuevoEvangelizado } from '@/types/evangelismo.types';

export function useTiposEvangelismo(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['evangelismo', 'tipos', iglesiaId],
    queryFn: () => obtenerTiposEvangelismo(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 60,
  });
}

export function useTasaEvangelismo(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['evangelismo', 'tasa', casaDePazId, desde, hasta],
    queryFn: () => obtenerTasaEvangelismo(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    // Igual que en Calendario: al cambiar de mes, mantiene el número anterior
    // en pantalla en vez de parpadear a un skeleton mientras llega el nuevo.
    placeholderData: keepPreviousData,
  });
}

export function useMetaPropia(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['evangelismo', 'meta-propia', casaDePazId],
    queryFn: () => obtenerMetaPropia(casaDePazId as string),
    enabled: !!casaDePazId,
  });
}

export function useEvangelizados(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['evangelismo', 'lista', casaDePazId, desde, hasta],
    queryFn: () => obtenerEvangelizados(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
  });
}

export function useCrearEvangelizado(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevoEvangelizado) => crearEvangelizado(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'lista', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'tasa', casaDePazId] });
    },
  });
}

export function useActualizarMetaPropia(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meta: number | null) => actualizarMetaPropia(casaDePazId as string, meta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'tasa', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'meta-propia', casaDePazId] });
    },
  });
}
