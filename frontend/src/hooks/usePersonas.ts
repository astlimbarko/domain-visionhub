import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as personaService from '@/services/persona.service';
import type { DatosCensales, DatosIdentidad, NuevaPersona } from '@/types/persona.types';
import type { DatosDireccion } from '@/services/persona.service';

export function useBuscarPersonas(iglesiaId: string | undefined, texto: string, incluirOcultas: boolean) {
  return useQuery({
    queryKey: ['personas', 'buscar', iglesiaId, texto, incluirOcultas],
    queryFn: () => personaService.buscarPersonas(iglesiaId as string, texto, incluirOcultas),
    enabled: !!iglesiaId,
  });
}

export function usePersonaFicha(personaId: string | undefined) {
  return useQuery({
    queryKey: ['personas', 'ficha', personaId],
    queryFn: () => personaService.obtenerFicha(personaId as string),
    enabled: !!personaId,
  });
}

export function useTiposRelacion() {
  return useQuery({ queryKey: ['personas', 'tipos-relacion'], queryFn: personaService.obtenerTiposRelacion, staleTime: Infinity });
}

export function useTiposTelefono() {
  return useQuery({ queryKey: ['personas', 'tipos-telefono'], queryFn: personaService.obtenerTiposTelefono, staleTime: Infinity });
}

export function useMotivosLlegada() {
  return useQuery({ queryKey: ['personas', 'motivos-llegada'], queryFn: personaService.obtenerMotivosLlegada, staleTime: Infinity });
}

function useInvalidarBusqueda() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['personas', 'buscar'] });
}

function useInvalidarFicha(personaId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['personas', 'ficha', personaId] });
}

export function useCrearPersona() {
  const invalidarBusqueda = useInvalidarBusqueda();
  return useMutation({
    mutationFn: (datos: NuevaPersona) => personaService.crearPersona(datos),
    onSuccess: invalidarBusqueda,
  });
}

export function useActualizarIdentidad(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  const invalidarBusqueda = useInvalidarBusqueda();
  return useMutation({
    mutationFn: (datos: Partial<DatosIdentidad>) => personaService.actualizarIdentidad(personaId, datos),
    onSuccess: () => {
      invalidarFicha();
      invalidarBusqueda();
    },
  });
}

export function useGuardarDetalle(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: (datos: Partial<DatosCensales>) => personaService.guardarDetalle(personaId, datos),
    onSuccess: invalidarFicha,
  });
}

export function useToggleOculto(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  const invalidarBusqueda = useInvalidarBusqueda();
  return useMutation({
    mutationFn: (oculto: boolean) => personaService.toggleOculto(personaId, oculto),
    onSuccess: () => {
      invalidarFicha();
      invalidarBusqueda();
    },
  });
}

export function useAgregarDireccion(personaId: string, iglesiaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: ({ datos, esPrincipal }: { datos: DatosDireccion; esPrincipal: boolean }) =>
      personaService.agregarDireccion(iglesiaId, personaId, datos, esPrincipal),
    onSuccess: invalidarFicha,
  });
}

export function useActualizarDireccion(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: ({ direccionId, datos }: { direccionId: string; datos: DatosDireccion }) =>
      personaService.actualizarDireccion(direccionId, datos),
    onSuccess: invalidarFicha,
  });
}

export function useMarcarDireccionPrincipal(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: (asignacionId: string) => personaService.marcarDireccionPrincipal(personaId, asignacionId),
    onSuccess: invalidarFicha,
  });
}

export function useQuitarDireccion(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: (asignacionId: string) => personaService.quitarDireccion(asignacionId),
    onSuccess: invalidarFicha,
  });
}

export function useAgregarTelefono(personaId: string, iglesiaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: ({
      tipoTelefonoId,
      numero,
      observaciones,
      esPrincipal,
    }: {
      tipoTelefonoId: string;
      numero: string;
      observaciones: string | null;
      esPrincipal: boolean;
    }) => personaService.agregarTelefono(iglesiaId, personaId, tipoTelefonoId, numero, observaciones, esPrincipal),
    onSuccess: invalidarFicha,
  });
}

export function useMarcarTelefonoPrincipal(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: (asignacionId: string) => personaService.marcarTelefonoPrincipal(personaId, asignacionId),
    onSuccess: invalidarFicha,
  });
}

export function useQuitarTelefono(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: (asignacionId: string) => personaService.quitarTelefono(asignacionId),
    onSuccess: invalidarFicha,
  });
}

export function useAgregarLlegada(personaId: string, iglesiaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: ({
      motivoLlegadaId,
      fechaIngreso,
      invitadoPorId,
      invitadoPorTxt,
      comentarios,
    }: {
      motivoLlegadaId: string;
      fechaIngreso: string;
      invitadoPorId: string | null;
      invitadoPorTxt: string | null;
      comentarios: string | null;
    }) => personaService.agregarLlegada(iglesiaId, personaId, motivoLlegadaId, fechaIngreso, invitadoPorId, invitadoPorTxt, comentarios),
    onSuccess: invalidarFicha,
  });
}

export function useAgregarRelacionFamiliar(personaId: string, iglesiaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: ({ familiarId, tipoRelacionId }: { familiarId: string; tipoRelacionId: string }) =>
      personaService.agregarRelacionFamiliar(iglesiaId, personaId, familiarId, tipoRelacionId),
    onSuccess: invalidarFicha,
  });
}

export function useQuitarRelacionFamiliar(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: (familiaId: string) => personaService.quitarRelacionFamiliar(familiaId),
    onSuccess: invalidarFicha,
  });
}

export function useAgregarReferenciaFamiliar(personaId: string, iglesiaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: ({ nombreFamiliar, tipoRelacionId }: { nombreFamiliar: string; tipoRelacionId: string }) =>
      personaService.agregarReferenciaFamiliar(iglesiaId, personaId, nombreFamiliar, tipoRelacionId),
    onSuccess: invalidarFicha,
  });
}

export function useQuitarReferenciaFamiliar(personaId: string) {
  const invalidarFicha = useInvalidarFicha(personaId);
  return useMutation({
    mutationFn: (referenciaId: string) => personaService.quitarReferenciaFamiliar(referenciaId),
    onSuccess: invalidarFicha,
  });
}
