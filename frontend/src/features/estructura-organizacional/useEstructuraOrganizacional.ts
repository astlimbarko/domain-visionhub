import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarRedEstructura,
  asignarCargoRedEstructura,
  asignarPastorEstructura,
  asignarSupervisorEstructura,
  buscarPersonasEstructura,
  configurarOtpEstructura,
  crearCasaDePazEstructura,
  crearRedEstructura,
  eliminarRedEstructura,
  guardarPosicionesEstructura,
  obtenerEstructuraOrganizacional,
  quitarCargoRedEstructura,
  reactivarRedEstructura,
} from './estructura.service';
import type { CargoRedEstructura, CrearRedEstructuraEntrada, PosicionNodoGuardar } from './types';

export function useEstructuraOrganizacional(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['estructura-organizacional', iglesiaId],
    queryFn: () => obtenerEstructuraOrganizacional(iglesiaId as string),
    enabled: Boolean(iglesiaId),
    staleTime: 30_000,
  });
}

function useInvalidarEstructuraOrganizacional(iglesiaId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['estructura-organizacional', iglesiaId] });
    void queryClient.invalidateQueries({ queryKey: ['estructura'] });
  };
}

export function useGuardarPosicionesEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ nodos, version }: { nodos: PosicionNodoGuardar[]; version: number }) =>
      guardarPosicionesEstructura(iglesiaId, nodos, version),
    onSuccess: invalidar,
  });
}

export function useCrearRedEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: (entrada: Omit<CrearRedEstructuraEntrada, 'iglesiaId'>) =>
      crearRedEstructura({ ...entrada, iglesiaId }),
    onSuccess: invalidar,
  });
}

export function useActualizarRedEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ redId, nombre, color, otp }: { redId: string; nombre: string; color: string; otp?: string | null }) =>
      actualizarRedEstructura(redId, nombre, color, otp),
    onSuccess: invalidar,
  });
}

export function useEliminarRedEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ redId, otp }: { redId: string; otp?: string | null }) => eliminarRedEstructura(redId, otp),
    onSuccess: invalidar,
  });
}

export function useReactivarRedEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ redId, otp }: { redId: string; otp?: string | null }) => reactivarRedEstructura(redId, otp),
    onSuccess: invalidar,
  });
}

export function useAsignarCargoRedEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({
      redId,
      personaId,
      codigo,
      otp,
    }: {
      redId: string;
      personaId: string;
      codigo: CargoRedEstructura;
      otp?: string | null;
    }) => asignarCargoRedEstructura(redId, personaId, codigo, otp),
    onSuccess: invalidar,
  });
}

export function useQuitarCargoRedEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ redId, codigo, otp }: { redId: string; codigo: CargoRedEstructura; otp?: string | null }) =>
      quitarCargoRedEstructura(redId, codigo, otp),
    onSuccess: invalidar,
  });
}

export function useCrearCasaDePazEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ redId, liderPersonaId, otp }: { redId: string; liderPersonaId?: string | null; otp?: string | null }) =>
      crearCasaDePazEstructura(redId, liderPersonaId, otp),
    onSuccess: invalidar,
  });
}

export function useAsignarPastorEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ personaId, otp }: { personaId: string; otp?: string | null }) =>
      asignarPastorEstructura(iglesiaId, personaId, otp),
    onSuccess: invalidar,
  });
}

export function useAsignarSupervisorEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ personaId, otp }: { personaId: string; otp?: string | null }) =>
      asignarSupervisorEstructura(iglesiaId, personaId, otp),
    onSuccess: invalidar,
  });
}

export function useConfigurarOtpEstructura(iglesiaId: string) {
  const invalidar = useInvalidarEstructuraOrganizacional(iglesiaId);
  return useMutation({
    mutationFn: ({ requerido, otp }: { requerido: boolean; otp?: string | null }) =>
      configurarOtpEstructura(iglesiaId, requerido, otp),
    onSuccess: invalidar,
  });
}

export function useBuscarPersonasEstructura(iglesiaId: string, texto: string) {
  return useQuery({
    queryKey: ['estructura-organizacional', iglesiaId, 'buscar-personas', texto],
    queryFn: () => buscarPersonasEstructura(iglesiaId, texto),
    enabled: texto.trim().length >= 2,
    staleTime: 30_000,
  });
}
