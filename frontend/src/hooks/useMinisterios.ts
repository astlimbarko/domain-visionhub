import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  agregarParticipante,
  crearMinisterio,
  hacerLiderMinisterio,
  obtenerMinisterios,
  obtenerParticipantes,
  quitarParticipante,
  toggleActivoMinisterio,
} from '@/services/ministerios.service';

export function useMinisterios(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['ministerios', 'lista', iglesiaId],
    queryFn: () => obtenerMinisterios(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useParticipantesMinisterio(ministerioId: string | undefined) {
  return useQuery({
    queryKey: ['ministerios', 'participantes', ministerioId],
    queryFn: () => obtenerParticipantes(ministerioId as string),
    enabled: !!ministerioId,
  });
}

function useInvalidarMinisterios() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['ministerios'] });
}

export function useCrearMinisterio(iglesiaId: string | undefined) {
  const invalidar = useInvalidarMinisterios();
  return useMutation({
    mutationFn: (nombre: string) => crearMinisterio(iglesiaId as string, nombre),
    onSuccess: invalidar,
  });
}

export function useToggleActivoMinisterio() {
  const invalidar = useInvalidarMinisterios();
  return useMutation({
    mutationFn: ({ ministerioId, activo }: { ministerioId: string; activo: boolean }) =>
      toggleActivoMinisterio(ministerioId, activo),
    onSuccess: invalidar,
  });
}

export function useAgregarParticipante(iglesiaId: string | undefined) {
  const invalidar = useInvalidarMinisterios();
  return useMutation({
    mutationFn: ({ ministerioId, personaId }: { ministerioId: string; personaId: string }) =>
      agregarParticipante(iglesiaId as string, ministerioId, personaId),
    onSuccess: invalidar,
  });
}

export function useQuitarParticipante() {
  const invalidar = useInvalidarMinisterios();
  return useMutation({ mutationFn: quitarParticipante, onSuccess: invalidar });
}

export function useHacerLiderMinisterio() {
  const invalidar = useInvalidarMinisterios();
  return useMutation({
    mutationFn: ({ participanteId, liderAnteriorId }: { participanteId: string; liderAnteriorId?: string }) =>
      hacerLiderMinisterio(participanteId, liderAnteriorId),
    onSuccess: invalidar,
  });
}
