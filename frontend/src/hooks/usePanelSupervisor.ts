import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  asignarCargoDepartamento,
  cambiarMonedaDefecto,
  obtenerCargoVigenteDepartamento,
  obtenerMonedasActivas,
  obtenerPanelConfiguracion,
  quitarCargoDepartamento,
  renombrarIglesia,
  setConfiguracion,
  toggleDepartamento,
} from '@/services/panel-supervisor.service';
import { useAuthStore } from '@/store/auth.store';

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

export function useCargoVigenteDepartamento(departamentoId: string | undefined) {
  return useQuery({
    queryKey: ['panel-supervisor-cargo-depto', departamentoId],
    queryFn: () => obtenerCargoVigenteDepartamento(departamentoId as string),
    enabled: !!departamentoId,
  });
}

export function useAsignarCargoDepartamento(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      departamentoId,
      personaId,
      cargoId,
      pin,
    }: {
      departamentoId: string;
      personaId: string;
      cargoId: string;
      pin: string;
    }) => asignarCargoDepartamento(iglesiaId as string, departamentoId, personaId, cargoId, pin),
    onSuccess: (_data, { departamentoId }) =>
      queryClient.invalidateQueries({ queryKey: ['panel-supervisor-cargo-depto', departamentoId] }),
  });
}

export function useQuitarCargoDepartamento(departamentoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => quitarCargoDepartamento(id, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['panel-supervisor-cargo-depto', departamentoId] }),
  });
}

export function useRenombrarIglesia(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  const renombrarIglesiaLocal = useAuthStore((s) => s.renombrarIglesiaLocal);
  return useMutation({
    mutationFn: ({ prefijo, sufijo, pin }: { prefijo: string; sufijo: string; pin?: string }) =>
      renombrarIglesia(iglesiaId as string, prefijo, sufijo, pin),
    onSuccess: (_data, { prefijo, sufijo }) => {
      if (iglesiaId) renombrarIglesiaLocal(iglesiaId, `${prefijo} ${sufijo}`);
      queryClient.invalidateQueries({ queryKey: KEY(iglesiaId) });
    },
  });
}
