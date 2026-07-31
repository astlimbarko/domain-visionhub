import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearVisita, obtenerVisitasRed } from '@/services/visitas.service';
import type { NuevaVisita } from '@/types/visitas.types';

export function useVisitasRed(redId: string | undefined) {
  return useQuery({
    queryKey: ['visitas', 'red', redId],
    queryFn: () => obtenerVisitasRed(redId as string),
    enabled: !!redId,
  });
}

export function useCrearVisita(redId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevaVisita) => crearVisita(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas', 'red', redId] });
    },
  });
}
