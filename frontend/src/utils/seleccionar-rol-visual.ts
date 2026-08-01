/**
 * Configuración visual centralizada para las filas de la pantalla
 * "Seleccionar rol" (rediseño 2026-08-01, referencia login_multi_rol.jpeg).
 *
 * Ortogonal a `ROL_UI_META` (permisos.ts): esa config decide qué opciones
 * son válidas y las usa además el menú "Cambiar rol" de AppShell -- esta
 * config es solo apariencia (ícono, color) para esta pantalla puntual, sin
 * tocar la fuente de verdad de permisos/roles.
 */
import type { LucideIcon } from 'lucide-react';
import { HeartHandshake, Home, Settings, Share2, ShieldCheck, UserPlus } from 'lucide-react';
import type { RolUI } from '@/utils/permisos';

export type FilaRolKind = Extract<RolUI, 'SUPER_ADMIN' | 'PASTOR' | 'SUPERVISOR' | 'LIDER_RED' | 'LIDER_CDP' | 'SUBLIDER_CDP' | 'LIDER_DEPARTAMENTO'>;

export interface FilaRolVisual {
  titulo: string;
  icon: LucideIcon;
  /** Fondo suave del círculo del ícono. */
  bgIcono: string;
  /** Color del ícono y acentos (flecha, número del encabezado). */
  colorIcono: string;
}

export const FILA_ROL_VISUAL: Record<FilaRolKind, FilaRolVisual> = {
  SUPER_ADMIN: { titulo: 'Super Admin', icon: ShieldCheck, bgIcono: '#e7ebf3', colorIcono: '#3a5a8c' },
  PASTOR: { titulo: 'Pastor', icon: HeartHandshake, bgIcono: '#fdf1e3', colorIcono: '#b9772e' },
  SUPERVISOR: { titulo: 'Supervisor de la Visión en Acción', icon: Settings, bgIcono: '#e9e7fb', colorIcono: '#5856d6' },
  LIDER_RED: { titulo: 'Líder de Red', icon: Share2, bgIcono: '#e1f5ee', colorIcono: '#1f9d63' },
  LIDER_CDP: { titulo: 'Líder de Casa de Paz', icon: Home, bgIcono: '#e3f0fd', colorIcono: '#2563eb' },
  SUBLIDER_CDP: { titulo: 'Sublíder de Casa de Paz', icon: Home, bgIcono: '#e3f6fb', colorIcono: '#0891b2' },
  // Hoy solo Afirmación es funcional (DEPARTAMENTO_FUNCIONAL, utils/departamentos.ts) --
  // título específico en vez del genérico "Líder de Departamento" de ROL_UI_META.
  LIDER_DEPARTAMENTO: { titulo: 'Líder del Departamento de Afirmación', icon: UserPlus, bgIcono: '#e9e4fb', colorIcono: '#7c3aed' },
};

/** Color neutro de respaldo para el punto de Red cuando no tiene color configurado (default '#FFFFFF' en BD). */
export const COLOR_RED_NEUTRO = '#9ca3af';
