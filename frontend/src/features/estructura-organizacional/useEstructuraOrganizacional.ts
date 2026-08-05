import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { guardarPosicionesEstructura, obtenerEstructuraOrganizacional } from './estructura.service';
import type { PosicionNodoGuardar } from './types';

export function useEstructuraOrganizacional(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['estructura-organizacional', iglesiaId],
    queryFn: () => obtenerEstructuraOrganizacional(iglesiaId as string),
    enabled: Boolean(iglesiaId),
    staleTime: 30_000,
  });
}

export function useGuardarPosicionesEstructura(iglesiaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodos, version }: { nodos: PosicionNodoGuardar[]; version: number }) =>
      guardarPosicionesEstructura(iglesiaId, nodos, version),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] }),
  });
}
