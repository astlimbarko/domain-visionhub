/**
 * Capacidades ortogonales al RolUI: acceso global de solo lectura a Jóvenes
 * o a Matrimonios de toda la iglesia, sin importar la red. Mismo patrón que
 * useEsLiderAfirmacion.ts -- no reemplazan ni interfieren con useRolUI,
 * alguien puede ser LIDER_CDP y además Líder de Jóvenes a la vez.
 */
import { useAuthStore } from '@/store/auth.store';

export function useEsLiderJovenes(): boolean {
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  return iglesias.find((i) => i.id === iglesiaActivaId)?.es_lider_jovenes ?? false;
}

export function useEsEncargadoMatrimonios(): boolean {
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  return iglesias.find((i) => i.id === iglesiaActivaId)?.es_encargado_matrimonios ?? false;
}
