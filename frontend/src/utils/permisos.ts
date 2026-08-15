/**
 * Sistema centralizado de permisos basado en roles.
 * Esta es la ÚNICA fuente de verdad para determinar qué ve cada rol.
 */

import {
  LayoutDashboard,
  Users,
  Home,
  ClipboardList,
  ClipboardCheck,
  History,
  PhoneCall,
  Calendar,
  HeartHandshake,
  Wallet,
  Settings,
  ShieldCheck,
  UserPlus,
  Link2,
  LayoutGrid,
  Footprints,
  Network,
  Heart,
} from 'lucide-react';
import { ROUTES } from '@/utils/constants';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import type { LucideIcon } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

// SIN_ROL: la persona no tiene ningún rol_sistema_enum vigente (ej. un
// Líder de Afirmación puro, sin cargo de Casas de Paz). No debe heredar
// nav ni rutas de ningún otro rol -- ver NAV_ITEM_AFIRMACION para cómo se
// agrega su propio acceso, ortogonal a este tipo.
export type RolUI =
  | 'SUPER_ADMIN'
  | 'PASTOR'
  | 'SUPERVISOR'
  | 'LIDER_RED'
  | 'LIDER_CDP'
  | 'SUBLIDER_CDP'
  | 'LIDER_DEPARTAMENTO'
  | 'LIDER_JOVENES'
  | 'ENCARGADO_MATRIMONIOS'
  | 'SIN_ROL';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  /** Color vivo propio de la sección: su ícono lo usa para reconocerse de un vistazo. */
  color: string;
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

// A diferencia del líder real, el sublíder tiene un alcance de navegación
// más chico -- sin Dashboard ni Historial de Reportes (decisión del owner,
// 2026-07-31). Acotado de nuevo 2026-08-02 (pedido explícito del owner): solo
// [Perfil de Casa de Paz][Reportes][Historial de Asistencia][Evangelismo],
// sin Calendario. Además de ver menos módulos, dentro de los que sí ve la
// restricción es de acciones -- no puede modificar nada, solo subir
// reportes (eso ya notifica al Líder de CdP vigente, trg_notificar_reporte_
// sublider en 57_notificaciones.sql) -- no puede designar/eliminar
// sublíderes ni modificar la CdP, tampoco editar nada de Evangelismo -- eso
// se aplica en CasasDePaz.tsx y Evangelismo.tsx, no acá.
const RUTAS_SUBLIDER_CDP: string[] = [
  ROUTES.REPORTES,
  ROUTES.CASAS_DE_PAZ, // Se muestra como "Perfil de Casa de Paz"
  ROUTES.EVANGELISMO,
  ROUTES.HISTORIAL_ASISTENCIA,
];

// El Líder de Red supervisa, no carga reportes: en vez de "Reportes" (el
// formulario de carga del líder de CdP) + los dos "Historial" sueltos, ve un
// único "Control de Reportes" (vista supervisora de toda la Red). El orden del
// menú lo fija CATALOGO_NAV, no este arreglo.
const RUTAS_LIDER_RED: string[] = [
  ROUTES.DASHBOARD,
  ROUTES.PERSONAS,
  ROUTES.CASAS_DE_PAZ, // Se muestra como "Gestión de Casas de Paz"
  ROUTES.CONTROL_REPORTES,
  ROUTES.CALENDARIO,
  ROUTES.EVANGELISMO,
  ROUTES.VISITAS,
  // KAN-101 (2026-08-15): Líder/Supervisor de Red puede crear anuncios para
  // su propia Red (fn_anuncio_puede_administrar_alcance ya lo valida server-
  // side) -- sin esto el guard de PrivateLayout.puedeAcceder rechazaba la
  // ruta aunque el backend lo permitiera, dejando /anuncios inalcanzable
  // incluso por URL directa (bug real encontrado probando en vivo).
  ROUTES.ANUNCIOS,
  ROUTES.ANUNCIO_NUEVO,
  ROUTES.ANUNCIO_EDITAR,
];

// El Supervisor no carga reportes (igual que el Líder de Red): supervisa,
// no reporta -- "Historial de Reportes" pasa a ser su vista de Control de
// Reportes agrupada por Red (HistorialReportes.tsx, rama SUPERVISOR),
// mismo criterio que ya usa el Líder de Red con Control de Reportes
// (pedido del owner, 2026-08-04).
const RUTAS_SUPERVISOR: string[] = [
  ROUTES.DASHBOARD,
  ROUTES.PERSONAS,
  ROUTES.CASAS_DE_PAZ,
  ROUTES.HISTORIAL_REPORTES,
  ROUTES.HISTORIAL_ASISTENCIA,
  ROUTES.CALENDARIO,
  ROUTES.EVANGELISMO,
  ROUTES.FINANZAS,
  ROUTES.PANEL_SUPERVISOR,
  ROUTES.DEPARTAMENTOS,
  ROUTES.GESTION_REDES,
  // Resumen del Constructor (2026-08-11) -- mismo nivel que Pastor, ver
  // paneles-contexto.ts.
  ROUTES.CONSTRUCTOR_RESUMEN,
  // KAN-101 (2026-08-15): Supervisor/Pastor gestionan anuncios de iglesia
  // completa (paridad, ver fn_anuncio_es_supervisor). RUTAS_PASTOR hereda
  // este arreglo, así que un solo agregado cubre ambos.
  ROUTES.ANUNCIOS,
  ROUTES.ANUNCIO_NUEVO,
  ROUTES.ANUNCIO_EDITAR,
];

// 2026-08-09: paridad completa con Supervisor (pedido explícito del
// owner/equipo, KAN-86) -- Pastor ve y puede hacer exactamente lo mismo que
// Supervisor. El backend ya respalda este alcance (fn_es_pastor_en agregado
// junto a fn_es_operativo_en en cada función relevante, ver migración
// 20260809080000_paridad_pastor_supervisor.sql).
const RUTAS_PASTOR: string[] = RUTAS_SUPERVISOR;

const RUTAS_SUPER_ADMIN: string[] = [
  ROUTES.ADMINISTRACION,
];

// Líder de Departamento (hoy solo Afirmación es funcional) -- capacidad que
// antes era ortogonal al RolUI (NAV_ITEMS_AFIRMACION, useEsLiderAfirmacion)
// y bypaseaba el picker multi-rol por completo. 2026-08-01: pasa a ser un
// RolUI mas para que aparezca como opcion en "Seleccionar rol" cuando la
// persona ademas tiene otro rol -- antes eso era irrealizable (quien tenia
// Lider de CdP + Lider de Afirmacion nunca llegaba a ver la segunda).
const RUTAS_LIDER_DEPARTAMENTO: string[] = [
  ROUTES.AFIRMACION,
  ROUTES.AFIRMACION_FORMULARIO,
  ROUTES.AFIRMACION_URLS,
  ROUTES.AFIRMACION_CASAS_DE_PAZ,
];
const RUTAS_LIDER_JOVENES: string[] = [ROUTES.JOVENES];
const RUTAS_ENCARGADO_MATRIMONIOS: string[] = [ROUTES.MATRIMONIOS];

const RUTAS_POR_ROL: Record<RolUI, string[]> = {
  LIDER_CDP: RUTAS_LIDER_CDP,
  SUBLIDER_CDP: RUTAS_SUBLIDER_CDP,
  LIDER_RED: RUTAS_LIDER_RED,
  SUPERVISOR: RUTAS_SUPERVISOR,
  PASTOR: RUTAS_PASTOR,
  SUPER_ADMIN: RUTAS_SUPER_ADMIN,
  LIDER_DEPARTAMENTO: RUTAS_LIDER_DEPARTAMENTO,
  LIDER_JOVENES: RUTAS_LIDER_JOVENES,
  ENCARGADO_MATRIMONIOS: RUTAS_ENCARGADO_MATRIMONIOS,
  // Sin rutas propias: quien no tiene rol de sistema solo ve lo que le dé
  // una capacidad ortogonal (Afirmación) o /cuenta.
  SIN_ROL: [],
};

// ─── Catálogo completo de nav items ──────────────────────────────────────────

// Colores vivos (paleta de sistema Apple/HIG) — cada sección tiene el suyo para
// que se reconozca por color + ícono sin tener que leer. Los 6 ítems del Líder
// de Red se eligieron bien distintos entre sí.
const CATALOGO_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: ROUTES.DASHBOARD, color: '#0071e3' },
  { icon: Users, label: 'Personas', path: ROUTES.PERSONAS, color: '#5856d6' },
  { icon: Home, label: 'Casas de Paz', path: ROUTES.CASAS_DE_PAZ, color: '#0aa5c0', labelPorRol: { LIDER_RED: 'Gestión de Casas de Paz', LIDER_CDP: 'Perfil de Casa de Paz', SUBLIDER_CDP: 'Perfil de Casa de Paz' } },
  { icon: ClipboardCheck, label: 'Control de Reportes', path: ROUTES.CONTROL_REPORTES, color: '#ff9f0a' },
  { icon: ClipboardList, label: 'Reportes', path: ROUTES.REPORTES, color: '#ff9f0a' },
  { icon: History, label: 'Historial de Reportes', path: ROUTES.HISTORIAL_REPORTES, color: '#5ac8fa' },
  { icon: PhoneCall, label: 'Historial de Asistencia', path: ROUTES.HISTORIAL_ASISTENCIA, color: '#30b0c7' },
  { icon: Calendar, label: 'Calendario', path: ROUTES.CALENDARIO, color: '#af52de' },
  // Amarillo institucional de Evangelismo (DEPARTAMENTO_META, frontend-style
  // SKILL.md) -- pedido del owner (2026-08-02) para que la sección se
  // reconozca a simple vista, en vez del rosa (#ff2d55) que no tenía relación
  // con ningún otro color del sistema.
  { icon: HeartHandshake, label: 'Evangelismo', path: ROUTES.EVANGELISMO, color: DEPARTAMENTO_META.EVANGELISMO.color },
  { icon: Footprints, label: 'Visitas', path: ROUTES.VISITAS, color: '#a2845e' },
  { icon: Wallet, label: 'Finanzas', path: ROUTES.FINANZAS, color: '#00c7be' },
  { icon: Settings, label: 'Panel del Supervisor', path: ROUTES.PANEL_SUPERVISOR, color: '#8e8e93' },
  { icon: LayoutGrid, label: 'Departamentos', path: ROUTES.DEPARTAMENTOS, color: '#af52de' },
  { icon: Network, label: 'Gestión de Redes', path: ROUTES.GESTION_REDES, color: '#5e5ce6' },
  { icon: ShieldCheck, label: 'Administración', path: ROUTES.ADMINISTRACION, color: '#0a4174' },
];

// ─── Ítems de nav por capacidad (ortogonal al RolUI) ──────────────────────────
// Afirmación no depende de rol_sistema_enum: se muestran segun
// useEsLiderAfirmacion(), no segun RUTAS_POR_ROL. Se agregan aparte del
// catalogo/obtenerNavItems para no romper la union RolUI existente.
// Tres items separados en el nav principal (no una sola entrada con
// sub-nav interno) -- decision del owner, 2026-07-26.

export const NAV_ITEMS_AFIRMACION: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: ROUTES.AFIRMACION, color: '#0071e3' },
  { icon: UserPlus, label: 'Formulario de membresía', path: ROUTES.AFIRMACION_FORMULARIO, color: '#34c759' },
  { icon: Link2, label: 'URL de membresía', path: ROUTES.AFIRMACION_URLS, color: '#5e5ce6' },
  // KAN-127: todas las Casas de Paz de la iglesia, organizadas por Red.
  { icon: Home, label: 'Casas de Paz', path: ROUTES.AFIRMACION_CASAS_DE_PAZ, color: '#0aa5c0' },
];

// Roles globales de solo lectura (2026-08-02): un item de nav cada uno,
// visibles segun useEsLiderJovenes()/useEsEncargadoMatrimonios() -- mismo
// patron ortogonal que Afirmación, no dependen de RUTAS_POR_ROL.
export const NAV_ITEM_JOVENES: NavItem = { icon: Users, label: 'Jóvenes', path: ROUTES.JOVENES, color: '#ff9500' };
export const NAV_ITEM_MATRIMONIOS: NavItem = { icon: Heart, label: 'Matrimonios', path: ROUTES.MATRIMONIOS, color: '#ff375f' };

// ─── Funciones públicas ──────────────────────────────────────────────────────

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

// `ruta` acá es un pathname real (ej. `/constructor/3dd4...`), mientras que
// las plantillas de RUTAS_POR_ROL pueden traer segmentos dinámicos (ej.
// `/constructor/:iglesiaId`) -- comparar con `===`/`includes` nunca
// coincide para esas. CONSTRUCTOR_RESUMEN (2026-08-11) fue la primera ruta
// dinámica dentro de PrivateLayout (antes solo existían fuera, ej.
// ESTRUCTURA_ORGANIZACIONAL, que se autoprotege sin pasar por acá).
function coincideConPlantilla(plantilla: string, ruta: string): boolean {
  const partesPlantilla = plantilla.split('/');
  const partesRuta = ruta.split('/');
  if (partesPlantilla.length !== partesRuta.length) return false;
  return partesPlantilla.every((parte, i) => parte.startsWith(':') || parte === partesRuta[i]);
}

/**
 * Verifica si un rol puede acceder a una ruta específica.
 */
export function puedeAcceder(rolUI: RolUI, ruta: string): boolean {
  // La ruta /cuenta siempre es accesible para todos
  if (ruta === ROUTES.CUENTA) return true;
  return RUTAS_POR_ROL[rolUI].some((plantilla) => coincideConPlantilla(plantilla, ruta));
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
