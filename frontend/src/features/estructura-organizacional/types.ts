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
  nombre: string;
}

export interface DepartamentoEstructura {
  id: string;
  codigo: string;
  nombre: string;
}

export interface RedEstructura {
  id: string;
  nombre: string;
  color: string;
}

export interface CasaDePazEstructura {
  id: string;
  nombre: string | null;
  redId: string | null;
}

export interface EstructuraOrganizacionalDatos {
  iglesia: {
    id: string;
    nombre: string;
  };
  pastor: PersonaEstructura | null;
  supervisor: PersonaEstructura | null;
  departamentos: DepartamentoEstructura[];
  redes: RedEstructura[];
  casasDePaz: CasaDePazEstructura[];
}

export interface DatosNodoEstructura extends Record<string, unknown> {
  tipo: TipoNodoEstructura;
  titulo: string;
  subtitulo?: string;
  color?: string;
  buscable: string;
  resaltado?: boolean;
}
