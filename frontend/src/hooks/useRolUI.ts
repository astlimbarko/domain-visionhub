/**
 * Hook que determina el rol UI efectivo del usuario actual.
 * Combina datos del auth store + useMisRoles para devolver un RolUI.
 */

import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import { determinarRolUI, type RolUI } from '@/utils/permisos';

export function useRolUI(): RolUI | null {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);

  const iglesiaActiva = iglesias.find((i) => i.id === iglesiaActivaId);
  const esPastor = iglesiaActiva?.es_pastor ?? false;
  const esOperativo = iglesiaActiva?.es_operativo ?? false;
  const { data: roles } = useMisRoles(iglesiaActivaId ?? undefined);

  // Si todavía no tenemos los roles del backend, no podemos determinar
  // el rol UI (excepto para SuperAdmin que no necesita iglesia).
  if (esSuperAdmin) return 'SUPER_ADMIN';
  if (!roles) return null;

  return determinarRolUI(esSuperAdmin, esPastor, esOperativo, roles);
}
