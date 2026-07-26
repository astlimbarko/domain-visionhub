export interface TasaEvangelismo {
  evangelizados: number;
  meta: number | null;
  origen: 'ASIGNADA' | 'PROPIA' | null;
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
