import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarReporte,
  anularReporte,
  autorizarEdicionReporteFueraVentana,
  crearReporte,
  obtenerCamposObligatorios,
  obtenerCdpContextoReporte,
  obtenerDiasLimiteEdicionReporte,
  obtenerDiasPlazoReporte,
  obtenerEdadMinimaCreyente,
  obtenerFechasReportadas,
  obtenerHistorialAsistencia,
  obtenerReportesParaCalendario,
  obtenerIdsLiderCdp,
  obtenerLibros,
  obtenerMegaFiestaDelDia,
  obtenerMiembrosCdp,
  obtenerReportePorId,
  obtenerReportesRecientes,
  obtenerReportesRedRango,
  obtenerTemas,
  obtenerTestimoniosCdp,
  obtenerUltimaFechaReporteRed,
  puedeEditarReporte,
  puedeSolicitarEdicionFueraVentana,
} from '@/services/reporte.service';
import type { NuevoReporte } from '@/types/reporte.types';

export function useLibros() {
  return useQuery({ queryKey: ['reporte', 'libros'], queryFn: obtenerLibros, staleTime: 1000 * 60 * 60 });
}

export function useTemas(libroId: string | undefined, iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'temas', libroId, iglesiaId],
    queryFn: () => obtenerTemas(libroId as string, iglesiaId as string),
    enabled: !!libroId && !!iglesiaId,
  });
}

export function useMiembrosCdp(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'miembros', casaDePazId],
    queryFn: () => obtenerMiembrosCdp(casaDePazId as string),
    enabled: !!casaDePazId,
    // Cambiar de Casa de Paz en el selector no debe vaciar las listas de asistencia.
    placeholderData: keepPreviousData,
  });
}

/** Persona(s) con cargo LIDER_CDP vigente -- para filtrar al Líder de la
 * lista de asistencia (Reportes.tsx), sin tocar useMiembrosCdp (compartida
 * con MultiplicarCdpDialog.tsx, donde el Líder sí debe poder elegirse). */
export function useIdsLiderCdp(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'ids-lider-cdp', casaDePazId],
    queryFn: () => obtenerIdsLiderCdp(casaDePazId as string),
    enabled: !!casaDePazId,
  });
}


export function useCamposObligatoriosReporte(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'campos-obligatorios', iglesiaId],
    queryFn: () => obtenerCamposObligatorios(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 10,
  });
}

/** Umbral configurable de edad (niño vs. regular) — ver obtenerEdadMinimaCreyente. */
export function useEdadMinimaCreyente(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'edad-minima-creyente', iglesiaId],
    queryFn: () => obtenerEdadMinimaCreyente(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 60,
  });
}

/** Plazo de gracia configurable (días) para Control de Reportes -- ver obtenerDiasPlazoReporte. */
export function useDiasPlazoReporte(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'dias-plazo-reporte', iglesiaId],
    queryFn: () => obtenerDiasPlazoReporte(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 60,
  });
}

/**
 * KAN-375/367: ventana de edición de reportes configurable (mismo patrón
 * que useDiasPlazoReporte). Desde KAN-367 hay 2 ventanas separadas -- pasar
 * 'DIAS_LIMITE_EDICION_REPORTE_CDP' en la vista de Líder/Sublíder de CdP y
 * 'DIAS_LIMITE_EDICION_REPORTE_RED' en la de Red/Supervisor/Pastor.
 */
export function useDiasLimiteEdicionReporte(
  iglesiaId: string | undefined,
  codigo: 'DIAS_LIMITE_EDICION_REPORTE_CDP' | 'DIAS_LIMITE_EDICION_REPORTE_RED'
) {
  return useQuery({
    queryKey: ['reporte', 'dias-limite-edicion', codigo, iglesiaId],
    queryFn: () => obtenerDiasLimiteEdicionReporte(iglesiaId as string, codigo),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 60,
  });
}

export function useMegaFiestaDelDia(casaDePazId: string | undefined, fecha: string) {
  return useQuery({
    queryKey: ['reporte', 'megafiesta', casaDePazId, fecha],
    queryFn: () => obtenerMegaFiestaDelDia(casaDePazId as string, fecha),
    enabled: !!casaDePazId && !!fecha,
  });
}

export function useReportesRecientes(casaDePazIds: string[]) {
  return useQuery({
    queryKey: ['reporte', 'recientes', casaDePazIds],
    queryFn: () => obtenerReportesRecientes(casaDePazIds),
    enabled: casaDePazIds.length > 0,
  });
}

/** Testimonios ya guardados en los reportes semanales de una CdP -- card "Testimonio" del dashboard del Líder de CdP. */
export function useTestimoniosCdp(casaDePazId: string | undefined, desde?: string, hasta?: string) {
  return useQuery({
    queryKey: ['reporte', 'testimonios', casaDePazId, desde, hasta],
    queryFn: () => obtenerTestimoniosCdp(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
  });
}

/** Reportes de todas las Casas de Paz de la Red en un rango — vista supervisora del Líder de Red. */
export function useReportesRedRango(casaDePazIds: string[], desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte', 'red-rango', [...casaDePazIds].sort(), desde, hasta],
    queryFn: () => obtenerReportesRedRango(casaDePazIds, desde, hasta),
    enabled: casaDePazIds.length > 0,
    placeholderData: keepPreviousData,
  });
}

/** Última fecha con reporte de las CdP de la Red -- para abrir Control de Reportes en el mes con datos. */
export function useUltimaFechaReporteRed(casaDePazIds: string[]) {
  return useQuery({
    queryKey: ['reporte', 'ultima-fecha-red', [...casaDePazIds].sort()],
    queryFn: () => obtenerUltimaFechaReporteRed(casaDePazIds),
    enabled: casaDePazIds.length > 0,
  });
}

export function useHistorialReportes(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte', 'historial-fechas', casaDePazId, desde, hasta],
    queryFn: () => obtenerFechasReportadas(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
  });
}

/** KAN-367: igual que useHistorialReportes, pero con reporte_id/fecha_creacion -- para el calendario clickeable. */
export function useReportesParaCalendario(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte', 'historial-calendario', casaDePazId, desde, hasta],
    queryFn: () => obtenerReportesParaCalendario(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
  });
}

export function useHistorialAsistencia(
  casaDePazId: string | undefined,
  anio: number,
  mes: number,
  diaReunion: number | null | undefined
) {
  return useQuery({
    queryKey: ['reporte', 'historial-asistencia', casaDePazId, anio, mes, diaReunion],
    queryFn: () => obtenerHistorialAsistencia(casaDePazId as string, anio, mes, diaReunion as number | null),
    enabled: !!casaDePazId && diaReunion !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useCrearReporte(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevoReporte) => crearReporte(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'recientes'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-fechas'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-asistencia', casaDePazId] });
      // fn_recalcular_estados_cdp_reporte (llamada dentro de crearReporte) puede
      // haber promovido a alguien a Nuevo Convertido/Creyente -- sin esto, el
      // pool de "Asistencia regular" queda con datos viejos hasta un refetch
      // natural (2026-09-07, bug real: era la única invalidación de esta query
      // y se perdió al sacar el diálogo manual de miembro regular).
      queryClient.invalidateQueries({ queryKey: ['reporte', 'miembros', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['calendario'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas'] });
      // El reporte cambia asistencia/miembros/ingresos que el Dashboard ya muestra:
      // sin esto, el Dashboard queda con datos viejos hasta el próximo refetch natural.
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** KAN-271: precarga de un reporte ya enviado, para el formulario en modo edición. */
export function useReportePorId(reporteId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'por-id', reporteId],
    queryFn: () => obtenerReportePorId(reporteId as string),
    enabled: !!reporteId,
  });
}

/** KAN-271: si el reporte todavía está dentro de la ventana de 7 días para ese rol. */
export function usePuedeEditarReporte(reporteId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'puede-editar', reporteId],
    queryFn: () => puedeEditarReporte(reporteId as string),
    enabled: !!reporteId,
  });
}

/** KAN-367: Líder/Anfitrión/Dirección/Ciudad de la CdP -- panel de modificación cuando se edita un reporte ajeno. */
export function useCdpContextoReporte(casaDePazId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['reporte', 'cdp-contexto', casaDePazId],
    queryFn: () => obtenerCdpContextoReporte(casaDePazId as string),
    enabled: habilitado && !!casaDePazId,
    staleTime: 1000 * 60 * 5,
  });
}

/** KAN-367: si a este usuario (Pastor/Supervisor) se le puede ofrecer pedir autorización fuera de ventana -- solo cuando ya se sabe que puedeEditar dio false. */
export function usePuedeSolicitarEdicionFueraVentana(reporteId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['reporte', 'puede-solicitar-fuera-ventana', reporteId],
    queryFn: () => puedeSolicitarEdicionFueraVentana(reporteId as string),
    enabled: habilitado && !!reporteId,
  });
}

/** KAN-367: autorizar (justificación + OTP) editar un reporte fuera de la ventana normal. */
export function useAutorizarEdicionReporteFueraVentana(reporteId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: { justificacion: string; pin: string }) =>
      autorizarEdicionReporteFueraVentana(reporteId as string, datos.justificacion, datos.pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'puede-editar', reporteId] });
    },
  });
}

/** Anular (baja lógica) un reporte -- p. ej. un duplicado. Mismas invalidaciones que editar (deja de aparecer en Control de Reportes, Historial, Dashboard, etc.). */
export function useAnularReporte(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reporteId: string) => anularReporte(reporteId),
    onSuccess: (_resultado, reporteId) => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'recientes'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-fechas'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-asistencia', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'red-rango'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'ultima-fecha-red'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'por-id', reporteId] });
      queryClient.invalidateQueries({ queryKey: ['calendario'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** KAN-271: editar un reporte ya enviado -- mismas invalidaciones que crear, más 'reporte'/'red-rango' (Control de Reportes) y 'por-id' del propio reporte. */
export function useActualizarReporte(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reporteId, datos }: { reporteId: string; datos: NuevoReporte }) => actualizarReporte(reporteId, datos),
    onSuccess: (_resultado, { reporteId }) => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'recientes'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-fechas'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-asistencia', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'red-rango'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'por-id', reporteId] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'miembros', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['calendario'] });
      queryClient.invalidateQueries({ queryKey: ['finanzas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
