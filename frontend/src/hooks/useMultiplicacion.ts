import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listarMultiplicacionesCdp,
  listarMultiplicacionesRed,
  multiplicarCdp,
  multiplicarRed,
} from '@/services/multiplicacion.service';

export function useMultiplicacionesCdp(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['multiplicaciones', 'cdp', iglesiaId],
    queryFn: () => listarMultiplicacionesCdp(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useMultiplicacionesRed(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['multiplicaciones', 'red', iglesiaId],
    queryFn: () => listarMultiplicacionesRed(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

function useInvalidarMultiplicaciones() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['multiplicaciones'] });
    queryClient.invalidateQueries({ queryKey: ['estructura'] });
    queryClient.invalidateQueries({ queryKey: ['reporte', 'miembros'] });
  };
}

export function useMultiplicarCdp() {
  const invalidar = useInvalidarMultiplicaciones();
  return useMutation({ mutationFn: multiplicarCdp, onSuccess: invalidar });
}

export function useMultiplicarRed() {
  const invalidar = useInvalidarMultiplicaciones();
  return useMutation({ mutationFn: multiplicarRed, onSuccess: invalidar });
}
