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
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const iglesiaActiva = iglesias.find((i) => i.id === iglesiaActivaId);
  const esPastor = iglesiaActiva?.es_pastor ?? false;
  const esOperativo = iglesiaActiva?.es_operativo ?? false;
  const esLiderAfirmacion = iglesiaActiva?.es_lider_afirmacion ?? false;
  const { data: roles, isLoading } = useMisRoles(iglesiaActivaId ?? undefined);

  // Super Admin sin ninguna iglesia activa (nada que desambiguar): su único
  // sombrero posible es el propio, sin depender de useMisRoles.
  if (esSuperAdmin && !iglesiaActivaId) {
    const meta = ROL_UI_META.SUPER_ADMIN;
    return meta ? [{ rolUI: 'SUPER_ADMIN', ...meta }] : [];
  }

  // Cuenta sin ninguna iglesia asociada (ej. alta nueva por Google via
  // KAN-138, todavia sin invitacion a ninguna iglesia -- antes imposible,
  // toda cuenta nacia ya invitada a una iglesia): useMisRoles ni siquiera
  // dispara (enabled: !!iglesiaId), asi que `roles` queda undefined para
  // siempre y este hook nunca salia del `undefined` -- PrivateLayout
  // interpretaba eso como "todavia cargando" de forma indefinida (bug real,
  // reportado 2026-08-09: pantalla de "Cargando..." que nunca terminaba).
  // Sin iglesia no hay nada que resolver: es un [] valido, no una carga.
  if (!iglesiaActivaId) return [];

  if (isLoading || !roles) return undefined;

  return calcularOpcionesRolUI(esSuperAdmin, esPastor, esOperativo, roles, esLiderAfirmacion)
    .map((rolUI) => {
      const meta = ROL_UI_META[rolUI];
      return meta ? { rolUI, ...meta } : null;
    })
    .filter((o): o is OpcionRol => o !== null);
}
