import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completarMembresia,
  invitarLider,
  obtenerInvitacionesLider,
  obtenerMiInvitacionPendiente,
  reenviarInvitacionLider,
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
    }: {
      correo: string;
      rol: RolInvitable;
      redId: string | null;
      casaDePazId: string | null;
    }) => invitarLider(correo, rol, redId, casaDePazId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['estructura', 'invitaciones-lider'] }),
  });
}

export function useReenviarInvitacionLider() {
  return useMutation({ mutationFn: reenviarInvitacionLider });
}

export function useMiInvitacionPendiente() {
  return useQuery({ queryKey: ['auth', 'invitacion-pendiente'], queryFn: obtenerMiInvitacionPendiente });
}

export function useCompletarMembresia() {
  return useMutation({ mutationFn: completarMembresia });
}
