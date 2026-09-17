import { useQuery } from '@tanstack/react-query';
import { obtenerAvancesVisibles } from '@/services/avance.service';

export function useAvancesVisibles() {
  return useQuery({
    queryKey: ['avances', 'visibles'],
    queryFn: obtenerAvancesVisibles,
  });
}
