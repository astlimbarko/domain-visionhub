export type Sexo = 'M' | 'F';
export type EstadoCivil = 'SOLTERO' | 'CASADO' | 'VIUDO' | 'DIVORCIADO';
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

export const ESTADO_CIVIL_LABELS: Record<EstadoCivil, string> = {
  SOLTERO: 'Soltero/a',
  CASADO: 'Casado/a',
  VIUDO: 'Viudo/a',
  DIVORCIADO: 'Divorciado/a',
};

export const GRADO_INSTRUCCION_LABELS: Record<GradoInstruccion, string> = {
  SIN_INSTRUCCION: 'Sin instrucción',
  PRIMARIA_INCOMPLETA: 'Primaria incompleta',
  PRIMARIA_COMPLETA: 'Primaria completa',
  SECUNDARIA_INCOMPLETA: 'Secundaria incompleta',
  SECUNDARIA_COMPLETA: 'Secundaria completa',
  TECNICO_MEDIO: 'Técnico medio',
  TECNICO_SUPERIOR: 'Técnico superior',
  LICENCIATURA_INGENIERIA: 'Licenciatura/Ingeniería',
  DIPLOMADO: 'Diplomado',
  MAESTRIA: 'Maestría',
  DOCTORADO: 'Doctorado',
};

export interface PersonaResultadoBusqueda {
  id: string;
  nombre_completo: string;
  sexo: Sexo;
  fecha_nacimiento: string | null;
  edad: number | null;
  ci: string | null;
  correo: string | null;
  oculto: boolean;
  estado_sigla: string | null;
  estado_nombre: string | null;
  casa_de_paz_id: string | null;
  casa_de_paz_etiqueta: string | null;
  telefono_principal: string | null;
}

export interface NuevaPersona {
  iglesia_id: string;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  sexo: Sexo;
  fecha_nacimiento?: string | null;
  ci?: string | null;
  correo?: string | null;
}

export interface DatosIdentidad {
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  apellido_casada: string | null;
  mostrar_apellido_casada: boolean;
  sexo: Sexo;
  fecha_nacimiento: string | null;
  ci: string | null;
  correo: string | null;
}

export interface DatosCensales {
  nacimiento_ciudad: string | null;
  estado_civil: EstadoCivil | null;
  grado_instruccion: GradoInstruccion | null;
  ocupacion: string | null;
}

export interface DireccionFicha {
  asignacion_id: string;
  direccion_id: string;
  ciudad: string | null;
  zona: string | null;
  anillo: string | null;
  calle: string | null;
  numero: string | null;
  referencia: string | null;
  url_gps: string | null;
  observaciones: string | null;
  es_principal: boolean;
  activo: boolean;
}

export interface TelefonoFicha {
  asignacion_id: string;
  telefono_id: string;
  tipo_codigo: string;
  tipo_nombre: string;
  numero: string;
  observaciones: string | null;
  es_principal: boolean;
  activo: boolean;
}

export interface LlegadaFicha {
  id: string;
  motivo_codigo: string;
  motivo_nombre: string;
  fecha_ingreso: string;
  invitado_por_id: string | null;
  invitado_por_nombre: string | null;
  invitado_por_txt: string | null;
  comentarios: string | null;
}

export interface FamiliaFicha {
  id: string;
  familiar_id: string;
  familiar_nombre: string;
  tipo_codigo: string;
  tipo_nombre: string;
}

export interface ReferenciaFamiliarFicha {
  id: string;
  nombre_familiar: string;
  tipo_codigo: string;
  tipo_nombre: string;
}

export interface CargoFicha {
  ambito: 'IGLESIA' | 'RED' | 'CDP';
  entidad: string;
  cargo_codigo: string;
  cargo_nombre: string;
}

export interface PersonaFicha {
  persona: {
    id: string;
    iglesia_id: string;
    primer_nombre: string;
    segundo_nombre: string | null;
    primer_apellido: string;
    segundo_apellido: string | null;
    apellido_casada: string | null;
    mostrar_apellido_casada: boolean;
    nombre_completo: string;
    sexo: Sexo;
    fecha_nacimiento: string | null;
    edad: number | null;
    ci: string | null;
    correo: string | null;
    oculto: boolean;
    sugerencia_apellido_casada: string | null;
  };
  detalle: DatosCensales | null;
  direcciones: DireccionFicha[];
  telefonos: TelefonoFicha[];
  llegadas: LlegadaFicha[];
  familia: FamiliaFicha[];
  referencias_familiares: ReferenciaFamiliarFicha[];
  estado_actual: { sigla: string; nombre: string; fecha_inicio: string } | null;
  casa_de_paz: { id: string; etiqueta: string; red_id: string | null; red_nombre: string | null } | null;
  cargos: CargoFicha[];
}

export interface TipoRelacion {
  id: string;
  codigo: string;
  nombre: string;
}

export interface TipoTelefono {
  id: string;
  codigo: string;
  nombre: string;
}

export interface MotivoLlegada {
  id: string;
  codigo: string;
  nombre: string;
}
