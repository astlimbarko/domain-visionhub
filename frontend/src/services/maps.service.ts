import { supabase } from './supabase';

export interface CoordenadasMaps {
  lat: number;
  lng: number;
}

/** Sigue un short link de Google Maps (maps.app.goo.gl) del lado del servidor
 * -- el navegador no puede leer la redirección por CORS. Ver la Edge
 * Function resolver-ubicacion-maps. */
export async function resolverUbicacionMaps(url: string): Promise<CoordenadasMaps> {
  const { data, error } = await supabase.functions.invoke('resolver-ubicacion-maps', { body: { url } });
  if (error) throw error;
  return data as CoordenadasMaps;
}
