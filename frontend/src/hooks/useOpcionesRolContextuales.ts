/**
 * Datos para la pantalla "Seleccionar rol" (rediseño 2026-08-01,
 * login_multi_rol.jpeg). A diferencia de `useOpcionesRol` (una entrada por
 * TIPO de rol, usada por PrivateLayout/AppShell para decidir permisos y
 * ambigüedad -- sin tocar), acá cada asignación real es su propia fila: si
 * la persona lidera 2 Redes o 2 Casas de Paz, son 2 entradas separadas con
 * sus propios datos, no una sola agrupada por tipo. No reemplaza ni compite
 * con `useOpcionesRol` -- viven en paralelo, misma fuente de datos
 * (useMisRoles), esta solo la presenta con más detalle para esta pantalla.
 */
import type { LucideIcon } from 'lucide-react';
import { MapPin, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import type { ContextoActivo } from '@/types/contexto-activo.types';
import type { RolUI } from '@/utils/permisos';
import type { Vista, CargoCdpDashboard } from '@/types/dashboard.types';
import { COLOR_RED_NEUTRO, FILA_ROL_VISUAL } from '@/utils/seleccionar-rol-visual';
import { ROUTES } from '@/utils/constants';

export interface LineaSecundaria {
  icon?: LucideIcon;
  texto: string;
}

export interface OpcionRolContextual {
  key: string;
  rolUI: RolUI;
  contexto: ContextoActivo;
  titulo: string;
  icon: LucideIcon;
  bgIcono: string;
  colorIcono: string;
  lineas: LineaSecundaria[];
  /** Solo Líder de Red: color real de la red para el punto junto a la flecha. */
  colorRed?: string;
  /** Contexto específico a abrir (mismo mecanismo de `location.state.vista` que ya usa Dashboard.tsx). Sin vista = atajo genérico (ej. Super Admin). */
  vista?: Vista;
  /** Ruta directa fuera del Dashboard genérico (ej. Afirmación, su propia sección). Si está, `vista` se ignora. */
  ruta?: string;
}

function construirOpcionCdp(cdp: CargoCdpDashboard, esSublider: boolean, iglesiaId: string): OpcionRolContextual {
  const v = esSublider ? FILA_ROL_VISUAL.SUBLIDER_CDP : FILA_ROL_VISUAL.LIDER_CDP;
  const lineas: LineaSecundaria[] = [];
  if (cdp.anfitrion_nombre) lineas.push({ icon: User, texto: cdp.anfitrion_nombre });
  if (cdp.direccion) lineas.push({ icon: MapPin, texto: cdp.direccion });
  if (lineas.length === 0) lineas.push({ texto: cdp.etiqueta });

  return {
    key: `${esSublider ? 'SUBLIDER_CDP' : 'LIDER_CDP'}:${iglesiaId}:${cdp.id}`,
    rolUI: esSublider ? 'SUBLIDER_CDP' : 'LIDER_CDP',
    contexto: {
      clave: `${esSublider ? 'SUBLIDER_CDP' : 'LIDER_CDP'}:${iglesiaId}:${cdp.id}`,
      rolUI: esSublider ? 'SUBLIDER_CDP' : 'LIDER_CDP',
      alcance: 'CDP',
      iglesiaId,
      redId: cdp.red_id,
      cdpId: cdp.id,
    },
    titulo: v.titulo,
    icon: v.icon,
    bgIcono: v.bgIcono,
    colorIcono: v.colorIcono,
    lineas,
    vista: { tipo: 'cdp', cdpId: cdp.id, esSublider },
  };
}

export function useOpcionesRolContextuales(): OpcionRolContextual[] | undefined {
  const { contextosDisponibles } = useContextoActivo();
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const iglesiaActiva = iglesias.find((i) => i.id === iglesiaActivaId);
  const esPastor = iglesiaActiva?.es_pastor ?? false;
  const esOperativo = iglesiaActiva?.es_operativo ?? false;
  const esLiderAfirmacion = iglesiaActiva?.es_lider_afirmacion ?? false;
  const { data: roles, isLoading } = useMisRoles(iglesiaActivaId ?? undefined);

  // Mismo caso límite que useOpcionesRol: Super Admin sin iglesia activa no
  // tiene nada que desambiguar vía useMisRoles (la query queda deshabilitada).
  if (esSuperAdmin && !iglesiaActivaId && contextosDisponibles) {
    const v = FILA_ROL_VISUAL.SUPER_ADMIN;
    return [{
      key: 'SUPER_ADMIN', rolUI: 'SUPER_ADMIN', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      contexto: contextosDisponibles[0],
      lineas: [{ texto: 'Administración general del sistema' }],
    }];
  }

  if (isLoading || !roles || !contextosDisponibles) return undefined;

  const opciones: OpcionRolContextual[] = [];

  if (esSuperAdmin) {
    const v = FILA_ROL_VISUAL.SUPER_ADMIN;
    opciones.push({
      key: 'SUPER_ADMIN', rolUI: 'SUPER_ADMIN', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      contexto: { clave: 'SUPER_ADMIN', rolUI: 'SUPER_ADMIN', alcance: 'GLOBAL' },
      lineas: [{ texto: 'Administración general del sistema' }],
    });
  }

  if (esPastor) {
    const v = FILA_ROL_VISUAL.PASTOR;
    opciones.push({
      key: `PASTOR:${iglesiaActivaId}`, rolUI: 'PASTOR', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      contexto: { clave: `PASTOR:${iglesiaActivaId}`, rolUI: 'PASTOR', alcance: 'IGLESIA', iglesiaId: iglesiaActivaId as string },
      lineas: iglesiaActiva?.nombre ? [{ texto: iglesiaActiva.nombre }] : [],
      vista: { tipo: 'pastor' },
    });
  }

  if (esOperativo && iglesiaActivaId) {
    const v = FILA_ROL_VISUAL.SUPERVISOR;
    opciones.push({
      key: `SUPERVISOR:${iglesiaActivaId}`, rolUI: 'SUPERVISOR', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      contexto: { clave: `SUPERVISOR:${iglesiaActivaId}`, rolUI: 'SUPERVISOR', alcance: 'IGLESIA', iglesiaId: iglesiaActivaId },
      lineas: iglesiaActiva?.nombre ? [{ texto: iglesiaActiva.nombre }] : [],
      vista: { tipo: 'supervisor', iglesiaId: iglesiaActivaId },
    });
  }

  for (const red of roles.redes_lider ?? []) {
    const v = FILA_ROL_VISUAL.LIDER_RED;
    const cargoRed = red.es_sublider ? 'SUPERVISOR' : 'LIDER';
    const clave = `${cargoRed === 'SUPERVISOR' ? 'SUPERVISOR_RED' : 'LIDER_RED'}:${iglesiaActivaId}:${red.id}`;
    opciones.push({
      key: clave, rolUI: 'LIDER_RED',
      contexto: {
        clave,
        rolUI: 'LIDER_RED',
        alcance: 'RED',
        iglesiaId: iglesiaActivaId as string,
        redId: red.id,
        cargoRed,
      },
      titulo: red.es_sublider ? 'Supervisor de Red' : v.titulo,
      icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      lineas: [{ texto: red.nombre }],
      colorRed: red.color && red.color.toUpperCase() !== '#FFFFFF' ? red.color : COLOR_RED_NEUTRO,
      vista: { tipo: 'red', redId: red.id },
    });
  }

  for (const cdp of roles.cdp_lider ?? []) opciones.push(construirOpcionCdp(cdp, false, iglesiaActivaId as string));
  for (const cdp of roles.cdp_sublider ?? []) opciones.push(construirOpcionCdp(cdp, true, iglesiaActivaId as string));

  if (esLiderAfirmacion) {
    const v = FILA_ROL_VISUAL.LIDER_DEPARTAMENTO;
    opciones.push({
      key: `LIDER_DEPARTAMENTO:${iglesiaActivaId}:AFIRMACION`, rolUI: 'LIDER_DEPARTAMENTO', titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono,
      contexto: { clave: `LIDER_DEPARTAMENTO:${iglesiaActivaId}:AFIRMACION`, rolUI: 'LIDER_DEPARTAMENTO', alcance: 'DEPARTAMENTO', iglesiaId: iglesiaActivaId as string, departamentoId: null, departamentoCodigo: 'AFIRMACION' },
      lineas: [],
      ruta: ROUTES.AFIRMACION,
    });
  }

  if (iglesiaActiva?.es_lider_jovenes && iglesiaActivaId) {
    const v = FILA_ROL_VISUAL.LIDER_JOVENES;
    opciones.push({ key: `LIDER_JOVENES:${iglesiaActivaId}`, rolUI: 'LIDER_JOVENES', contexto: { clave: `LIDER_JOVENES:${iglesiaActivaId}`, rolUI: 'LIDER_JOVENES', alcance: 'IGLESIA', iglesiaId: iglesiaActivaId }, titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono, lineas: iglesiaActiva.nombre ? [{ texto: iglesiaActiva.nombre }] : [], ruta: ROUTES.JOVENES });
  }

  if (iglesiaActiva?.es_encargado_matrimonios && iglesiaActivaId) {
    const v = FILA_ROL_VISUAL.ENCARGADO_MATRIMONIOS;
    opciones.push({ key: `ENCARGADO_MATRIMONIOS:${iglesiaActivaId}`, rolUI: 'ENCARGADO_MATRIMONIOS', contexto: { clave: `ENCARGADO_MATRIMONIOS:${iglesiaActivaId}`, rolUI: 'ENCARGADO_MATRIMONIOS', alcance: 'IGLESIA', iglesiaId: iglesiaActivaId }, titulo: v.titulo, icon: v.icon, bgIcono: v.bgIcono, colorIcono: v.colorIcono, lineas: iglesiaActiva.nombre ? [{ texto: iglesiaActiva.nombre }] : [], ruta: ROUTES.MATRIMONIOS });
  }

  return opciones
    .map((opcion) => {
      const contexto = contextosDisponibles.find((item) => item.clave === opcion.key);
      return contexto ? { ...opcion, contexto } : null;
    })
    .filter((opcion): opcion is OpcionRolContextual => opcion !== null);
}
