import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearIngreso,
  obtenerComparativo,
  obtenerIngresosCdp,
  obtenerTiposIngreso,
} from '@/services/finanzas.service';
import type { NuevoIngreso } from '@/types/finanzas.types';

export function useTiposIngreso(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['finanzas', 'tipos', iglesiaId],
    queryFn: () => obtenerTiposIngreso(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 60,
  });
}

export function useIngresosCdp(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['finanzas', 'ingresos', casaDePazId, desde, hasta],
    queryFn: () => obtenerIngresosCdp(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
  });
}

export function useComparativo(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['finanzas', 'comparativo', casaDePazId, desde, hasta],
    queryFn: () => obtenerComparativo(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
  });
}

export function useCrearIngreso(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevoIngreso) => crearIngreso(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finanzas', 'ingresos', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['finanzas', 'comparativo', casaDePazId] });
    },
  });
}
