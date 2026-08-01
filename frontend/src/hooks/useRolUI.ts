/**
 * Hook que determina el rol UI efectivo del usuario actual.
 * Combina datos del auth store + useMisRoles para devolver un RolUI.
 */

import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import { calcularOpcionesRolUI, determinarRolUI, type RolUI } from '@/utils/permisos';

export function useRolUI(): RolUI | null {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const rolActivo = useAuthStore((s) => s.rolActivo);

  const iglesiaActiva = iglesias.find((i) => i.id === iglesiaActivaId);
  const esPastor = iglesiaActiva?.es_pastor ?? false;
  const esOperativo = iglesiaActiva?.es_operativo ?? false;
  const esLiderAfirmacion = iglesiaActiva?.es_lider_afirmacion ?? false;
  const { data: roles } = useMisRoles(iglesiaActivaId ?? undefined);

  // Si todavía no tenemos los roles del backend, no podemos determinar
  // el rol UI -- excepto para Super Admin, que resuelve a su atajo mientras
  // tanto (si además tiene otros roles, la línea de abajo lo desambigua).
  if (!roles) return esSuperAdmin ? 'SUPER_ADMIN' : null;

  const opciones = calcularOpcionesRolUI(esSuperAdmin, esPastor, esOperativo, roles, esLiderAfirmacion);

  // Caso unívoco (el más común): mismo comportamiento de siempre.
  if (opciones.length <= 1) return determinarRolUI(esSuperAdmin, esPastor, esOperativo, roles, esLiderAfirmacion);

  // Ambiguo: solo es válido el rol que el usuario eligió en /seleccionar-rol.
  // Si no eligió (o el elegido ya no aplica), PrivateLayout se encarga de
  // redirigir al picker -- acá devolvemos null como "todavía sin resolver".
  return rolActivo && opciones.includes(rolActivo) ? rolActivo : null;
}
