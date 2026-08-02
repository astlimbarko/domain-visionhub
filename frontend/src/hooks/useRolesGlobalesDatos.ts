import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  asignarCargoGlobal,
  obtenerCargoVigenteGlobal,
  obtenerJovenesIglesia,
  obtenerMatrimoniosIglesia,
  quitarCargoGlobal,
  type CodigoRolGlobal,
} from '@/services/roles-globales.service';

export function useJovenesIglesia(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['roles-globales', 'jovenes', iglesiaId],
    queryFn: () => obtenerJovenesIglesia(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useMatrimoniosIglesia(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['roles-globales', 'matrimonios', iglesiaId],
    queryFn: () => obtenerMatrimoniosIglesia(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useCargoVigenteGlobal(iglesiaId: string | undefined, codigo: CodigoRolGlobal) {
  return useQuery({
    queryKey: ['roles-globales', 'cargo', iglesiaId, codigo],
    queryFn: () => obtenerCargoVigenteGlobal(iglesiaId as string, codigo),
    enabled: !!iglesiaId,
  });
}

export function useAsignarCargoGlobal(iglesiaId: string | undefined, codigo: CodigoRolGlobal) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => asignarCargoGlobal(iglesiaId as string, personaId, codigo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles-globales', 'cargo', iglesiaId, codigo] }),
  });
}

export function useQuitarCargoGlobal(iglesiaId: string | undefined, codigo: CodigoRolGlobal) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (asignacionId: string) => quitarCargoGlobal(asignacionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles-globales', 'cargo', iglesiaId, codigo] }),
  });
}
