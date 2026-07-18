import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cambiarMonedaDefecto,
  obtenerMonedasActivas,
  obtenerPanelConfiguracion,
  setConfiguracion,
  toggleDepartamento,
} from '@/services/panel-supervisor.service';

const KEY = (iglesiaId: string | undefined) => ['panel-supervisor', iglesiaId] as const;
const KEY_MONEDAS = (iglesiaId: string | undefined) => ['panel-supervisor-monedas', iglesiaId] as const;

export function usePanelConfiguracion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: KEY(iglesiaId),
    queryFn: () => obtenerPanelConfiguracion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useMonedasActivas(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: KEY_MONEDAS(iglesiaId),
    queryFn: () => obtenerMonedasActivas(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useSetConfiguracion(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ codigo, valor, pin }: { codigo: string; valor: string; pin?: string }) =>
      setConfiguracion(iglesiaId as string, codigo, valor, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(iglesiaId) }),
  });
}

export function useToggleDepartamento(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ departamentoId, activo, pin }: { departamentoId: string; activo: boolean; pin?: string }) =>
      toggleDepartamento(departamentoId, activo, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(iglesiaId) }),
  });
}

export function useCambiarMonedaDefecto(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ monedaId, pin }: { monedaId: string; pin?: string }) =>
      cambiarMonedaDefecto(iglesiaId as string, monedaId, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(iglesiaId) }),
  });
}
