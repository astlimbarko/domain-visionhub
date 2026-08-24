import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearEvento,
  eliminarEvento,
  obtenerCumpleanos,
  obtenerEventosIglesia,
  obtenerEventosMes,
  obtenerEventosRed,
  obtenerIglesiasHijas,
  obtenerMisCasasDePaz,
  obtenerProximos,
  obtenerProximosIglesia,
  obtenerProximosRed,
  obtenerTiposEvento,
} from '@/services/calendario.service';
import type { NuevoEvento } from '@/types/calendario.types';

export function useMisCasasDePaz(personaId: string | null) {
  return useQuery({
    queryKey: ['calendario', 'mis-cdp', personaId],
    queryFn: () => obtenerMisCasasDePaz(personaId as string),
    enabled: !!personaId,
    // Los cargos de CdP de una persona casi no cambian en medio de una
    // sesion, y esta query es un waterfall (cargo + N RPC de etiqueta) que
    // bloquea el render de Evangelismo/Calendario -- sin esto se repetia en
    // cada navegacion de ida y vuelta a esas paginas (default global 30s).
    staleTime: 1000 * 60 * 10,
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

export function useEventosMes(casaDePazId: string | undefined, desde: string, hasta: string, tipoEventoId?: string) {
  return useQuery({
    queryKey: ['calendario', 'eventos', casaDePazId, desde, hasta, tipoEventoId],
    queryFn: () => obtenerEventosMes(casaDePazId as string, desde, hasta, tipoEventoId),
    enabled: !!casaDePazId,
    // Al cambiar de mes o de filtro, sigue mostrando los datos anteriores mientras
    // llegan los nuevos en vez de vaciar la grilla a un skeleton -- evita el "corte".
    placeholderData: keepPreviousData,
  });
}

export function useCumpleanosMes(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['calendario', 'cumpleanos', casaDePazId, desde, hasta],
    queryFn: () => obtenerCumpleanos(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
  });
}

export function useProximos(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['calendario', 'proximos', casaDePazId],
    queryFn: () => obtenerProximos(casaDePazId as string),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
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

export function useEventosRed(redId: string | undefined, desde: string, hasta: string, tipoEventoId?: string) {
  return useQuery({
    queryKey: ['calendario', 'eventos-red', redId, desde, hasta, tipoEventoId],
    queryFn: () => obtenerEventosRed(redId as string, desde, hasta, tipoEventoId),
    enabled: !!redId,
    placeholderData: keepPreviousData,
  });
}

export function useProximosRed(redId: string | undefined) {
  return useQuery({
    queryKey: ['calendario', 'proximos-red', redId],
    queryFn: () => obtenerProximosRed(redId as string),
    enabled: !!redId,
    placeholderData: keepPreviousData,
  });
}

export function useCrearEventoRed(redId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (evento: NuevoEvento) => crearEvento(evento),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendario', 'eventos-red', redId] });
      queryClient.invalidateQueries({ queryKey: ['calendario', 'proximos-red', redId] });
    },
  });
}

export function useEliminarEvento(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventoId: string) => eliminarEvento(eventoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendario', 'eventos', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['calendario', 'proximos', casaDePazId] });
    },
  });
}

export function useEliminarEventoRed(redId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventoId: string) => eliminarEvento(eventoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendario', 'eventos-red', redId] });
      queryClient.invalidateQueries({ queryKey: ['calendario', 'proximos-red', redId] });
    },
  });
}

export function useEventosIglesia(iglesiaId: string | undefined, desde: string, hasta: string, tipoEventoId?: string) {
  return useQuery({
    queryKey: ['calendario', 'eventos-iglesia', iglesiaId, desde, hasta, tipoEventoId],
    queryFn: () => obtenerEventosIglesia(iglesiaId as string, desde, hasta, tipoEventoId),
    enabled: !!iglesiaId,
    placeholderData: keepPreviousData,
  });
}

export function useProximosIglesia(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['calendario', 'proximos-iglesia', iglesiaId],
    queryFn: () => obtenerProximosIglesia(iglesiaId as string),
    enabled: !!iglesiaId,
    placeholderData: keepPreviousData,
  });
}

export function useCrearEventoIglesia(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (evento: NuevoEvento) => crearEvento(evento),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendario', 'eventos-iglesia', iglesiaId] });
      queryClient.invalidateQueries({ queryKey: ['calendario', 'proximos-iglesia', iglesiaId] });
    },
  });
}

export function useEliminarEventoIglesia(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventoId: string) => eliminarEvento(eventoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendario', 'eventos-iglesia', iglesiaId] });
      queryClient.invalidateQueries({ queryKey: ['calendario', 'proximos-iglesia', iglesiaId] });
    },
  });
}

/** Iglesias hijas/satélite directas -- para el selector "Iglesia: [la mía / mi hija]" del Supervisor. */
export function useIglesiasHijas(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['calendario', 'iglesias-hijas', iglesiaId],
    queryFn: () => obtenerIglesiasHijas(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}
