import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listarCasasDePazAfirmacion,
  listarLideresCdpAfirmacion,
  listarUrlsAfirmacion,
  obtenerEstadisticasPersonasAfirmacion,
  obtenerEstadisticasRegistroAfirmacion,
  registrarPersonaAfirmacion,
  setEstadoUrlsAfirmacion,
} from '@/services/afirmacion.service';
import type { DatosPersonaAfirmacion, EstadoUrl } from '@/types/afirmacion.types';

export function useLideresCdpAfirmacion(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['afirmacion', 'lideres-cdp', iglesiaId],
    queryFn: () => listarLideresCdpAfirmacion(iglesiaId as string),
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
