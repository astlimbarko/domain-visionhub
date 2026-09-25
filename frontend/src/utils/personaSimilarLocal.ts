/**
 * KAN-438: `fn_buscar_personas_similares` (RPC, pg_trgm) solo puede ver la
 * tabla `persona` real -- no detecta que dos personas nuevas cargadas en el
 * mismo formulario, todavía sin enviar, tienen el mismo nombre (ninguna
 * existe aún en la base). Esta comparación corre en el cliente, contra la
 * lista de personas nuevas ya agregadas al borrador actual.
 *
 * Mismo criterio que el RPC (confirmado en la investigación de KAN-436):
 * compara solo primer nombre + primer apellido, sin segundo apellido --
 * para no repetir el aviso cuando lo único que cambia es el segundo
 * apellido de una persona genuinamente distinta.
 */

function normalizarParaComparar(texto: string | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function sonNombresIguales(
  nombreA: string | undefined,
  apellidoA: string | undefined,
  nombreB: string | undefined,
  apellidoB: string | undefined
): boolean {
  const nombreANorm = normalizarParaComparar(nombreA);
  const apellidoANorm = normalizarParaComparar(apellidoA);
  if (!nombreANorm || !apellidoANorm) return false;
  return nombreANorm === normalizarParaComparar(nombreB) && apellidoANorm === normalizarParaComparar(apellidoB);
}

/** Prefijo del `id` de un candidato "local" (persona nueva del mismo
 * borrador, sin persona_id real) -- distingue estos candidatos de los que
 * vienen del RPC (esos sí tienen un UUID real de `persona`) para que el
 * consumidor de `ConfirmarPosibleDuplicadoDialog` sepa que "usar esta"
 * significa "no crear otra vez", no "vincular a un UUID existente". */
export const PREFIJO_CANDIDATO_LOCAL = 'local:';

export function esCandidatoLocal(personaId: string): boolean {
  return personaId.startsWith(PREFIJO_CANDIDATO_LOCAL);
}
