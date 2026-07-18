import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearEvento,
  obtenerCumpleanos,
  obtenerEventosMes,
  obtenerMisCasasDePaz,
  obtenerProximos,
  obtenerTiposEvento,
} from '@/services/calendario.service';
import type { NuevoEvento } from '@/types/calendario.types';

export function useMisCasasDePaz(personaId: string | null) {
  return useQuery({
    queryKey: ['calendario', 'mis-cdp', personaId],
    queryFn: () => obtenerMisCasasDePaz(personaId as string),
    enabled: !!personaId,
  });
}

export function useTiposEvento(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['calendario', 'tipos-evento', iglesiaId],
    queryFn: () => obtenerTiposEvento(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 60,
  });
}

export function useEventosMes(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['calendario', 'eventos', casaDePazId, desde, hasta],
    queryFn: () => obtenerEventosMes(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
  });
}

export function useCumpleanosMes(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['calendario', 'cumpleanos', casaDePazId, desde, hasta],
    queryFn: () => obtenerCumpleanos(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
  });
}

export function useProximos(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['calendario', 'proximos', casaDePazId],
    queryFn: () => obtenerProximos(casaDePazId as string),
    enabled: !!casaDePazId,
  });
}

export function useCrearEvento(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (evento: NuevoEvento) => crearEvento(evento),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendario', 'eventos', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['calendario', 'proximos', casaDePazId] });
    },
  });
}
