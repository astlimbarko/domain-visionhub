import { useQuery } from '@tanstack/react-query';
import { obtenerMiTitulo } from '@/services/auth.service';

export function useMiTitulo(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['auth', 'mi-titulo', iglesiaId],
    queryFn: () => obtenerMiTitulo(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}
