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
  /** Para distinguir "Semilla" (conteo agregado) de personas reales en la
   * Tendencia (KAN-285) -- ver TendenciaEvangelismo.tsx. */
  tipo_evangelismo_codigo: string | null;
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

/** Fila de la tabla "Personas evangelizadas" (fn_buscar_evangelizados) --
 * roster de toda la iglesia con filtros, para Supervisor/Pastor/Departamento
 * de Evangelismo. `total` viene repetido en cada fila (window function),
 * mismo patrón que `fn_buscar_personas`. */
export interface EvangelizadoBusqueda {
  id: string;
  persona_id: string;
  nombre_completo: string;
  /** Pedazos sueltos del nombre -- KAN-350 (2026-09-08), para armar el
   * nombre en 2 líneas (nombres arriba, apellidos abajo) en la tabla
   * desktop sin tener que parsear `nombre_completo`. */
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  fecha: string;
  domicilio: string | null;
  telefono_principal: string | null;
  red_id: string | null;
  red_nombre: string | null;
  casa_de_paz_id: string;
  casa_de_paz_etiqueta: string;
  tipo_evangelismo_nombre: string | null;
  tipo_evangelismo_color: string | null;
  /** Nombre de quien evangelizó (persona.evangelizado_por_id) -- KAN-338, columna
   * existe desde el diseño original pero nunca se llenaba ni se mostraba. */
  evangelizado_por_nombre: string | null;
  /** Pedazos sueltos del evangelizador -- KAN-350 (2026-09-08), para la
   * abreviación de nombre en la columna "Evangelizado por" de la tabla
   * desktop (nombres cortos se muestran completos, largos se abrevian). */
  evangelizado_por_primer_nombre: string | null;
  evangelizado_por_segundo_nombre: string | null;
  evangelizado_por_primer_apellido: string | null;
  sexo: 'M' | 'F' | null;
  fecha_nacimiento: string | null;
  total: number;
}

export interface NuevoEvangelizado {
  casa_de_paz_id: string;
  iglesia_id: string;
  fecha: string;
  domicilio?: string;
  observaciones?: string;
  persona_id?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  sexo?: 'M' | 'F';
  /** Ambos opcionales — solo se usan al crear una persona nueva (sin persona_id). */
  telefono?: string;
  fecha_nacimiento?: string;
  tipo_evangelismo_id?: string;
  /** KAN-338: quién evangelizó (opcional, persona ya existente en el sistema). */
  evangelizado_por_id?: string;
  /** Milagro/testimonio opcional -- solo se guarda si tipo_evangelismo_id es
   * Elite (fn_registrar_evangelizado lo valida igual, ver
   * evangelismo_testimonio.sql). El campo en el formulario solo aparece con
   * ese tipo elegido (NuevoEvangelizadoDialog.tsx). */
  testimonio?: string;
}

/** Evangelizado registrado directo por un Líder de Red sin Casa de Paz propia
 * (tabla `evangelismo_red`, independiente de `evangelismo`) -- pedido del
 * owner 2026-09-08. Sin `casa_de_paz_id`: queda fuera del ciclo SIM/NC/CRE. */
export interface NuevoEvangelizadoRed {
  red_id: string;
  iglesia_id: string;
  fecha: string;
  domicilio?: string;
  observaciones?: string;
  persona_id?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  sexo?: 'M' | 'F';
  telefono?: string;
  fecha_nacimiento?: string;
  tipo_evangelismo_id?: string;
  evangelizado_por_id?: string;
}

/** Fila de fn_evangelismo_red_directo -- lo que un Líder de Red sin CdP
 * propia registró directo en su Red, sin pasar por ninguna Casa de Paz. */
export interface EvangelizadoRedDirecto {
  id: string;
  persona_id: string;
  nombre_completo: string;
  fecha: string;
  domicilio: string | null;
  tipo_evangelismo_nombre: string | null;
  tipo_evangelismo_color: string | null;
  tipo_evangelismo_codigo: string | null;
}

/** Fila de `evangelismo_testimonio` -- milagro o testimonio cargado al
 * registrar un evangelizado de tipo Elite (campo opcional en
 * NuevoEvangelizadoDialog.tsx, ver `fn_registrar_evangelizado`). Sin
 * distinción milagro/testimonio (una sola entrada de texto libre) ni
 * edición/borrado desde el frontend -- la pestaña "Testimonios Elite" es
 * solo un listado de lectura. */
export interface TestimonioEvangelismo {
  id: string;
  evangelismo_id: string;
  persona_id: string | null;
  nombre_completo: string;
  texto: string;
  fecha_creacion: string;
}

/** Fila de fn_evangelismo_testimonios_red -- mismos Testimonios Elite de
 * arriba pero agregados de toda la Red (Líder de Red / Supervisor de Red,
 * EvangelismoRed.tsx, 2026-09-11), con el dato de a qué Casa de Paz
 * pertenece cada uno para poder agruparlos. */
export interface TestimonioEvangelismoRed {
  id: string;
  casa_de_paz_id: string;
  casa_de_paz_etiqueta: string;
  persona_id: string;
  nombre_completo: string;
  texto: string;
  fecha_creacion: string;
}
