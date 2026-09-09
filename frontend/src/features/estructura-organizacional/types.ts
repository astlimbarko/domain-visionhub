export type TipoNodoEstructura =
  | 'PASTOR_SLOT'
  | 'SUPERVISOR_SLOT'
  | 'GRUPO_DEPARTAMENTOS'
  | 'DEPARTAMENTO'
  | 'GRUPO_REDES'
  | 'RED'
  | 'CASA_DE_PAZ'
  | 'NUEVA_CASA_DE_PAZ';

export interface PersonaEstructura {
  id: string;
  nombre: string | null;
  nombreAbreviado?: string;
  correo: string | null;
  etiqueta: string;
  membresiaPendiente: boolean;
  invitacionId?: string | null;
}

/** KAN-263: entidad sobre la que se pide reenviar la invitación/recordatorio
 * a alguien con membresía incompleta -- exactamente una de las 4 debe venir
 * con valor, igual que el body de notificar-asignacion-cargo (Edge
 * Function). Se usa cuando el responsable NO tiene invitacionId (ya es una
 * Persona real, no un placeholder de invitación todavía pendiente). */
export interface EntidadReenvioInvitacion {
  redId?: string;
  cdpId?: string;
  departamentoId?: string;
  iglesiaId?: string;
  personaId: string;
}

export interface DepartamentoEstructura {
  id: string;
  codigo: string;
  nombre: string;
  color?: string | null;
  colorNombre?: string | null;
  lideres: PersonaEstructura[];
}

export interface RedEstructura {
  id: string;
  nombre: string;
  color: string | null;
  lideres: PersonaEstructura[];
  supervisores: PersonaEstructura[];
  eliminada: boolean;
}

export interface CasaDePazEstructura {
  id: string;
  nombre: string | null;
  redId: string | null;
  lideres: PersonaEstructura[];
  sublideres: PersonaEstructura[];
  anfitriones: PersonaEstructura[];
  direccionBreve: string | null;
  eliminada: boolean;
}

export interface EstructuraOrganizacionalDatos {
  iglesia: {
    id: string;
    nombre: string;
  };
  pastores: PersonaEstructura[];
  supervisores: PersonaEstructura[];
  departamentos: DepartamentoEstructura[];
  redes: RedEstructura[];
  casasDePaz: CasaDePazEstructura[];
  layout: {
    disponible: boolean;
    version: number;
    otpRequerido: boolean;
    posiciones: PosicionNodoEstructura[];
  };
}

export interface PosicionNodoEstructura {
  nodo_clave: string;
  posicion_x: number;
  posicion_y: number;
}

export interface PosicionNodoGuardar extends PosicionNodoEstructura {
  tipo_nodo: TipoNodoEstructura;
  entidad_id: string | null;
}

export interface DatosNodoEstructura extends Record<string, unknown> {
  tipo: TipoNodoEstructura;
  titulo: string;
  subtitulo?: string;
  etiquetaRol?: string;
  responsables?: PersonaEstructura[];
  supervisores?: PersonaEstructura[];
  color?: string;
  ancho?: number;
  alto?: number;
  buscable: string;
  resaltado?: boolean;
  estadoIncompleto?: boolean;
  eliminada?: boolean;
  redId?: string;
  sublideres?: PersonaEstructura[];
  /** KAN-339: solo en nodos DEPARTAMENTO -- código estable para el menú de
   * "Visualizar" (atajo al panel real o modo lectura, según el rol). */
  departamentoCodigo?: string;
  /** KAN-339: true cuando el usuario actual (Pastor/Supervisor/Super Admin)
   * puede abrir este Departamento desde el menú de 3 puntos de la tarjeta. */
  puedeVisualizarDepartamento?: boolean;
  /** KAN-339: navega al panel real (Pastor/Supervisor) o dispara el modo
   * lectura sintético (Super Admin) -- solo presente si
   * `puedeVisualizarDepartamento` es true. */
  onVisualizarDepartamento?: () => void;
}
export interface PersonaOpcionEstructura {
  id: string;
  nombre: string;
  correo: string | null;
  iglesiaId: string;
  iglesiaNombre: string;
}

export type CargoRedEstructura = 'LIDER_RED' | 'SUBLIDER_RED';

export interface CrearRedEstructuraEntrada {
  iglesiaId: string;
  nombre: string;
  color: string;
  liderPersonaId?: string | null;
  supervisorPersonaId?: string | null;
  otp?: string | null;
}
