import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
  obtenerMisNotificaciones,
  obtenerNotificacionesNoLeidasCount,
} from '@/services/notificacion.service';

const QUERY_KEY = ['notificaciones'] as const;
const QUERY_KEY_COUNT = ['notificaciones', 'no-leidas-count'] as const;

export function useMisNotificaciones() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => obtenerMisNotificaciones(),
    // Sin campanita en tiempo real todavía (alcanza con polling) -- 30s es el
    // mismo intervalo que ya usan el resto de las queries del proyecto.
    refetchInterval: 30_000,
  });
}

export function useNotificacionesNoLeidasCount() {
  return useQuery({
    queryKey: QUERY_KEY_COUNT,
    queryFn: () => obtenerNotificacionesNoLeidasCount(),
    refetchInterval: 30_000,
  });
}

function useInvalidarNotificaciones() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: QUERY_KEY_COUNT });
  };
}

export function useMarcarNotificacionLeida() {
  const invalidar = useInvalidarNotificaciones();
  return useMutation({
    mutationFn: (id: string) => marcarNotificacionLeida(id),
    onSuccess: invalidar,
  });
}

export function useMarcarTodasLeidas() {
  const invalidar = useInvalidarNotificaciones();
  return useMutation({
    mutationFn: () => marcarTodasLeidas(),
    onSuccess: invalidar,
  });
}
