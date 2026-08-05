export type TipoNodoEstructura =
  | 'PASTOR_SLOT'
  | 'SUPERVISOR_SLOT'
  | 'GRUPO_DEPARTAMENTOS'
  | 'DEPARTAMENTO'
  | 'GRUPO_REDES'
  | 'RED'
  | 'CASA_DE_PAZ';

export interface PersonaEstructura {
  id: string;
  nombre: string | null;
  correo: string | null;
  etiqueta: string;
  membresiaPendiente: boolean;
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
}

export interface CasaDePazEstructura {
  id: string;
  nombre: string | null;
  redId: string | null;
  lideres: PersonaEstructura[];
  sublideres: PersonaEstructura[];
  anfitriones: PersonaEstructura[];
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
}
