import { useMutation, useQuery } from '@tanstack/react-query';
import { registrarPersonaViaUrl, resolverUrlRegistro } from '@/services/registro-publico.service';
import type { DatosRegistroPublico } from '@/types/registro-publico.types';

export function useResolverUrlRegistro(slug: string | undefined) {
  return useQuery({
    queryKey: ['registro-publico', 'resolver', slug],
    queryFn: () => resolverUrlRegistro(slug as string),
    enabled: !!slug,
    retry: 1,
    staleTime: 0,
  });
}

export function useRegistrarPersonaViaUrl(slug: string | undefined) {
  return useMutation({
    mutationFn: (datos: DatosRegistroPublico) => registrarPersonaViaUrl(slug as string, datos),
  });
}
