/** 'ASIGNADA' = meta específica de esta CdP (fijada por su Líder de Red);
 * 'ASIGNADA_RED' = heredada de la meta que el Supervisor le asignó a la Red
 * de esta CdP, porque la CdP no tiene una propia; 'PROPIA' = la que fijó la
 * propia Casa de Paz. */
export type OrigenMeta = 'ASIGNADA' | 'ASIGNADA_RED' | 'PROPIA';

export interface TasaEvangelismo {
  evangelizados: number;
  meta: number | null;
  origen: OrigenMeta | null;
  tasa: number | null;
}

/**
 * Meta propia de la Casa de Paz (columna `casa_de_paz.meta_evangelismo`), leída
 * directo -- a diferencia de `TasaEvangelismo.meta`, esta nunca queda oculta
 * cuando hay una meta asignada por un rol superior vigente (fn_meta_efectiva
 * solo devuelve una de las dos). Sirve para que el líder siga viendo y
 * editando su propia preferencia aunque la efectiva sea la asignada.
 */
export interface MetaPropia {
  meta_evangelismo: number | null;
}

export interface TipoEvangelismo {
  id: string;
  codigo: string;
  nombre: string;
  color: string;
}

export interface Evangelizado {
  id: string;
  persona_id: string;
  nombre_completo: string;
  fecha: string;
  domicilio: string | null;
  evangelizado_por_id: string | null;
  tipo_evangelismo_nombre: string | null;
  tipo_evangelismo_color: string | null;
}

/** Evangelizado agregado de toda la Red (fn_evangelismo_red) -- mismo shape
 * que Evangelizado, más a qué CdP pertenece, para agrupar el calendario y la
 * lista por Casa de Paz. */
export interface EvangelizadoRed {
  id: string;
  casa_de_paz_id: string;
  casa_de_paz_etiqueta: string;
  persona_id: string;
  nombre_completo: string;
  fecha: string;
  domicilio: string | null;
  tipo_evangelismo_nombre: string | null;
  tipo_evangelismo_color: string | null;
}

/** Tasa agregada de toda la Red (fn_tasa_evangelismo_red). */
export interface TasaEvangelismoRed {
  evangelizados: number;
  meta_total: number;
  cdp_con_meta: number;
  cdp_total: number;
  tasa: number | null;
}

/** Meta efectiva actual de una CdP de la Red (fn_metas_cdp_red), para la
 * lista de "Metas por Casa de Paz" que arma el Líder de Red. */
export interface MetaCdpRed {
  casa_de_paz_id: string;
  etiqueta: string;
  meta: number | null;
  origen: OrigenMeta | null;
}

export interface NuevaMetaAsignada {
  iglesiaId: string;
  casaDePazId: string;
  asignadorId: string;
  meta: number;
  fechaInicio: string;
  fechaFin: string;
  observaciones?: string;
}

/** Meta que el Supervisor le asigna a una Red completa (no a una CdP puntual) --
 * vigente mientras dure el rango, se hereda hacia cada CdP de esa Red que no
 * tenga ya su propia meta asignada por su Líder de Red (fn_meta_efectiva). */
export interface MetaRedAsignada {
  meta: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface NuevaMetaAsignadaRed {
  iglesiaId: string;
  redId: string;
  asignadorId: string;
  meta: number;
  fechaInicio: string;
  fechaFin: string;
  observaciones?: string;
}

export interface NuevoEvangelizado {
  casa_de_paz_id: string;
  iglesia_id: string;
  fecha: string;
  domicilio?: string;
  observaciones?: string;
  persona_id?: string;
  primer_nombre?: string;
  primer_apellido?: string;
  sexo?: 'M' | 'F';
  /** Ambos opcionales — solo se usan al crear una persona nueva (sin persona_id). */
  telefono?: string;
  fecha_nacimiento?: string;
  tipo_evangelismo_id?: string;
}
