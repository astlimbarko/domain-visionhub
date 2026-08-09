/**
 * Hook que determina el rol UI efectivo del usuario actual.
 * Combina datos del auth store + useMisRoles para devolver un RolUI.
 */

import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useAuthStore } from '@/store/auth.store';
import type { RolUI } from '@/utils/permisos';

export function useRolUI(): RolUI | null {
  const { contextoActivo, contextosDisponibles } = useContextoActivo();
  const rolActivo = useAuthStore((s) => s.rolActivo);

  if (contextoActivo) return contextoActivo.rolUI;
  if (!contextosDisponibles) return null;

  if (contextosDisponibles.length === 1) {
    return contextosDisponibles[0].rolUI;
  }

  // Compatibilidad hasta KAN-132: el selector actual aún guarda solo RolUI.
  // El contexto completo siempre tiene prioridad y es el único que distingue
  // dos asignaciones del mismo rol.
  return rolActivo && contextosDisponibles.some((contexto) => contexto.rolUI === rolActivo)
    ? rolActivo
    : null;
}
