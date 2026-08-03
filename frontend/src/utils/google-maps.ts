/**
 * El link de Google Maps (url_gps) es la fuente de verdad de la ubicación --
 * nunca debe mezclarse con el texto de calle/zona/barrio, que es solo una
 * referencia legible para humanos y puede no coincidir (ej. misma calle en
 * otro barrio). Antes el mapa embebido siempre buscaba por el texto de
 * dirección, incluso habiendo un link con el pin exacto.
 *
 * Devuelve la URL de embed a usar, o null si no hay nada embebible todavía
 * (short links tipo maps.app.goo.gl no traen coordenadas visibles -- hace
 * falta resolverlos del lado del servidor, ver hooks/useUbicacionMaps).
 */
export function urlEmbedMapa(urlGps: string | null | undefined, direccionTexto: string | null | undefined): string | null {
  if (urlGps) {
    const coords = extraerCoordenadas(urlGps);
    return coords ? embedDesdeCoordenadas(coords.lat, coords.lng) : null;
  }
  if (direccionTexto) {
    return `https://www.google.com/maps?q=${encodeURIComponent(direccionTexto)}&output=embed`;
  }
  return null;
}

export function embedDesdeCoordenadas(lat: number | string, lng: number | string): string {
  return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
}

/** Un link "corto" (maps.app.goo.gl, goo.gl/maps) no expone coordenadas hasta
 * que se sigue la redirección -- esos son los que necesitan resolverUbicacionMaps. */
export function esLinkMapsCorto(url: string): boolean {
  return /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(url);
}

function extraerCoordenadas(url: string): { lat: string; lng: string } | null {
  // Prioridad al pin exacto (!3d{lat}!4d{lng}), mas preciso que el centro
  // del viewport que aparece en @lat,lng cuando el link viene de navegar el
  // mapa en vez de compartir un pin puntual.
  const porPin = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (porPin) return { lat: porPin[1], lng: porPin[2] };

  const porArroba = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (porArroba) return { lat: porArroba[1], lng: porArroba[2] };

  // Un pin suelto sin nombre de lugar resuelve a /maps/search/-17.35,+-63.25
  // -- el "+" es un espacio codificado entre la coma y el signo, no un
  // separador real.
  const porBusqueda = url.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (porBusqueda) return { lat: porBusqueda[1], lng: porBusqueda[2] };

  const porQuery = url.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (porQuery) return { lat: porQuery[1], lng: porQuery[2] };

  return null;
}
