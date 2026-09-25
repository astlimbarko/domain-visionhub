import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarDetalleMegafiesta,
  actualizarReporte,
  anularReporte,
  autorizarEdicionReporteFueraVentana,
  crearReporte,
  crearReporteMegafiesta,
  crearReunionNoRealizada,
  corregirEstadoSsvaManual,
  eliminarBorradorReporte,
  existeReporteParaFecha,
  guardarBorradorReporte,
  obtenerBorradorReporte,
  obtenerCamposObligatorios,
  obtenerCdpContextoReporte,
  obtenerDesgloseMegafiesta,
  obtenerDetalleMegafiesta,
  obtenerDiasLimiteEdicionReporte,
  obtenerDiasPlazoReporte,
  obtenerEdadMinimaCreyente,
  obtenerFechasReportadas,
  obtenerHistorialAsistencia,
  obtenerHistorialReporte,
  obtenerMegafiestasRed,
  obtenerPrimeraFechaReunion,
  obtenerReportesParaCalendario,
  obtenerReunionesNoRealizadas,
  obtenerIdsLiderCdp,
  obtenerLibros,
  obtenerMiembrosCdp,
  obtenerReportePorId,
  obtenerReportesRecientes,
  obtenerReportesRedRango,
  obtenerTemas,
  obtenerTodosLosTemas,
  obtenerTestimoniosCdp,
  obtenerUltimaFechaReporteRed,
  puedeAnularReporte,
  puedeEditarReporte,
  puedeSolicitarEdicionFueraVentana,
} from '@/services/reporte.service';
import type { BorradorReportePayload, NuevoReporte, NuevoReporteMegafiesta } from '@/types/reporte.types';

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

/** KAN-367 (2026-09-17): todos los temas de los 13 libros, para el buscador de temas. */
export function useTodosLosTemas(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'todos-los-temas', iglesiaId],
    queryFn: () => obtenerTodosLosTemas(iglesiaId as string),
    enabled: !!iglesiaId,
    staleTime: 1000 * 60 * 60,
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

/** KAN-409: reporte reducido de Megafiesta -- mismas invalidaciones que useCrearReporte (asistencia/miembros/dashboard), más 'reporte'/'megafiestas-red' (consolidado del Líder de Red). */
export function useCrearReporteMegafiesta(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevoReporteMegafiesta) => crearReporteMegafiesta(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'recientes'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-fechas'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-calendario'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-asistencia', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'miembros', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'red-rango'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'megafiestas-red'] });
      queryClient.invalidateQueries({ queryKey: ['calendario'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** KAN-409: consolidados de Megafiesta de una Red -- vista "Megafiestas de Casa de Paz" del Líder de Red. */
export function useMegafiestasRed(redId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'megafiestas-red', redId],
    queryFn: () => obtenerMegafiestasRed(redId as string),
    enabled: !!redId,
  });
}

/** KAN-409: desglose por CdP de un consolidado -- se pide recién al expandir esa fila. */
export function useDesgloseMegafiesta(eventoId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['reporte', 'megafiesta-desglose', eventoId],
    queryFn: () => obtenerDesgloseMegafiesta(eventoId as string),
    enabled: habilitado && !!eventoId,
  });
}

/** KAN-409: datos generales (Tema/Finanzas/Testimonio) ya guardados de un consolidado. */
export function useDetalleMegafiesta(eventoId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['reporte', 'megafiesta-detalle', eventoId],
    queryFn: () => obtenerDetalleMegafiesta(eventoId as string),
    enabled: habilitado && !!eventoId,
  });
}

/** KAN-409: el Líder de Red completa/actualiza Tema, Finanzas y Testimonio desde el consolidado. */
export function useActualizarDetalleMegafiesta(eventoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: Parameters<typeof actualizarDetalleMegafiesta>[1]) => actualizarDetalleMegafiesta(eventoId as string, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'megafiesta-detalle', eventoId] });
    },
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

/** KAN-367: igual que useHistorialReportes, pero con reporte_id/fecha_creacion/total_mayores/total_ofrendas -- para el calendario clickeable con resumen. */
export function useReportesParaCalendario(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte', 'historial-calendario', casaDePazId, desde, hasta],
    queryFn: () => obtenerReportesParaCalendario(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
  });
}

/** KAN-367: primera fecha de reunión histórica de la CdP -- antes de eso, el calendario no puede marcar "no entregado" (todavía no existía). */
export function usePrimeraFechaReunion(casaDePazId: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'primera-fecha-reunion', casaDePazId],
    queryFn: () => obtenerPrimeraFechaReunion(casaDePazId as string),
    enabled: !!casaDePazId,
    staleTime: 1000 * 60 * 60,
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

/** KAN-392: mismo patrón de invalidación que useCrearReporte, pero sin las
 * queries de asistencia/miembros/finanzas -- una "reunión no realizada" no
 * las toca (no hay asistencia, no hay ingresos). */
export function useCrearReunionNoRealizada(casaDePazId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: { iglesia_id: string; casa_de_paz_id: string; fecha_reunion: string; motivo: string }) =>
      crearReunionNoRealizada(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'recientes'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-fechas'] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'historial-calendario', casaDePazId] });
      queryClient.invalidateQueries({ queryKey: ['reporte', 'reuniones-no-realizadas', casaDePazId] });
    },
  });
}

/** KAN-393: semanas "reunión no realizada" del rango visible del calendario. */
export function useReunionesNoRealizadas(casaDePazId: string | undefined, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte', 'reuniones-no-realizadas', casaDePazId, desde, hasta],
    queryFn: () => obtenerReunionesNoRealizadas(casaDePazId as string, desde, hasta),
    enabled: !!casaDePazId,
    placeholderData: keepPreviousData,
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

/** KAN-367: ventana propia (en horas) para ANULAR -- más corta que la de editar, se chequea aparte para no mostrar "Anular reporte" cuando ya no se puede. */
export function usePuedeAnularReporte(reporteId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['reporte', 'puede-anular', reporteId],
    queryFn: () => puedeAnularReporte(reporteId as string),
    enabled: habilitado && !!reporteId,
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

/** KAN-367 (2026-09-17): historial de cambios de un reporte -- solo Pastor/Supervisor, gateado server-side. */
export function useHistorialReporte(reporteId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['reporte', 'historial-cambios', reporteId],
    queryFn: () => obtenerHistorialReporte(reporteId as string),
    enabled: habilitado && !!reporteId,
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

/**
 * KAN-435 (autoguardado): borrador de un reporte todavía no enviado, para
 * esta CdP+fecha puntual. `fechaReunion` tiene que ser la fecha con la que
 * arrancó el formulario (no la que se va tipeando) -- la búsqueda es una
 * sola vez al montar, no en cada tecla.
 */
export function useBorradorReporte(casaDePazId: string | undefined, fechaReunion: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'borrador', casaDePazId, fechaReunion],
    queryFn: () => obtenerBorradorReporte(casaDePazId as string, fechaReunion as string),
    enabled: !!casaDePazId && !!fechaReunion,
    staleTime: Infinity,
  });
}

/** No invalida ninguna query -- un borrador no es un reporte real, no debe tocar calendario/dashboard/etc. */
export function useGuardarBorradorReporte() {
  return useMutation({
    mutationFn: ({
      borradorId,
      iglesiaId,
      casaDePazId,
      payload,
    }: {
      borradorId: string | null;
      iglesiaId: string;
      casaDePazId: string;
      payload: BorradorReportePayload;
    }) => guardarBorradorReporte(borradorId, iglesiaId, casaDePazId, payload),
  });
}

export function useEliminarBorradorReporte() {
  return useMutation({
    mutationFn: (borradorId: string) => eliminarBorradorReporte(borradorId),
  });
}

/** KAN-446: corrige a mano el estado SSVA de una persona (SIM/NC/CRE). Al
 * confirmar, invalida la query de `useMiembrosCdp` (mismo queryKey) para
 * que las 3 listas de Asistencia reflejen el cambio sin recargar la página. */
export function useCorregirEstadoSsvaManual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, estadoSigla, motivo }: { personaId: string; estadoSigla: string; motivo?: string }) =>
      corregirEstadoSsvaManual(personaId, estadoSigla, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reporte', 'miembros'] });
    },
  });
}

/** KAN-435: ¿ya se envió el reporte real de esta CdP+fecha? Se chequea antes de restaurar un borrador. */
export function useExisteReporteParaFecha(casaDePazId: string | undefined, fechaReunion: string | undefined) {
  return useQuery({
    queryKey: ['reporte', 'existe-fecha', casaDePazId, fechaReunion],
    queryFn: () => existeReporteParaFecha(casaDePazId as string, fechaReunion as string),
    enabled: !!casaDePazId && !!fechaReunion,
    staleTime: Infinity,
  });
}
