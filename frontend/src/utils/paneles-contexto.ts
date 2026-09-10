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
  if (contexto.rolUI === 'LIDER_DEPARTAMENTO') {
    // "Líder de Departamento de Evangelismo" no entraba bien en el navbar
    // (pedido explícito del owner, 2026-09-07) -- acortado solo acá, el
    // título completo se sigue viendo en el selector de rol.
    return contexto.departamentoCodigo === 'EVANGELISMO' ? 'Dpto. de Evangelismo' : 'Líder de Afirmación';
  }
  if (contexto.rolUI === 'LIDER_RED') {
    return contexto.cargoRed === 'SUPERVISOR' ? 'Supervisor de Red' : 'Líder de Red';
  }
  if (contexto.rolUI === 'LIDER_CDP') return 'Líder de Casa de Paz';
  if (contexto.rolUI === 'SUBLIDER_CDP') return 'Sublíder de Casa de Paz';
  if (contexto.rolUI === 'LIDER_JOVENES') return 'Líder de Jóvenes';
  return 'Encargado de Matrimonios';
}

function navContexto(contexto: ContextoActivo): NavItem[] {
  if (contexto.rolUI === 'LIDER_DEPARTAMENTO') {
    // Evangelismo (Lider de Departamento) tiene solo estas 2 pantallas, y ya
    // se cruzan entre si con un boton en el hero de cada una -- el sidebar
    // quedaba 100% redundante (pedido explicito del owner, 2026-09-10). Sin
    // items no rompe nada: el drawer mobile sigue teniendo Mi cuenta/Cambiar
    // rol/Salir en su pie, y el menu de cuenta de escritorio es independiente
    // del sidebar. Afirmacion no entra aca -- tiene 5 pantallas reales, no
    // son 2 atajos cruzados.
    if (contexto.departamentoCodigo === 'EVANGELISMO') return [];
    return NAV_ITEMS_AFIRMACION;
  }
  if (contexto.rolUI === 'LIDER_JOVENES') return [NAV_ITEM_JOVENES];
  if (contexto.rolUI === 'ENCARGADO_MATRIMONIOS') return [NAV_ITEM_MATRIMONIOS];
  const items = obtenerNavItems(contexto.rolUI);
  // Pastor y Supervisor tienen una sola iglesia activa bien definida (a
  // diferencia de Super Admin, que administra varias): ambos reciben su
  // propio ítem de nav apuntando a ella en vez de tener que pasar por un
  // panel de Administración que no ven (paridad Pastor-Supervisor, KAN-86,
  // 2026-08-09 -- mismo nivel, mismo acceso). Apunta al resumen, no directo
  // al lienzo -- desde ahí puede ver si tiene iglesias hijas/satélite y
  // entrar al Constructor de cada una por separado (2026-08-11).
  //
  // Líder/Supervisor de Red (rolUI 'LIDER_RED', cubre a ambos) ya podían
  // ENTRAR al lienzo desde KAN-78 (ven todo, solo editan su propia Red) --
  // pero no tenían ningún ítem de nav que los llevara ahí, quedaba
  // inalcanzable salvo por URL directa. Pedido explícito del owner
  // 2026-08-21: agregarles el mismo acceso "para que puedan visualizar".
  if (contexto.rolUI === 'PASTOR' || contexto.rolUI === 'SUPERVISOR' || contexto.rolUI === 'LIDER_RED') {
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
  if (contexto.rolUI === 'LIDER_DEPARTAMENTO') {
    return contexto.departamentoCodigo === 'EVANGELISMO' ? ROUTES.EVANGELISMO : ROUTES.AFIRMACION;
  }
  if (contexto.rolUI === 'LIDER_JOVENES') return ROUTES.JOVENES;
  if (contexto.rolUI === 'ENCARGADO_MATRIMONIOS') return ROUTES.MATRIMONIOS;
  return ROUTES.DASHBOARD;
}

function colorContexto(contexto: ContextoActivo): string {
  if (contexto.rolUI === 'LIDER_RED' && contexto.cargoRed === 'SUPERVISOR') {
    return COLORES_NAVBAR_CONTEXTO.SUPERVISOR_RED;
  }
  if (contexto.rolUI === 'LIDER_DEPARTAMENTO' && contexto.departamentoCodigo === 'EVANGELISMO') {
    // Mockup del owner (KAN-337, evangelismo_new.png): navbar claro con texto
    // oscuro, no el dorado institucional -- ese color queda solo para el
    // banner central. '#F7F8FA' (pedido explícito del owner, 2026-09-06 --
    // "mejor que el pastelito que tenemos") es distinto del '#FFFAFA' que ya
    // usan otros roles -- ver COLORES_NAVBAR_CLARO más abajo, la lista de
    // hex que ponen texto oscuro.
    return '#F7F8FA';
  }
  return COLORES_NAVBAR_CONTEXTO[contexto.rolUI];
}

// Fondos de navbar "claros" (texto oscuro) -- todo lo que no esté acá usa
// texto blanco. '#FFFAFA' (Sublíder de CdP, Líder de Jóvenes, Encargado de
// Matrimonios) y '#F7F8FA' (Depto. de Evangelismo, KAN-337) son ambos claros
// pero con hex distinto, por eso una lista en vez de comparar un solo valor.
const COLORES_NAVBAR_CLARO = new Set(['#FFFAFA', '#F7F8FA']);

export function obtenerPanelContexto(contexto: ContextoActivo): PanelContexto {
  const colorNavbar = colorContexto(contexto);
  const temaOscuro = contexto.rolUI === 'SUPER_ADMIN';
  const textoNavbarClaro = !COLORES_NAVBAR_CLARO.has(colorNavbar.toUpperCase());

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
