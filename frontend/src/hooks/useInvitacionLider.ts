import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelarInvitacionLider,
  completarMembresia,
  corregirCorreoInvitacionLider,
  descartarCuentaHuerfana,
  invitarLider,
  listarCuentasHuerfanas,
  obtenerInvitacionesDepartamento,
  obtenerInvitacionesLider,
  obtenerMiInvitacionPendiente,
  reenviarInvitacionLider,
  type DatosPersonaAltaDirecta,
} from '@/services/invitacion-lider.service';
import type { RolInvitable } from '@/types/invitacion-lider.types';

export function useInvitacionesLider(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['estructura', 'invitaciones-lider', iglesiaId],
    queryFn: () => obtenerInvitacionesLider(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useInvitarLider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      correo,
      rol,
      redId,
      casaDePazId,
      departamentoId,
      pin,
      contrasena,
      datosPersona,
    }: {
      correo: string;
      rol: RolInvitable | 'SUPERVISOR_RED' | null;
      redId: string | null;
      casaDePazId: string | null;
      departamentoId?: string | null;
      pin?: string;
      contrasena?: string;
      datosPersona?: DatosPersonaAltaDirecta;
    }) => invitarLider(correo, rol, redId, casaDePazId, departamentoId ?? null, pin, contrasena, datosPersona),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estructura', 'invitaciones-lider'] });
      queryClient.invalidateQueries({ queryKey: ['estructura', 'invitaciones-departamento'] });
      // KAN-424: si esto reparó una cuenta huérfana, sale de ese listado.
      queryClient.invalidateQueries({ queryKey: ['admin', 'cuentas-huerfanas'] });
    },
  });
}

export function useInvitacionesDepartamento(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['estructura', 'invitaciones-departamento', iglesiaId],
    queryFn: () => obtenerInvitacionesDepartamento(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useReenviarInvitacionLider() {
  return useMutation({ mutationFn: reenviarInvitacionLider });
}

export function useCancelarInvitacionLider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelarInvitacionLider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estructura', 'invitaciones-lider'] });
    },
  });
}

export function useCorregirCorreoInvitacionLider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invitacionId, correoNuevo, pin }: { invitacionId: string; correoNuevo: string; pin?: string }) =>
      corregirCorreoInvitacionLider(invitacionId, correoNuevo, pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estructura', 'invitaciones-lider'] });
    },
  });
}

export function useMiInvitacionPendiente() {
  return useQuery({ queryKey: ['auth', 'invitacion-pendiente'], queryFn: obtenerMiInvitacionPendiente });
}

export function useCompletarMembresia() {
  return useMutation({ mutationFn: completarMembresia });
}

/** KAN-424: panel de Super Admin de cuentas huérfanas. */
export function useCuentasHuerfanas() {
  return useQuery({ queryKey: ['admin', 'cuentas-huerfanas'], queryFn: listarCuentasHuerfanas });
}

export function useDescartarCuentaHuerfana() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, pinDescarte }: { usuarioId: string; pinDescarte?: string }) =>
      descartarCuentaHuerfana(usuarioId, pinDescarte),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cuentas-huerfanas'] }),
  });
}
