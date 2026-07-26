/**
 * Capacidad ortogonal al RolUI: si la persona tiene una asignacion vigente
 * de Lider de Afirmacion en la iglesia activa (departamento_cargo). No
 * reemplaza ni interfiere con useRolUI -- alguien puede ser LIDER_CDP y
 * ademas Lider de Afirmacion a la vez.
 */
import { useAuthStore } from '@/store/auth.store';

export function useEsLiderAfirmacion(): boolean {
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  return iglesias.find((i) => i.id === iglesiaActivaId)?.es_lider_afirmacion ?? false;
}
