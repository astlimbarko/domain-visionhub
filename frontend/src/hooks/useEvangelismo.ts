import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarMetaPropia,
  crearEvangelizado,
  obtenerEvangelizados,
  obtenerTasaEvangelismo,
} from '@/services/evangelismo.service';
import type { NuevoEvangelizado } from '@/types/evangelismo.types';

export function useTasaEvangelismo(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['evangelismo', 'tasa', casaDePazId, desde, hasta],
    queryFn: () => obtenerTasaEvangelismo(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
  });
}

export function useEvangelizados(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['evangelismo', 'lista', casaDePazId, desde, hasta],
    queryFn: () => obtenerEvangelizados(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['evangelismo', 'tasa', casaDePazId] }),
  });
}
