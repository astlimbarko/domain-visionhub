import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buscarMembresiaAfirmacion,
  listarCasasDePazAfirmacion,
  listarEstados,
  listarLideresCdpAfirmacion,
  listarRedesAfirmacion,
  listarUrlsAfirmacion,
  obtenerConfigRegistroUrlAfirmacion,
  obtenerEstadisticasPersonasAfirmacion,
  obtenerEstadisticasRegistroAfirmacion,
  registrarPersonaAfirmacion,
  setEstadoUrlsAfirmacion,
  type FiltrosMembresiaAfirmacion,
} from '@/services/afirmacion.service';
import type { DatosPersonaAfirmacion, EstadoUrl } from '@/types/afirmacion.types';

/** Catálogo global -- queryKey sin iglesiaId a propósito, es el mismo para
 * toda la app. */
export function useEstados() {
  return useQuery({
    queryKey: ['catalogo', 'estados'],
    queryFn: listarEstados,
    staleTime: 1000 * 60 * 30,
  });
}

/** KAN-358 seguimiento: tabla de Membresía con campos reales del censo. */
export function useBuscarMembresiaAfirmacion(
  iglesiaId: string | undefined,
  texto: string,
  pagina: number,
  porPagina: number,
  filtros: FiltrosMembresiaAfirmacion = {},
) {
  return useQuery({
    queryKey: ['afirmacion', 'membresia', iglesiaId, texto, pagina, porPagina, filtros],
    queryFn: () => buscarMembresiaAfirmacion(iglesiaId as string, texto, pagina, porPagina, filtros),
    enabled: !!iglesiaId,
  });
}

export function useLideresCdpAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'lideres-cdp', iglesiaId],
    queryFn: () => listarLideresCdpAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

// Plan panel Afirmación 2026-08-21: selector de Red antes que el de líder.
export function useRedesAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'redes', iglesiaId],
    queryFn: () => listarRedesAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useRegistrarPersonaAfirmacion() {
  return useMutation({
    mutationFn: ({ datos, casaDePazCargoId }: { datos: DatosPersonaAfirmacion; casaDePazCargoId: string }) =>
      registrarPersonaAfirmacion(datos, casaDePazCargoId),
  });
}

export function useUrlsAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'urls', iglesiaId],
    queryFn: () => listarUrlsAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useSetEstadoUrlsAfirmacion(iglesiaId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, estado }: { ids: string[]; estado: EstadoUrl }) => setEstadoUrlsAfirmacion(ids, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['afirmacion', 'urls', iglesiaId] });
    },
  });
}

export function useConfigRegistroUrlAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'config-registro-url', iglesiaId],
    queryFn: () => obtenerConfigRegistroUrlAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

// KAN-127: todas las Casas de Paz de la iglesia (con o sin líder vigente).
export function useCasasDePazAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'casas-de-paz', iglesiaId],
    queryFn: () => listarCasasDePazAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

// KAN-214: registros por URL vs. formulario interno de Afirmación.
export function useEstadisticasRegistroAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'estadisticas-registro', iglesiaId],
    queryFn: () => obtenerEstadisticasRegistroAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

// KAN-216: totales de personas para /afirmacion-personas.
export function useEstadisticasPersonasAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'estadisticas-personas', iglesiaId],
    queryFn: () => obtenerEstadisticasPersonasAfirmacion(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}
