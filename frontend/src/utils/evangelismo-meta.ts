import type { OrigenMeta } from '@/types/evangelismo.types';

/**
 * Una meta "asignada" (por oposición a "propia") gobierna sobre la meta que
 * la propia Casa de Paz fijaría, y la bloquea hasta cumplirse
 * (`fn_bloquear_meta_propia_bajo_asignada`). Desde 103_evangelismo_meta_
 * supervisor_red.sql hay dos orígenes posibles: 'ASIGNADA' (CdP-específica,
 * la fija el Líder de Red) y 'ASIGNADA_RED' (heredada de la meta que el
 * Supervisor le asignó a la Red, porque esta CdP no tiene una propia) --
 * ambos cuentan como "asignada" para efectos de bloqueo/UI.
 */
export function esMetaAsignada(origen: OrigenMeta | null | undefined): boolean {
  return origen === 'ASIGNADA' || origen === 'ASIGNADA_RED';
}

/** Quién asignó la meta vigente, para mostrarlo de un vistazo. */
export function quienAsignoMeta(origen: OrigenMeta | null | undefined): string {
  return origen === 'ASIGNADA_RED' ? 'Supervisor' : 'Red';
}
