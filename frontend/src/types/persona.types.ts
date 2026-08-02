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

/**
 * Version simple (owner, 2026-08-02): solo el nivel mas alto de discipulado
 * completado. El modulo completo (7 cursos con inscripcion/fecha de
 * completado, retiros con prerrequisitos) es el Modulo 4 documentado en
 * harness/99-modulos-futuros.md, todavia no construido.
 */
export type DiscipuladoNivel =
  | 'FUNDAMENTOS_VIDA_REINO'
  | 'CARACTER_CRISTO_1'
  | 'CARACTER_CRISTO_2'
  | 'FAMILIA_FELIZ'
  | 'PODER_IDENTIDAD_HIJO'
  | 'LIDERES_CASAS_DE_PAZ'
  | 'MENTORES_DEL_REINO';

export const DISCIPULADO_NIVEL_LABELS: Record<DiscipuladoNivel, string> = {
  FUNDAMENTOS_VIDA_REINO: '1. Fundamentos de Vida del Reino',
  CARACTER_CRISTO_1: '2. Carácter de Cristo 1',
  CARACTER_CRISTO_2: '3. Carácter de Cristo 2',
  FAMILIA_FELIZ: '4. Familia Feliz',
  PODER_IDENTIDAD_HIJO: '5. Poder de Identidades como Hijo',
  LIDERES_CASAS_DE_PAZ: '6. Líderes de Casas de Paz',
  MENTORES_DEL_REINO: '7. Mentores del Reino',
};

export type MilagroCategoria =
  | 'SANIDAD_FISICA'
  | 'SANIDAD_EMOCIONAL'
  | 'PROVISION'
  | 'LIBERACION'
  | 'RESTAURACION_FAMILIAR'
  | 'OTRO';

export const MILAGRO_CATEGORIA_LABELS: Record<MilagroCategoria, string> = {
  SANIDAD_FISICA: 'Sanidad física',
  SANIDAD_EMOCIONAL: 'Sanidad emocional',
  PROVISION: 'Provisión',
  LIBERACION: 'Liberación',
  RESTAURACION_FAMILIAR: 'Restauración familiar',
  OTRO: 'Otro',
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

export interface ProcedenciaItem {
  casa_de_paz_id: string;
  etiqueta: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  vigente: boolean;
  /** La salida de esta CdP fue por una fusión vigente que la tuvo como origen. */
  por_fusion: boolean;
  motivo: string | null;
}

/** Fila del roster de "Personas" del Líder de Red — solo lectura, scopeada a la Red. */
export interface PersonaDeRed {
  persona_id: string;
  nombre_completo: string;
  sexo: Sexo;
  edad: number | null;
  estado_sigla: string | null;
  estado_nombre: string | null;
  casa_de_paz_id: string;
  casa_de_paz_etiqueta: string;
  lider_nombre: string | null;
  sublider_nombre: string | null;
  fecha_ingreso: string | null;
  /** Historial de CdP por las que pasó, de la más antigua a la actual. */
  procedencia: ProcedenciaItem[];
  proviene_de_fusion: boolean;
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
  /** Version simple del Modulo 3 (Afirmacion) -- ver DiscipuladoNivel. */
  fecha_bautizo: string | null;
  fecha_retiro: string | null;
  discipulado_nivel: DiscipuladoNivel | null;
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

/** Ministerios donde la persona participa o lidera -- puede liderar varios a la vez. */
export interface MinisterioDePersona {
  ministerio_id: string;
  nombre: string;
  es_lider: boolean;
}

/** Dato de origen, solo lectura: cuándo y cómo fue evangelizada esta persona (si entró por ese camino). */
export interface EvangelismoDeOrigen {
  fecha: string;
  tipo_evangelismo_nombre: string | null;
  evangelizado_por_nombre: string | null;
  casa_de_paz_etiqueta: string | null;
}

export interface MilagroFicha {
  id: string;
  categoria: MilagroCategoria;
  detalle: string;
  fecha: string;
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
  ministerios: MinisterioDePersona[];
  evangelismo: EvangelismoDeOrigen | null;
  milagros: MilagroFicha[];
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
