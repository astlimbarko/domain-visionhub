import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarMetaPropia,
  asignarMetaEvangelismo,
  asignarMetaRedEvangelismo,
  buscarEvangelizados,
  crearEvangelizado,
  crearEvangelizadoRed,
  obtenerEvangelismoRed,
  obtenerEvangelismoRedDirecto,
  obtenerEvangelizados,
  obtenerMetaPropia,
  obtenerMetaRedAsignada,
  obtenerMetasCdpRed,
  obtenerTasaEvangelismo,
  obtenerTasaEvangelismoRed,
  obtenerTestimoniosEvangelismo,
  obtenerTestimoniosEvangelismoRed,
  obtenerTiposEvangelismo,
  soyRolSuperiorDeCdp,
} from '@/services/evangelismo.service';
import type { NuevaMetaAsignada, NuevaMetaAsignadaRed, NuevoEvangelizado, NuevoEvangelizadoRed } from '@/types/evangelismo.types';

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

/** KAN-290: si quien mira ya es rol superior de esta CdP (Pastor, Supervisor,
 * Líder/Sublíder de la Red), el bloqueo de "meta propia" por una meta
 * asignada no debe aplicarle -- mismo criterio que ya exime el backend. */
export function useSoyRolSuperiorDeCdp(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['evangelismo', 'rol-superior-cdp', casaDePazId],
    queryFn: () => soyRolSuperiorDeCdp(casaDePazId as string),
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

/** Roster completo de la iglesia con filtros/paginación -- página "Personas
 * evangelizadas" (KAN-335). */
export function useBuscarEvangelizados(
  iglesiaId: string | undefined,
  redId: string | undefined,
  texto: string,
  desde: string | undefined,
  hasta: string | undefined,
  pagina: number,
  porPagina: number,
  casaDePazId?: string,
  tipoEvangelismoId?: string,
  evangelizadoPorId?: string
) {
  return useQuery({
    queryKey: ['evangelismo', 'buscar', iglesiaId, redId, texto, desde, hasta, pagina, porPagina, casaDePazId, tipoEvangelismoId, evangelizadoPorId],
    queryFn: () =>
      buscarEvangelizados(iglesiaId as string, redId, texto, desde, hasta, pagina, porPagina, casaDePazId, tipoEvangelismoId, evangelizadoPorId),
    enabled: !!iglesiaId,
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
      // Si se cargó con tipo Elite, puede haber traído un testimonio (ver
      // fn_registrar_evangelizado) -- sin esto la pestaña Testimonios Elite
      // queda con la lista vieja hasta un refetch natural.
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'testimonios', casaDePazId] });
    },
  });
}

/** Pestaña "Testimonios Elite" (2026-09-10) -- listado de solo lectura, la
 * carga sucede al registrar el evangelizado (ver useCrearEvangelizado). */
export function useTestimoniosEvangelismo(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['evangelismo', 'testimonios', casaDePazId],
    queryFn: () => obtenerTestimoniosEvangelismo(casaDePazId as string),
    enabled: !!casaDePazId,
  });
}

/** Testimonios Elite de toda la Red, agrupados por Casa de Paz en el
 * componente (EvangelismoRed.tsx) -- 2026-09-11. */
export function useTestimoniosEvangelismoRed(redId: string | undefined) {
  return useQuery({
    queryKey: ['evangelismo', 'testimonios-red', redId],
    queryFn: () => obtenerTestimoniosEvangelismoRed(redId as string),
    enabled: !!redId,
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

/** Lo que un Líder de Red sin Casa de Paz propia registró directo en su Red
 * (tabla `evangelismo_red`) -- ver EvangelismoRed.tsx. */
export function useEvangelismoRedDirecto(redId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['evangelismo', 'red-directo', redId, desde, hasta],
    queryFn: () => obtenerEvangelismoRedDirecto(redId as string, desde, hasta),
    enabled: !!redId,
    placeholderData: keepPreviousData,
  });
}

export function useCrearEvangelizadoRed(redId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevoEvangelizadoRed) => crearEvangelizadoRed(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelismo', 'red-directo', redId] });
    },
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
