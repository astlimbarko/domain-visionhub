import { Network } from 'lucide-react';
import type { ContextoActivo } from '@/types/contexto-activo.types';
import {
  NAV_ITEMS_AFIRMACION,
  NAV_ITEM_JOVENES,
  NAV_ITEM_MATRIMONIOS,
  obtenerNavItems,
  puedeAcceder,
  type NavItem,
} from '@/utils/permisos';
import { ROUTES, rutaConstructorResumen } from '@/utils/constants';

export const COLORES_NAVBAR_CONTEXTO = {
  SUPER_ADMIN: '#0A0E1A',
  PASTOR: '#7A2948',
  SUPERVISOR: '#0F766E',
  LIDER_RED: '#4E73B7',
  SUPERVISOR_RED: '#5B4BB7',
  LIDER_DEPARTAMENTO: '#0071E3',
  LIDER_CDP: '#B45309',
  SUBLIDER_CDP: '#FFFAFA',
  LIDER_JOVENES: '#FFFAFA',
  ENCARGADO_MATRIMONIOS: '#FFFAFA',
  // Reservado para el futuro panel de calendario; todavía no es un RolUI.
  ENCARGADO_CALENDARIO: '#6D28D9',
} as const;

export interface PanelContexto {
  titulo: string;
  navItems: NavItem[];
  rutaInicial: string;
  colorNavbar: string;
  textoNavbarClaro: boolean;
  temaOscuro: boolean;
  puedeAccederRuta: (ruta: string) => boolean;
}

function tituloContexto(contexto: ContextoActivo): string {
  if (contexto.rolUI === 'SUPER_ADMIN') return 'Administración';
  if (contexto.rolUI === 'PASTOR') return 'Pastor';
  if (contexto.rolUI === 'SUPERVISOR') return 'Supervisor de la Visión en Acción';
  if (contexto.rolUI === 'LIDER_DEPARTAMENTO') return 'Líder de Afirmación';
  if (contexto.rolUI === 'LIDER_RED') {
    return contexto.cargoRed === 'SUPERVISOR' ? 'Supervisor de Red' : 'Líder de Red';
  }
  if (contexto.rolUI === 'LIDER_CDP') return 'Líder de Casa de Paz';
  if (contexto.rolUI === 'SUBLIDER_CDP') return 'Sublíder de Casa de Paz';
  if (contexto.rolUI === 'LIDER_JOVENES') return 'Líder de Jóvenes';
  return 'Encargado de Matrimonios';
}

function navContexto(contexto: ContextoActivo): NavItem[] {
  if (contexto.rolUI === 'LIDER_DEPARTAMENTO') return NAV_ITEMS_AFIRMACION;
  if (contexto.rolUI === 'LIDER_JOVENES') return [NAV_ITEM_JOVENES];
  if (contexto.rolUI === 'ENCARGADO_MATRIMONIOS') return [NAV_ITEM_MATRIMONIOS];
  const items = obtenerNavItems(contexto.rolUI);
  // Pastor tiene una sola iglesia activa bien definida (a diferencia de Super
  // Admin, que administra varias): recibe su propio ítem de nav apuntando a
  // ella en vez de tener que pasar por un panel de Administración que no ve
  // (paridad con Supervisor, KAN-86, 2026-08-09). Apunta al resumen, no
  // directo al lienzo -- desde ahí puede ver si tiene iglesias hijas/satélite
  // y entrar al Constructor de cada una por separado (2026-08-11).
  if (contexto.rolUI === 'PASTOR') {
    return [
      ...items,
      { icon: Network, label: 'Constructor', path: rutaConstructorResumen(contexto.iglesiaId), color: '#0a4174' },
    ];
  }
  return items;
}

function rutaInicialContexto(contexto: ContextoActivo): string {
  if (contexto.rolUI === 'SUPER_ADMIN') return ROUTES.ADMINISTRACION;
  if (contexto.rolUI === 'SUBLIDER_CDP') return ROUTES.CASAS_DE_PAZ;
  if (contexto.rolUI === 'LIDER_DEPARTAMENTO') return ROUTES.AFIRMACION;
  if (contexto.rolUI === 'LIDER_JOVENES') return ROUTES.JOVENES;
  if (contexto.rolUI === 'ENCARGADO_MATRIMONIOS') return ROUTES.MATRIMONIOS;
  return ROUTES.DASHBOARD;
}

function colorContexto(contexto: ContextoActivo): string {
  if (contexto.rolUI === 'LIDER_RED' && contexto.cargoRed === 'SUPERVISOR') {
    return COLORES_NAVBAR_CONTEXTO.SUPERVISOR_RED;
  }
  return COLORES_NAVBAR_CONTEXTO[contexto.rolUI];
}

export function obtenerPanelContexto(contexto: ContextoActivo): PanelContexto {
  const colorNavbar = colorContexto(contexto);
  const temaOscuro = contexto.rolUI === 'SUPER_ADMIN';
  const textoNavbarClaro = colorNavbar.toUpperCase() !== '#FFFAFA';

  return {
    titulo: tituloContexto(contexto),
    navItems: navContexto(contexto),
    rutaInicial: rutaInicialContexto(contexto),
    colorNavbar,
    textoNavbarClaro,
    temaOscuro,
    puedeAccederRuta: (ruta) => ruta === ROUTES.CUENTA || puedeAcceder(contexto.rolUI, ruta),
  };
}

export function rutaInicialParaContexto(contexto: ContextoActivo): string {
  return obtenerPanelContexto(contexto).rutaInicial;
}
