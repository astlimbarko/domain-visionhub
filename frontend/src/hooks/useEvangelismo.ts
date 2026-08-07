import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarMetaPropia,
  asignarMetaEvangelismo,
  asignarMetaRedEvangelismo,
  crearEvangelizado,
  obtenerEvangelismoRed,
  obtenerEvangelizados,
  obtenerMetaPropia,
  obtenerMetaRedAsignada,
  obtenerMetasCdpRed,
  obtenerTasaEvangelismo,
  obtenerTasaEvangelismoRed,
  obtenerTiposEvangelismo,
} from '@/services/evangelismo.service';
import type { NuevaMetaAsignada, NuevaMetaAsignadaRed, NuevoEvangelizado } from '@/types/evangelismo.types';

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

export function useEvangelismoRed(redId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['evangelismo', 'red-lista', redId, desde, hasta],
    queryFn: () => obtenerEvangelismoRed(redId as string, desde, hasta),
    enabled: !!redId,
    placeholderData: keepPreviousData,
  });
}

export function useTasaEvangelismoRed(redId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['evangelismo', 'red-tasa', redId, desde, hasta],
    queryFn: () => obtenerTasaEvangelismoRed(redId as string, desde, hasta),
    enabled: !!redId,
    placeholderData: keepPreviousData,
  });
}

export function useMetasCdpRed(redId: string | undefined) {
  return useQuery({
    queryKey: ['evangelismo', 'red-metas', redId],
    queryFn: () => obtenerMetasCdpRed(redId as string),
    enabled: !!redId,
  });
}

export function useAsignarMetaEvangelismo(redId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevaMetaAsignada) => asignarMetaEvangelismo(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-metas', redId] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-tasa', redId] });
    },
  });
}

/** Meta que el Supervisor le asignó a una Red completa, vigente hoy (o null). */
export function useMetaRedAsignada(redId: string | undefined) {
  return useQuery({
    queryKey: ['evangelismo', 'red-meta-asignada', redId],
    queryFn: () => obtenerMetaRedAsignada(redId as string),
    enabled: !!redId,
  });
}

export function useAsignarMetaRedEvangelismo(redId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevaMetaAsignadaRed) => asignarMetaRedEvangelismo(datos),
    onSuccess: () => {
      // Se hereda hacia las CdP sin meta propia (fn_meta_efectiva) -- hay que
      // refrescar la lista por CdP y la tasa de la Red, no solo el número
      // nuevo de la Red misma.
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-meta-asignada', redId] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-metas', redId] });
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-tasa', redId] });
    },
  });
}
