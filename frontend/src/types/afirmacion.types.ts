import type { EstadoCivil, GradoInstruccion } from '@/types/registro-publico.types';
import type { DatosMembresiaExtendida } from '@/types/membresia-extendida.types';

export interface LiderCdpAfirmacion {
  casa_de_paz_cargo_id: string;
  persona_id: string;
  lider_nombre: string;
  casa_de_paz_id: string;
  cdp_etiqueta: string;
  red_nombre: string | null;
}

// KAN-123: extiende con los campos ampliados, incluye Ministerios (flujo
// autenticado, iglesia ya resuelta -- a diferencia del registro público).
export interface DatosPersonaAfirmacion extends DatosMembresiaExtendida {
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  sexo: 'M' | 'F';
  fecha_nacimiento?: string;
  ci?: string;
  correo?: string;
  estado_civil?: EstadoCivil;
  ocupacion?: string;
  grado_instruccion?: GradoInstruccion;
}

export interface RegistrarPersonaAfirmacionResponse {
  persona_id: string;
  nombre_completo: string;
  casa_de_paz_nombre: string;
}

export type EstadoUrl = 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';

export interface CasaPazUrlAfirmacion {
  url_id: string;
  slug: string;
  estado: EstadoUrl;
  lider_cdp_nombre: string;
  casa_de_paz_id: string;
  casa_de_paz_etiqueta: string;
  red_id: string | null;
  red_nombre: string | null;
  lider_red_nombre: string | null;
}

export interface SetEstadoUrlOmitida {
  id: string;
  motivo: 'NO_ENCONTRADA' | 'SIN_PERMISO' | 'LIDER_CDP_NO_VIGENTE';
}

export interface SetEstadoUrlResponse {
  actualizadas: number;
  omitidas: SetEstadoUrlOmitida[];
}

// KAN-127: todas las Casas de Paz de la iglesia (con o sin líder vigente),
// a diferencia de LiderCdpAfirmacion/CasaPazUrlAfirmacion que solo cubren
// las que tienen líder de CdP vigente (ese es su caso de uso puntual).
export interface CasaDePazAfirmacion {
  casa_de_paz_id: string;
  casa_de_paz_etiqueta: string;
  activo: boolean;
  red_id: string | null;
  red_nombre: string | null;
  lider_red_nombre: string | null;
  lider_cdp_nombre: string | null;
  tiene_lider_vigente: boolean;
}

// Plan panel Afirmación 2026-08-20, punto 1/4.
export interface EstadisticasRegistroAfirmacion {
  por_url: number;
  por_formulario: number;
}

// Plan panel Afirmación 2026-08-20, punto 3/4. Claves de por_estado: sigla de
// `estado` (SIM/NC/CRE/RE/DA/DI) o 'SIN_ESTADO'.
export interface EstadisticasPersonasAfirmacion {
  total: number;
  hombres: number;
  mujeres: number;
  por_estado: Record<string, number>;
}
