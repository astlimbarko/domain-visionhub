import type { DomicilioCdp } from '@/types/casas-de-paz.types';

/** Dirección de reunión en una sola línea: calle+número, ciudad, zona. */
export function lineaDireccionCdp(d: DomicilioCdp) {
  const calle = [d.calle, d.numero].filter(Boolean).join(' ');
  return [calle || null, d.ciudad_nombre || null, d.zona ? `Zona: ${d.zona}` : null]
    .filter(Boolean)
    .join(', ');
}
