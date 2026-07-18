export interface RedResumen {
  id: string;
  nombre: string;
  activo: boolean;
  lider_nombre: string | null;
  encargado_departamentos_nombre: string | null;
  encargado_ministerio_nombre: string | null;
  cantidad_cdp: number;
  incompleta: boolean;
}

export interface CdpResumen {
  id: string;
  etiqueta: string;
  activo: boolean;
  red_id: string | null;
  red_nombre: string | null;
  lider_nombre: string | null;
  anfitrion_nombre: string | null;
  sublideres_count: number;
  miembros_count: number;
}

export interface PersonaBusqueda {
  id: string;
  nombre_completo: string;
}

export type CargoRedCodigo = 'LIDER_RED' | 'SUBLIDER_RED' | 'ENCARGADO_DEPARTAMENTOS_RED' | 'ENCARGADO_MINISTERIO_RED';
export type CargoCdpCodigo = 'LIDER_CDP' | 'SUBLIDER_CDP' | 'ANFITRION';

export interface CargoVigente {
  id: string;
  persona_id: string;
  nombre_completo: string;
}
