import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deshacerFusionCdp,
  deshacerFusionRed,
  fusionarCdp,
  fusionarRed,
  listarFusionesCdp,
  listarFusionesRed,
} from '@/services/fusion.service';

export function useFusionesCdp(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['fusiones', 'cdp', iglesiaId],
    queryFn: () => listarFusionesCdp(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useFusionesRed(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['fusiones', 'red', iglesiaId],
    queryFn: () => listarFusionesRed(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

function useInvalidarFusiones() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['fusiones'] });
    queryClient.invalidateQueries({ queryKey: ['estructura'] });
  };
}

export function useFusionarCdp() {
  const invalidar = useInvalidarFusiones();
  return useMutation({
    mutationFn: ({ origenId, destinoId, motivo, pin }: { origenId: string; destinoId: string; motivo: string; pin?: string }) =>
      fusionarCdp(origenId, destinoId, motivo, pin),
    onSuccess: invalidar,
  });
}

export function useDeshacerFusionCdp() {
  const invalidar = useInvalidarFusiones();
  return useMutation({
    mutationFn: ({ fusionId, motivo, pin }: { fusionId: string; motivo: string; pin?: string }) =>
      deshacerFusionCdp(fusionId, motivo, pin),
    onSuccess: invalidar,
  });
}

export function useFusionarRed() {
  const invalidar = useInvalidarFusiones();
  return useMutation({
    mutationFn: ({ origenId, destinoId, motivo, pin }: { origenId: string; destinoId: string; motivo: string; pin?: string }) =>
      fusionarRed(origenId, destinoId, motivo, pin),
    onSuccess: invalidar,
  });
}

export function useDeshacerFusionRed() {
  const invalidar = useInvalidarFusiones();
  return useMutation({
    mutationFn: ({ fusionId, motivo, pin }: { fusionId: string; motivo: string; pin?: string }) =>
      deshacerFusionRed(fusionId, motivo, pin),
    onSuccess: invalidar,
  });
}
