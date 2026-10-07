import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEventoAfirmacionActivo } from '@/stores/useEventoAfirmacionActivo';
import {
  buscarMembresiaAfirmacion,
  eliminarProcesoAfirmacion,
  listarCasasDePazAfirmacion,
  listarEstados,
  listarLideresCdpAfirmacion,
  listarRedesAfirmacion,
  listarUrlsAfirmacion,
  obtenerConfigRegistroUrlAfirmacion,
  obtenerEstadisticasPersonasAfirmacion,
  obtenerEstadisticasRegistroAfirmacion,
  obtenerEstadoProcesoAfirmacion,
  obtenerHistorialProcesoAfirmacion,
  registrarPersonaAfirmacion,
  registrarProcesoAfirmacion,
  setEstadoUrlsAfirmacion,
  type FiltrosMembresiaAfirmacion,
  type ProcesoAfirmacionCodigo,
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
// KAN-386 seguimiento (2026-09-17): casaDePazId opcional -- scoped al panel
// "Membresía" por CdP.
// KAN-479 seguimiento (2026-09-27): filtros + texto para que los chips se
// recalculen en cascada según lo que ya está filtrado en la tabla de abajo.
export function useEstadisticasPersonasAfirmacion(
  iglesiaId: string | undefined,
  casaDePazId?: string,
  filtros: FiltrosMembresiaAfirmacion = {},
  texto = '',
) {
  return useQuery({
    queryKey: ['afirmacion', 'estadisticas-personas', iglesiaId, casaDePazId, filtros, texto],
    queryFn: () => obtenerEstadisticasPersonasAfirmacion(iglesiaId as string, casaDePazId, filtros, texto),
    enabled: !!iglesiaId,
  });
}

// ---- KAN-481 Altar / KAN-483 RSIL / KAN-484 Fiesta de Bienvenida ----

export function useRegistrarProcesoAfirmacion() {
  const qc = useQueryClient();
  // Evento activo (si el usuario eligió uno en el selector): el registro nuevo
  // queda tagueado a ese evento. Si no hay ninguno, va sin evento (null).
  const eventoId = useEventoAfirmacionActivo((s) => s.eventoId);
  return useMutation({
    mutationFn: ({ personaId, procesoCodigo, fecha }: { personaId: string; procesoCodigo: ProcesoAfirmacionCodigo; fecha: string }) =>
      registrarProcesoAfirmacion(personaId, procesoCodigo, fecha, eventoId),
    onSuccess: (_data, { procesoCodigo, personaId }) => {
      qc.invalidateQueries({ queryKey: ['afirmacion', 'proceso-historial', procesoCodigo] });
      qc.invalidateQueries({ queryKey: ['afirmacion', 'proceso-estado', personaId, procesoCodigo] });
    },
  });
}

/** Soft-delete de un registro de proceso (quitar duplicados desde "Registro").
 * Invalida el historial del proceso para que la fila desaparezca de la lista. */
export function useEliminarProcesoAfirmacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registroId }: { registroId: string; procesoCodigo: ProcesoAfirmacionCodigo }) =>
      eliminarProcesoAfirmacion(registroId),
    onSuccess: (_data, { procesoCodigo }) => {
      qc.invalidateQueries({ queryKey: ['afirmacion', 'proceso-historial', procesoCodigo] });
    },
  });
}

export function useEstadoProcesoAfirmacion(personaId: string | undefined, procesoCodigo: ProcesoAfirmacionCodigo) {
  return useQuery({
    queryKey: ['afirmacion', 'proceso-estado', personaId, procesoCodigo],
    queryFn: () => obtenerEstadoProcesoAfirmacion(personaId as string, procesoCodigo),
    enabled: !!personaId,
  });
}

export function useHistorialProcesoAfirmacion(iglesiaId: string | undefined, procesoCodigo: ProcesoAfirmacionCodigo, registradoPor?: string) {
  // Si hay un evento activo seleccionado, la lista de la pestaña "Registro" se
  // filtra a ese evento; si no, muestra todo (comportamiento de siempre).
  const eventoId = useEventoAfirmacionActivo((s) => s.eventoId);
  return useQuery({
    queryKey: ['afirmacion', 'proceso-historial', procesoCodigo, iglesiaId, registradoPor, eventoId],
    queryFn: () => obtenerHistorialProcesoAfirmacion(iglesiaId as string, procesoCodigo, registradoPor, eventoId),
    enabled: !!iglesiaId,
    // Pestaña "Datos" de Altar (pedido explícito del owner, 2026-09-29): siempre
    // trae lo último al abrirla -- otro colaborador puede haber registrado
    // personas mientras tanto, no alcanza con el staleTime global de 30s.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
