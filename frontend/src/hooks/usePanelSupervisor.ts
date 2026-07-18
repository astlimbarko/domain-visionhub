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
    mutationFn: ({ codigo, valor }: { codigo: string; valor: string }) =>
      setConfiguracion(iglesiaId as string, codigo, valor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(iglesiaId) }),
  });
}

export function useToggleDepartamento(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ departamentoId, activo }: { departamentoId: string; activo: boolean }) =>
      toggleDepartamento(departamentoId, activo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(iglesiaId) }),
  });
}

export function useCambiarMonedaDefecto(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (monedaId: string) => cambiarMonedaDefecto(iglesiaId as string, monedaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY(iglesiaId) }),
  });
}
