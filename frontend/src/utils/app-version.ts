// KAN-412: version = 1.0.<numero de PR>, calculada en build-time (ver
// vite.config.ts, define de VITE_APP_VERSION a partir del ultimo commit de
// merge real). Fuente unica para Login y /avances -- ninguno de los 2 debe
// tener un numero escrito a mano.
export function obtenerVersionApp(): string {
  return import.meta.env.VITE_APP_VERSION || '1.0.dev';
}
