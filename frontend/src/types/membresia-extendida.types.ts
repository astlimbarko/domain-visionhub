// KAN-123: campos ampliados de Membresía, compartidos por los 3 flujos de
// alta (registro público por URL, completar Membresía por invitación,
// registro interno de Afirmación) vía CamposMembresiaExtendidaFields +
// fn_guardar_membresia_extendida (harness/17-membresia-ampliada).

// Espejo de precision_fecha_enum (supabase/migrations, KAN-123 Q-4).
export type PrecisionFecha = 'EXACTA' | 'APROXIMADA' | 'SOLO_MES_ANIO' | 'SOLO_ANIO';

export const OPCIONES_PRECISION_FECHA: { value: PrecisionFecha; label: string }[] = [
  { value: 'EXACTA', label: 'Fecha exacta' },
  { value: 'APROXIMADA', label: 'Fecha aproximada' },
  { value: 'SOLO_MES_ANIO', label: 'Solo mes y año' },
  { value: 'SOLO_ANIO', label: 'Solo año' },
];

// tipo_discipulado (catálogo global, KAN-123 Q-1) — se lee siempre vía
// fn_listar_tipos_discipulado (anon-safe), nunca se hardcodea en el frontend.
export interface TipoDiscipulado {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
}

export interface FechaConPrecision {
  anio?: number;
  mes?: number;
  dia?: number;
  precision_fecha?: PrecisionFecha;
}

export interface DiscipuladoSeleccionado extends FechaConPrecision {
  tipo_discipulado_id: string;
}

// Espejo de tipo_relacion (harness/02-persona-parentela, seed_01_catalogos_globales.sql)
// -- catálogo estable de 12 valores, mismo criterio de "mirror hardcodeado"
// que ya usa este proyecto para estado_civil_enum/grado_instruccion_enum
// (ver registro-publico.types.ts), para no depender de una lectura anon-safe
// nueva solo para esto.
export const TIPOS_RELACION_FAMILIA: { codigo: string; label: string }[] = [
  { codigo: 'PADRE', label: 'Padre/Madre' },
  { codigo: 'HIJO', label: 'Hijo/Hija' },
  { codigo: 'ABUELO', label: 'Abuelo/Abuela' },
  { codigo: 'NIETO', label: 'Nieto/Nieta' },
  { codigo: 'HERMANO', label: 'Hermano/Hermana' },
  { codigo: 'TIO', label: 'Tío/Tía' },
  { codigo: 'SOBRINO', label: 'Sobrino/Sobrina' },
  { codigo: 'PRIMO', label: 'Primo/Prima' },
  { codigo: 'CUNADO', label: 'Cuñado/Cuñada' },
  { codigo: 'SUEGRO', label: 'Suegro/Suegra' },
  { codigo: 'YERNO', label: 'Yerno/Nuera' },
];

export interface FamiliarInput {
  tipo_relacion_codigo: string;
  nombre_familiar: string;
  es_miembro: boolean;
}

// Shape exacto que espera fn_guardar_membresia_extendida (p_datos). Todos los
// campos son opcionales: el formulario ampliado nunca bloquea el envío por
// estos grupos, solo los de Identidad/Censo (CamposMembresiaFields) siguen
// obligatorios como antes.
export interface DatosMembresiaExtendida {
  discipulados?: DiscipuladoSeleccionado[];

  seminario?: boolean;
  seminario_anio?: number;
  seminario_mes?: number;
  seminario_dia?: number;
  seminario_precision_fecha?: PrecisionFecha;

  universidad?: boolean;
  universidad_anio?: number;
  universidad_mes?: number;
  universidad_dia?: number;
  universidad_precision_fecha?: PrecisionFecha;

  // Mentor (KAN-123 Q-5): sin catálogo/cargo nuevo -- texto libre +
  // casillero autodeclarado "es miembro de la iglesia".
  mentor?: boolean;
  mentor_nombre_txt?: string;
  mentor_es_miembro?: boolean;

  bautizado?: boolean;
  bautizado_en_nuestra_iglesia?: boolean;
  bautismo_anio?: number;
  bautismo_mes?: number;
  bautismo_dia?: number;
  bautismo_precision_fecha?: PrecisionFecha;

  // Cónyuge + Familia (KAN-123 §6/§7, Q-6): un único arreglo, el cónyuge es
  // simplemente el primer elemento con tipo_relacion_codigo = 'CONYUGE'.
  familiares?: FamiliarInput[];

  // Ministerios: se omite a propósito en el flujo público anónimo (KAN-125)
  // -- no hay forma anon-safe de listar los ministerios de una iglesia
  // puntual todavía. Solo se manda en los flujos autenticados.
  ministerios?: string[];

  // Censo de cargos (plan panel Afirmación 2026-08-20, punto 4/4). Campo
  // puramente informativo/autodeclarado -- nunca toca persona_cargo,
  // red_cargo, casa_de_paz_cargo ni departamento_cargo (esas son las tablas
  // operativas reales, con sus propias reglas de exclusividad y permisos).
  // efesio_tipo undefined = "Ninguno". cargo_* son independientes entre sí.
  // rango_miembro solo aplica si la persona no marcó ningún cargo -- ver
  // SeccionCargoRangoMembresia.
  efesio_tipo?: EfesioTipo;
  cargo_ministro?: boolean;
  cargo_anciano?: boolean;
  cargo_diacono?: boolean;
  cargo_mentor?: boolean;
  cargo_sub_mentor?: boolean;
  cargo_lider_cdp?: boolean;
  cargo_sublider_cdp?: boolean;
  rango_miembro?: RangoMiembro;
}

export const DATOS_MEMBRESIA_EXTENDIDA_VACIO: DatosMembresiaExtendida = {};

export type EfesioTipo = 'APOSTOL' | 'PROFETA' | 'PASTOR' | 'EVANGELISTA' | 'MAESTRO';

export const OPCIONES_EFESIO: { value: EfesioTipo; label: string }[] = [
  { value: 'APOSTOL', label: 'Apóstol' },
  { value: 'PROFETA', label: 'Profeta' },
  { value: 'PASTOR', label: 'Pastor' },
  { value: 'EVANGELISTA', label: 'Evangelista' },
  { value: 'MAESTRO', label: 'Maestro' },
];

export type RangoMiembro = 'DISCIPULO' | 'AFIRMADO' | 'CREYENTE';

export const OPCIONES_RANGO_MIEMBRO: { value: RangoMiembro; label: string; descripcion: string }[] = [
  { value: 'CREYENTE', label: 'Creyente', descripcion: 'Solo asiste a los servicios y Casas de Paz' },
  { value: 'DISCIPULO', label: 'Discípulo', descripcion: 'Tiene un mentor y asiste a un discipulado' },
  { value: 'AFIRMADO', label: 'Afirmado', descripcion: 'Es bautizado o fue al retiro SIL (Sanidad Interior y Liberación)' },
];

// KAN-126 (fn_mi_membresia_incompleta): superset de InvitacionPendiente
// (invitacion-lider.types.ts) -- acá `rol` cubre cualquier rol_sistema_enum
// (no solo LIDER_RED/LIDER_CDP/SUBLIDER_CDP) y `destino` puede venir null
// cuando el rol no vino de una invitación concreta (Q-8).
export interface MembresiaIncompleta {
  id: string | null;
  rol: string | null;
  iglesia_nombre: string;
  destino: string | null;
  departamento_nombre?: string | null;
  campos_obligatorios: {
    ci: boolean;
    fecha_nacimiento: boolean;
    ocupacion: boolean;
    grado_instruccion: boolean;
  };
  /** KAN-179: solo en el caso general (id === null) -- guardado progresivo.
   * paso_actual es la última página guardada (1-indexed); datos_guardados
   * trae lo ya tipeado (página 1 + borrador de las páginas 2-4 combinado)
   * para precargar el formulario en vez de arrancar de cero. */
  paso_actual?: number;
  datos_guardados?: Record<string, unknown> | null;
}
