import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarReunionCdp,
  asignarCargoCdp,
  asignarCargoRed,
  buscarPersonas,
  crearCdp,
  crearRed,
  eliminarCdp,
  guardarDomicilioCdp,
  obtenerCargoVigenteCdp,
  obtenerCargoVigenteRed,
  obtenerCargos,
  obtenerCdpPerfil,
  obtenerCdps,
  obtenerCiudades,
  obtenerDomicilioCdp,
  obtenerRedes,
  quitarCargoCdp,
  quitarCargoRed,
  toggleActivoCdp,
  toggleActivoRed,
} from '@/services/casas-de-paz.service';
import type { CargoCdpCodigo, CargoRedCodigo, DatosDomicilioCdp, DatosNuevaCdp } from '@/types/casas-de-paz.types';

export function useCargos() {
  return useQuery({ queryKey: ['estructura', 'cargos'], queryFn: obtenerCargos, staleTime: 1000 * 60 * 60 });
}

export function useRedes(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['estructura', 'redes', iglesiaId],
    queryFn: () => obtenerRedes(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useCdps(iglesiaId: string | undefined, redId: string | undefined) {
  return useQuery({
    queryKey: ['estructura', 'cdps', iglesiaId, redId],
    queryFn: () => obtenerCdps(iglesiaId as string, redId),
    enabled: !!iglesiaId && !!redId,
  });
}

/** Todas las Casas de Paz de la iglesia, de cualquier Red -- `fn_listar_cdp` ya
 * soporta `p_red_id` nulo para esto (no filtra), pero `useCdps` de arriba exige
 * un redId a propósito (varios llamadores lo usan para no disparar la consulta
 * hasta que se elija una Red puntual) -- este hook aparte no tiene esa traba. */
export function useCdpsIglesia(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['estructura', 'cdps', iglesiaId, undefined],
    queryFn: () => obtenerCdps(iglesiaId as string, undefined),
    enabled: !!iglesiaId,
  });
}

export function useBuscarPersonas(iglesiaId: string | undefined, texto: string, edadMinima?: number) {
  return useQuery({
    queryKey: ['estructura', 'buscar-personas', iglesiaId, texto, edadMinima],
    queryFn: () => buscarPersonas(iglesiaId as string, texto, edadMinima),
    enabled: !!iglesiaId && texto.trim().length >= 2,
  });
}

export function useCargoVigenteRed(redId: string | undefined, codigo: CargoRedCodigo) {
  return useQuery({
    queryKey: ['estructura', 'cargo-red', redId, codigo],
    queryFn: () => obtenerCargoVigenteRed(redId as string, codigo),
    enabled: !!redId,
  });
}

export function useCargoVigenteCdp(cdpId: string | undefined, codigo: CargoCdpCodigo) {
  return useQuery({
    queryKey: ['estructura', 'cargo-cdp', cdpId, codigo],
    queryFn: () => obtenerCargoVigenteCdp(cdpId as string, codigo),
    enabled: !!cdpId,
  });
}

function useInvalidarEstructura() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['estructura'] });
}

export function useCrearRed(iglesiaId: string | undefined) {
  const invalidar = useInvalidarEstructura();
  return useMutation({
    mutationFn: (nombre: string) => crearRed(iglesiaId as string, nombre),
    onSuccess: invalidar,
  });
}

export function useToggleActivoRed() {
  const invalidar = useInvalidarEstructura();
  return useMutation({
    mutationFn: ({ redId, activo }: { redId: string; activo: boolean }) => toggleActivoRed(redId, activo),
    onSuccess: invalidar,
  });
}

export function useCrearCdp(iglesiaId: string | undefined) {
  const invalidar = useInvalidarEstructura();
  return useMutation({
    mutationFn: ({ redId, datos }: { redId: string; datos: DatosNuevaCdp }) => crearCdp(iglesiaId as string, redId, datos),
    onSuccess: invalidar,
  });
}

export function useToggleActivoCdp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cdpId, activo }: { cdpId: string; activo: boolean }) => toggleActivoCdp(cdpId, activo),
    // Activar/desactivar una CdP cambia qué se ve en el Dashboard de la Red y en
    // Control de Reportes (ambos excluyen las inactivas): sin invalidar esas
    // queries, la CdP recién desactivada seguía apareciendo hasta el próximo
    // refetch natural.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estructura'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reporte'] });
    },
  });
}

export function useEliminarCdp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cdpId: string) => eliminarCdp(cdpId),
    // Igual que useToggleActivoCdp: una CdP eliminada deja de aparecer en
    // Dashboard y Control de Reportes, así que hay que invalidar también esas.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estructura'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reporte'] });
    },
  });
}

export function useAsignarCargoRed(iglesiaId: string | undefined) {
  const invalidar = useInvalidarEstructura();
  return useMutation({
    mutationFn: ({
      redId,
      personaId,
      codigo,
      cargoId,
    }: {
      redId: string;
      personaId: string;
      codigo: CargoRedCodigo;
      cargoId: string;
    }) => asignarCargoRed(iglesiaId as string, redId, personaId, codigo, cargoId),
    onSuccess: invalidar,
  });
}

export function useAsignarCargoCdp(iglesiaId: string | undefined) {
  const invalidar = useInvalidarEstructura();
  return useMutation({
    mutationFn: ({
      cdpId,
      personaId,
      codigo,
      cargoId,
    }: {
      cdpId: string;
      personaId: string;
      codigo: CargoCdpCodigo;
      cargoId: string;
    }) => asignarCargoCdp(iglesiaId as string, cdpId, personaId, codigo, cargoId),
    onSuccess: invalidar,
  });
}

export function useQuitarCargoRed() {
  const invalidar = useInvalidarEstructura();
  return useMutation({ mutationFn: quitarCargoRed, onSuccess: invalidar });
}

export function useQuitarCargoCdp() {
  const invalidar = useInvalidarEstructura();
  return useMutation({ mutationFn: quitarCargoCdp, onSuccess: invalidar });
}

export function useCiudades() {
  return useQuery({ queryKey: ['estructura', 'ciudades'], queryFn: obtenerCiudades, staleTime: 1000 * 60 * 60 });
}

export function useDomicilioCdp(cdpId: string | undefined) {
  return useQuery({
    queryKey: ['estructura', 'domicilio-cdp', cdpId],
    queryFn: () => obtenerDomicilioCdp(cdpId as string),
    enabled: !!cdpId,
  });
}

export function useGuardarDomicilioCdp(iglesiaId: string | undefined) {
  const invalidar = useInvalidarEstructura();
  return useMutation({
    mutationFn: ({ cdpId, datos }: { cdpId: string; datos: DatosDomicilioCdp }) =>
      guardarDomicilioCdp(iglesiaId as string, cdpId, datos),
    onSuccess: invalidar,
  });
}

export function useCdpPerfil(cdpId: string | undefined) {
  return useQuery({
    queryKey: ['estructura', 'cdp-perfil', cdpId],
    queryFn: () => obtenerCdpPerfil(cdpId as string),
    enabled: !!cdpId,
  });
}

export function useActualizarReunionCdp() {
  const invalidar = useInvalidarEstructura();
  return useMutation({
    mutationFn: ({ cdpId, diaReunion, horaReunion }: { cdpId: string; diaReunion: number | null; horaReunion: string | null }) =>
      actualizarReunionCdp(cdpId, diaReunion, horaReunion),
    onSuccess: invalidar,
  });
}
