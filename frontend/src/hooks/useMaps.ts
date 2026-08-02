import { useQuery } from '@tanstack/react-query';
import { resolverUbicacionMaps } from '@/services/maps.service';
import { embedDesdeCoordenadas, esLinkMapsCorto } from '@/utils/google-maps';

/**
 * Resuelve un short link de Google Maps (maps.app.goo.gl) a coordenadas vía
 * Edge Function y arma la URL de embed. Solo se activa para links cortos --
 * un link completo ya se resuelve en el momento con urlEmbedMapa, sin red.
 * La ubicación de una CdP no cambia seguido, así que el resultado se cachea
 * por el resto de la sesión (staleTime Infinity).
 */
export function useEmbedMapaResuelto(urlGps: string | null | undefined) {
  const activarResolucion = !!urlGps && esLinkMapsCorto(urlGps);
  const query = useQuery({
    queryKey: ['maps', 'resolver', urlGps],
    queryFn: () => resolverUbicacionMaps(urlGps as string),
    enabled: activarResolucion,
    staleTime: Infinity,
    retry: false,
  });

  return {
    ...query,
    embed: query.data ? embedDesdeCoordenadas(query.data.lat, query.data.lng) : null,
    intentando: activarResolucion,
  };
}
