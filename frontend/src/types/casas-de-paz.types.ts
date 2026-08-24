export interface RedResumen {
  id: string;
  nombre: string;
  activo: boolean;
  color: string | null;
  lider_nombre: string | null;
  encargado_departamentos_nombre: string | null;
  encargado_ministerio_nombre: string | null;
  cantidad_cdp: number;
  incompleta: boolean;
}

export type ModalidadCdp = 'PRESENCIAL' | 'VIRTUAL';

export interface CdpResumen {
  id: string;
  etiqueta: string;
  activo: boolean;
  modalidad: ModalidadCdp;
  red_id: string | null;
  red_nombre: string | null;
  lider_id: string | null;
  lider_nombre: string | null;
  anfitrion_id: string | null;
  anfitrion_nombre: string | null;
  sublideres_count: number;
  miembros_count: number;
  dia_reunion: number | null;
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
  fecha_inicio: string;
  correo: string | null;
}

/** KAN-34: fila del Histórico Anual de Casas de Paz eliminadas. */
export interface CdpHistoricoEliminada {
  id: string;
  etiqueta: string;
  red_nombre: string | null;
  lider_nombre: string | null;
  fecha_creacion: string;
  fecha_eliminacion: string;
  eliminado_por_nombre: string | null;
  motivo_eliminacion: string | null;
}

export interface Ciudad {
  id: string;
  codigo: string;
  nombre: string;
}

export interface DomicilioCdp {
  asignacion_id: string;
  direccion_id: string;
  ciudad_id: string;
  ciudad_nombre: string;
  zona: string | null;
  calle: string | null;
  numero: string | null;
  referencia: string | null;
  url_gps: string | null;
}

export interface DatosDomicilioCdp {
  ciudadId: string;
  zona: string | null;
  calle: string | null;
  numero: string | null;
  referencia: string | null;
  url_gps: string | null;
}

/** Todo lo que se pide al crear una Casa de Paz: ya sale con líder, gente y lugar de reunión definidos. */
export interface DatosNuevaCdp {
  liderId: string;
  sublideresIds: string[];
  anfitrionId?: string;
  modalidad: ModalidadCdp;
  diaReunion: number | null;
  horaReunion: string | null;
  domicilio?: DatosDomicilioCdp;
}

/** Resumen del Perfil de Casa de Paz (fn_mi_cdp_perfil). */
export interface CdpPerfil {
  nombre: string;
  activo: boolean;
  modalidad: ModalidadCdp;
  fecha_creacion: string;
  /** 0=domingo … 6=sábado (getDay()), o null si no se definió. */
  dia_reunion: number | null;
  /** 'HH:MM:SS' o null. */
  hora_reunion: string | null;
  red_nombre: string | null;
}
