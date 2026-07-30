/**
 * Opciones de rol elegibles para el usuario actual en la iglesia activa.
 * Base de la pantalla "Seleccionar rol" y del ítem "Cambiar rol": cuando hay
 * más de una, el usuario elige con cuál entra; con una sola (el caso normal),
 * no hace falta elegir nada.
 */

import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import { calcularOpcionesRolUI, ROL_UI_META } from '@/utils/permisos';
import type { RolUI } from '@/utils/permisos';
import type { LucideIcon } from 'lucide-react';

export interface OpcionRol {
  rolUI: RolUI;
  label: string;
  icon: LucideIcon;
  color: string;
}

/** `undefined` mientras se cargan los roles; `[]`/`[x]`/`[x,y,...]` una vez resueltos. */
export function useOpcionesRol(): OpcionRol[] | undefined {
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const iglesiaActiva = iglesias.find((i) => i.id === iglesiaActivaId);
  const esPastor = iglesiaActiva?.es_pastor ?? false;
  const esOperativo = iglesiaActiva?.es_operativo ?? false;
  const { data: roles, isLoading } = useMisRoles(iglesiaActivaId ?? undefined);

  if (isLoading || !roles) return undefined;

  return calcularOpcionesRolUI(esPastor, esOperativo, roles)
    .map((rolUI) => {
      const meta = ROL_UI_META[rolUI];
      return meta ? { rolUI, ...meta } : null;
    })
    .filter((o): o is OpcionRol => o !== null);
}
