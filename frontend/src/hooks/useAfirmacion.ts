import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listarLideresCdpAfirmacion,
  listarUrlsAfirmacion,
  registrarPersonaAfirmacion,
  setEstadoUrlsAfirmacion,
} from '@/services/afirmacion.service';
import type { DatosPersonaAfirmacion, EstadoUrl } from '@/types/afirmacion.types';

export function useLideresCdpAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'lideres-cdp', iglesiaId],
    queryFn: () => listarLideresCdpAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useRegistrarPersonaAfirmacion() {
  return useMutation({
    mutationFn: ({ datos, casaDePazCargoId }: { datos: DatosPersonaAfirmacion; casaDePazCargoId: string }) =>
      registrarPersonaAfirmacion(datos, casaDePazCargoId),
  });
}

export function useUrlsAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'urls', iglesiaId],
    queryFn: () => listarUrlsAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useSetEstadoUrlsAfirmacion(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, estado }: { ids: string[]; estado: EstadoUrl }) => setEstadoUrlsAfirmacion(ids, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['afirmacion', 'urls', iglesiaId] });
    },
  });
}
