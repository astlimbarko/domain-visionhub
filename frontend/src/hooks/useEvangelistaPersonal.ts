import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import {
  crearCredencialEvangelista,
  esEvangelista,
  obtenerDashboardEvangelista,
  obtenerDatosPersonaCredencial,
  obtenerHistorialEvangelista,
  obtenerHistorialSeguimiento,
  obtenerTiposEvangelismoPersonal,
  otorgarEvangelista,
  puedeOtorgarEvangelista,
  registrarPersonaEvangelizada,
  registrarSeguimiento,
  revocarEvangelista,
} from '@/services/evangelista-personal.service';
import type { MedioSeguimiento, NuevaPersonaEvangelistaPayload } from '@/types/evangelista-personal.types';

/** Capacidad ortogonal al RolUI (igual concepto que useEsLiderEvangelismo/
 * useEsLiderAfirmacion), pero resuelta con un RPC propio en vez de un flag
 * en `IglesiaAccesible` -- a propósito: esta épica es nueva, y agregar un
 * campo a la sesión tocaría `fn_mis_iglesias_accesibles` (RPC central de
 * login que usan TODOS los roles). Se prefiere esta llamada propia, aislada,
 * mientras el rol recién se está probando -- se puede migrar al patrón de
 * sesión más adelante si hace falta ahorrar el viaje de red. */
export function useEsEvangelista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  return useQuery({
    queryKey: ['evangelista-personal', 'soy-evangelista', iglesiaActivaId],
    queryFn: () => esEvangelista(iglesiaActivaId as string),
    enabled: !!iglesiaActivaId,
    staleTime: 1000 * 60,
  });
}

export function usePuedeOtorgarEvangelista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  return useQuery({
    queryKey: ['evangelista-personal', 'puedo-otorgar', iglesiaActivaId],
    queryFn: () => puedeOtorgarEvangelista(iglesiaActivaId as string),
    enabled: !!iglesiaActivaId,
    staleTime: 1000 * 60,
  });
}

export function useOtorgarEvangelista() {
  const queryClient = useQueryClient();
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  return useMutation({
    mutationFn: (personaId: string) => otorgarEvangelista(personaId, iglesiaActivaId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelista-personal'] });
    },
  });
}

export function useRevocarEvangelista() {
  const queryClient = useQueryClient();
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  return useMutation({
    mutationFn: (personaId: string) => revocarEvangelista(personaId, iglesiaActivaId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelista-personal'] });
    },
  });
}

export function useDatosPersonaCredencial(personaId: string | undefined) {
  return useQuery({
    queryKey: ['evangelista-personal', 'datos-persona', personaId],
    queryFn: () => obtenerDatosPersonaCredencial(personaId as string),
    enabled: !!personaId,
  });
}

export function useCrearCredencialEvangelista() {
  const queryClient = useQueryClient();
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  return useMutation({
    mutationFn: (datos: { personaId: string; correo?: string; actualizarCorreoMembresia?: boolean }) =>
      crearCredencialEvangelista(datos.personaId, iglesiaActivaId as string, datos.correo, datos.actualizarCorreoMembresia),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelista-personal'] });
    },
  });
}

export function useTiposEvangelismoPersonal() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  return useQuery({
    queryKey: ['evangelista-personal', 'tipos', iglesiaActivaId],
    queryFn: () => obtenerTiposEvangelismoPersonal(iglesiaActivaId as string),
    enabled: !!iglesiaActivaId,
    staleTime: 1000 * 60 * 60,
  });
}

export function useRegistrarPersonaEvangelizada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NuevaPersonaEvangelistaPayload) => registrarPersonaEvangelizada(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelista-personal', 'historial'] });
      queryClient.invalidateQueries({ queryKey: ['evangelista-personal', 'dashboard'] });
    },
  });
}

export function useHistorialEvangelista(desde?: string, hasta?: string) {
  return useQuery({
    queryKey: ['evangelista-personal', 'historial', desde, hasta],
    queryFn: () => obtenerHistorialEvangelista(desde, hasta),
    placeholderData: keepPreviousData,
  });
}

export function useDashboardEvangelista(anio: number, mes: number) {
  return useQuery({
    queryKey: ['evangelista-personal', 'dashboard', anio, mes],
    queryFn: () => obtenerDashboardEvangelista(anio, mes),
    placeholderData: keepPreviousData,
  });
}

export function useRegistrarSeguimiento(evangelismoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: { medio: MedioSeguimiento; notas: string }) => registrarSeguimiento(evangelismoId, datos.medio, datos.notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evangelista-personal', 'seguimiento', evangelismoId] });
      queryClient.invalidateQueries({ queryKey: ['evangelista-personal', 'historial'] });
      queryClient.invalidateQueries({ queryKey: ['evangelista-personal', 'dashboard'] });
    },
  });
}

export function useHistorialSeguimiento(evangelismoId: string | undefined) {
  return useQuery({
    queryKey: ['evangelista-personal', 'seguimiento', evangelismoId],
    queryFn: () => obtenerHistorialSeguimiento(evangelismoId as string),
    enabled: !!evangelismoId,
  });
}
