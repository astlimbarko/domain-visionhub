import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completarMembresia,
  invitarLider,
  obtenerInvitacionesDepartamento,
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
      departamentoId,
    }: {
      correo: string;
      rol: RolInvitable | null;
      redId: string | null;
      casaDePazId: string | null;
      departamentoId?: string | null;
    }) => invitarLider(correo, rol, redId, casaDePazId, departamentoId ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estructura', 'invitaciones-lider'] });
      queryClient.invalidateQueries({ queryKey: ['estructura', 'invitaciones-departamento'] });
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

export function useMiInvitacionPendiente() {
  return useQuery({ queryKey: ['auth', 'invitacion-pendiente'], queryFn: obtenerMiInvitacionPendiente });
}

export function useCompletarMembresia() {
  return useMutation({ mutationFn: completarMembresia });
}
