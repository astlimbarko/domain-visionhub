import { useQuery } from '@tanstack/react-query';
import { obtenerEstructuraOrganizacional } from './estructura.service';

export function useEstructuraOrganizacional(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['estructura-organizacional', iglesiaId],
    queryFn: () => obtenerEstructuraOrganizacional(iglesiaId as string),
    enabled: Boolean(iglesiaId),
    staleTime: 30_000,
  });
}
