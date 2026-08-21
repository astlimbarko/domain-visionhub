import type { DatosMembresiaExtendida } from './membresia-extendida.types';

export interface CamposObligatorios {
  ci: boolean;
  fecha_nacimiento: boolean;
  ocupacion: boolean;
  grado_instruccion: boolean;
}

export type ResolverUrlRegistroResponse =
  | { admite_registro: false }
  | {
      admite_registro: true;
      lider_nombre: string;
      casa_de_paz_nombre: string;
      red_nombre: string | null;
      iglesia_nombre: string;
      campos_obligatorios: CamposObligatorios;
    };

// Espejo de estado_civil_enum (harness/11-esquema-bd/sql/01_enums.sql)
export type EstadoCivil = 'SOLTERO' | 'CASADO' | 'VIUDO' | 'DIVORCIADO';

// Espejo de grado_instruccion_enum
export type GradoInstruccion =
  | 'SIN_INSTRUCCION'
  | 'PRIMARIA_INCOMPLETA'
  | 'PRIMARIA_COMPLETA'
  | 'SECUNDARIA_INCOMPLETA'
  | 'SECUNDARIA_COMPLETA'
  | 'TECNICO_MEDIO'
  | 'TECNICO_SUPERIOR'
  | 'LICENCIATURA_INGENIERIA'
  | 'DIPLOMADO'
  | 'MAESTRIA'
  | 'DOCTORADO';

// KAN-123: extiende con los campos ampliados (Discipulados/Seminario/
// Universidad/Mentor/Bautismo/Familia) -- Ministerios queda fuera del flujo
// público a propósito, ver membresia-extendida.types.ts.
export interface DatosRegistroPublico extends DatosMembresiaExtendida {
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
  nacimiento_ciudad?: string;
}

export interface RegistrarPersonaViaUrlResponse {
  persona_id: string;
  nombre_completo: string;
  casa_de_paz_nombre: string;
}
