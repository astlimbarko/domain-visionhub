/**
 * Sistema centralizado de permisos basado en roles.
 * Esta es la ÚNICA fuente de verdad para determinar qué ve cada rol.
 */

import {
  LayoutDashboard,
  Users,
  Home,
  Sparkles,
  ClipboardList,
  History,
  PhoneCall,
  Calendar,
  HeartHandshake,
  Wallet,
  Settings,
  ShieldCheck,
  UserPlus,
  Link2,
} from 'lucide-react';
import { ROUTES } from '@/utils/constants';
import type { MisRolesDashboard } from '@/types/dashboard.types';
import type { LucideIcon } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

// SIN_ROL: la persona no tiene ningún rol_sistema_enum vigente (ej. un
// Líder de Afirmación puro, sin cargo de Casas de Paz). No debe heredar
// nav ni rutas de ningún otro rol -- ver NAV_ITEM_AFIRMACION para cómo se
// agrega su propio acceso, ortogonal a este tipo.
export type RolUI = 'SUPER_ADMIN' | 'PASTOR' | 'SUPERVISOR' | 'LIDER_RED' | 'LIDER_CDP' | 'SUBLIDER_CDP' | 'SIN_ROL';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  /** Label alternativo por rol (ej. "Gestión de Sublíder" en vez de "Casas de Paz") */
  labelPorRol?: Partial<Record<RolUI, string>>;
}

// ─── Configuración de rutas por rol ──────────────────────────────────────────

const RUTAS_LIDER_CDP: string[] = [
  ROUTES.DASHBOARD,
  ROUTES.REPORTES,
  ROUTES.HISTORIAL_REPORTES,
  ROUTES.HISTORIAL_ASISTENCIA,
  ROUTES.EVANGELISMO,
  ROUTES.CALENDARIO,
  ROUTES.CASAS_DE_PAZ, // Se muestra como "Gestión de Sublíder"
];

// Mismo alcance de navegación que el líder real: la restricción del
// sublíder es de acciones (no puede designar/eliminar sublíderes ni
// modificar la CdP), no de qué módulos ve. Se aplica en CasasDePaz.tsx.
const RUTAS_SUBLIDER_CDP: string[] = [...RUTAS_LIDER_CDP];

const RUTAS_LIDER_RED: string[] = [
  ROUTES.DASHBOARD,
  ROUTES.PERSONAS,
  ROUTES.CASAS_DE_PAZ,
  ROUTES.REPORTES,
  ROUTES.HISTORIAL_REPORTES,
  ROUTES.HISTORIAL_ASISTENCIA,
  ROUTES.EVANGELISMO,
  ROUTES.CALENDARIO,
];

const RUTAS_SUPERVISOR: string[] = [
  ROUTES.DASHBOARD,
  ROUTES.PERSONAS,
  ROUTES.CASAS_DE_PAZ,
  ROUTES.MINISTERIOS,
  ROUTES.REPORTES,
  ROUTES.HISTORIAL_REPORTES,
  ROUTES.HISTORIAL_ASISTENCIA,
  ROUTES.CALENDARIO,
  ROUTES.EVANGELISMO,
  ROUTES.FINANZAS,
  ROUTES.PANEL_SUPERVISOR,
];

// Pastor = solo supervisión y consulta (Dashboard + Reportes globales).
// No crea Redes/CdP, no asigna líderes, no hace movimientos estructurales
// (spec de roles, Sección 11 - Rol 5). Antes reutilizaba RUTAS_SUPERVISOR
// por error, dándole el mismo alcance operativo que un Supervisor.
const RUTAS_PASTOR: string[] = [
  ROUTES.DASHBOARD,
  ROUTES.REPORTES,
  ROUTES.HISTORIAL_REPORTES,
  ROUTES.HISTORIAL_ASISTENCIA,
];

const RUTAS_SUPER_ADMIN: string[] = [
  ROUTES.ADMINISTRACION,
];

const RUTAS_POR_ROL: Record<RolUI, string[]> = {
  LIDER_CDP: RUTAS_LIDER_CDP,
  SUBLIDER_CDP: RUTAS_SUBLIDER_CDP,
  LIDER_RED: RUTAS_LIDER_RED,
  SUPERVISOR: RUTAS_SUPERVISOR,
  PASTOR: RUTAS_PASTOR,
  SUPER_ADMIN: RUTAS_SUPER_ADMIN,
  // Sin rutas propias: quien no tiene rol de sistema solo ve lo que le dé
  // una capacidad ortogonal (Afirmación) o /cuenta.
  SIN_ROL: [],
};

// ─── Catálogo completo de nav items ──────────────────────────────────────────

const CATALOGO_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: ROUTES.DASHBOARD },
  { icon: Users, label: 'Personas', path: ROUTES.PERSONAS },
  { icon: Home, label: 'Casas de Paz', path: ROUTES.CASAS_DE_PAZ, labelPorRol: { LIDER_CDP: 'Gestión de Sublíder', SUBLIDER_CDP: 'Gestión de Sublíder' } },
  { icon: Sparkles, label: 'Ministerios', path: ROUTES.MINISTERIOS },
  { icon: ClipboardList, label: 'Reportes', path: ROUTES.REPORTES },
  { icon: History, label: 'Historial de Reportes', path: ROUTES.HISTORIAL_REPORTES },
  { icon: PhoneCall, label: 'Historial de Asistencia', path: ROUTES.HISTORIAL_ASISTENCIA },
  { icon: Calendar, label: 'Calendario', path: ROUTES.CALENDARIO },
  { icon: HeartHandshake, label: 'Evangelismo', path: ROUTES.EVANGELISMO },
  { icon: Wallet, label: 'Finanzas', path: ROUTES.FINANZAS },
  { icon: Settings, label: 'Panel del Supervisor', path: ROUTES.PANEL_SUPERVISOR },
  { icon: ShieldCheck, label: 'Administración', path: ROUTES.ADMINISTRACION },
];

// ─── Ítems de nav por capacidad (ortogonal al RolUI) ──────────────────────────
// Afirmación no depende de rol_sistema_enum: se muestran segun
// useEsLiderAfirmacion(), no segun RUTAS_POR_ROL. Se agregan aparte del
// catalogo/obtenerNavItems para no romper la union RolUI existente.
// Tres items separados en el nav principal (no una sola entrada con
// sub-nav interno) -- decision del owner, 2026-07-26.

export const NAV_ITEMS_AFIRMACION: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: ROUTES.AFIRMACION },
  { icon: UserPlus, label: 'Formulario de membresía', path: ROUTES.AFIRMACION_FORMULARIO },
  { icon: Link2, label: 'URL de membresía', path: ROUTES.AFIRMACION_URLS },
];

// ─── Funciones públicas ──────────────────────────────────────────────────────

/**
 * Determina el rol UI efectivo del usuario.
 * Prioridad: SUPER_ADMIN > PASTOR > SUPERVISOR > LIDER_RED > LIDER_CDP > SUBLIDER_CDP
 *
 * - Pastor se detecta por es_pastor en la iglesia activa (antes se adivinaba
 *   por "tiene acceso a más de una iglesia", lo cual fallaba para el caso
 *   típico de un pastor de una sola iglesia)
 * - Supervisor se detecta por es_operativo en la iglesia activa
 * - Líder Red por tener redes_lider
 * - Líder CdP por tener cdp_lider; Sublíder CdP por tener solo cdp_sublider
 * - SIN_ROL si no cae en ninguno de los anteriores (ej. Líder de Afirmación
 *   puro, sin ningún cargo de Casas de Paz). Antes esto caía por error en
 *   'LIDER_CDP' (bug real: mostraba nav de Casas de Paz a alguien sin
 *   ningún cargo ahí), corregido 2026-07-26.
 */
export function determinarRolUI(
  esSuperAdmin: boolean,
  esPastor: boolean,
  esOperativo: boolean,
  roles: MisRolesDashboard | undefined,
): RolUI {
  if (esSuperAdmin) return 'SUPER_ADMIN';
  if (esPastor) return 'PASTOR';
  if (esOperativo) return 'SUPERVISOR';
  if (roles?.redes_lider?.length) return 'LIDER_RED';
  if (roles?.cdp_lider?.length) return 'LIDER_CDP';
  if (roles?.cdp_sublider?.length) return 'SUBLIDER_CDP';
  return 'SIN_ROL';
}

/**
 * Devuelve los items de navegación para un rol, con labels resueltos.
 */
export function obtenerNavItems(rolUI: RolUI): NavItem[] {
  const rutasPermitidas = RUTAS_POR_ROL[rolUI];
  return CATALOGO_NAV
    .filter((item) => rutasPermitidas.includes(item.path))
    .map((item) => ({
      ...item,
      label: item.labelPorRol?.[rolUI] ?? item.label,
    }));
}

/**
 * Verifica si un rol puede acceder a una ruta específica.
 */
export function puedeAcceder(rolUI: RolUI, ruta: string): boolean {
  // La ruta /cuenta siempre es accesible para todos
  if (ruta === ROUTES.CUENTA) return true;
  return RUTAS_POR_ROL[rolUI].includes(ruta);
}

/**
 * Devuelve qué roles pueden acceder a una ruta.
 * Usado por el guard de rutas.
 */
export function rolesPermitidosPara(ruta: string): RolUI[] {
  return (Object.keys(RUTAS_POR_ROL) as RolUI[]).filter(
    (rol) => RUTAS_POR_ROL[rol].includes(ruta),
  );
}
