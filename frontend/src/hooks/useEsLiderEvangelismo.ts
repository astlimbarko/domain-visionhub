/**
 * Capacidad ortogonal al RolUI: si la persona tiene una asignacion vigente
 * de Lider de Departamento de Evangelismo en la iglesia activa
 * (departamento_cargo). Mismo patron que useEsLiderAfirmacion (KAN-281).
 */
import { useAuthStore } from '@/store/auth.store';

export function useEsLiderEvangelismo(): boolean {
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  return iglesias.find((i) => i.id === iglesiaActivaId)?.es_lider_evangelismo ?? false;
}
