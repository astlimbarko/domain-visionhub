import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  asignarLiderRedSupervisor,
  crearRedSupervisor,
  desactivarRedSupervisor,
  quitarLiderRedSupervisor,
} from '@/services/gestion-redes.service';

function useInvalidarRedes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['estructura', 'redes'] });
}

export function useCrearRedSupervisor(iglesiaId: string | undefined) {
  const invalidar = useInvalidarRedes();
  return useMutation({
    mutationFn: ({
      nombre,
      liderPersonaId,
      liderCorreoNuevo,
      pin,
    }: {
      nombre: string;
      liderPersonaId: string | null;
      liderCorreoNuevo: string | null;
      pin?: string;
    }) => crearRedSupervisor(iglesiaId as string, nombre, liderPersonaId, liderCorreoNuevo, pin),
    onSuccess: invalidar,
  });
}

export function useDesactivarRedSupervisor() {
  const invalidar = useInvalidarRedes();
  return useMutation({
    mutationFn: ({ redId, pin }: { redId: string; pin?: string }) => desactivarRedSupervisor(redId, pin),
    onSuccess: invalidar,
  });
}

export function useAsignarLiderRedSupervisor() {
  const invalidar = useInvalidarRedes();
  return useMutation({
    mutationFn: ({ redId, personaId, pin }: { redId: string; personaId: string; pin?: string }) =>
      asignarLiderRedSupervisor(redId, personaId, pin),
    onSuccess: invalidar,
  });
}

export function useQuitarLiderRedSupervisor() {
  const invalidar = useInvalidarRedes();
  return useMutation({
    mutationFn: ({ id, pin }: { id: string; pin?: string }) => quitarLiderRedSupervisor(id, pin),
    onSuccess: invalidar,
  });
}
