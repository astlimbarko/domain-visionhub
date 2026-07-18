export interface TasaEvangelismo {
  evangelizados: number;
  meta: number | null;
  origen: 'ASIGNADA' | 'PROPIA' | null;
  tasa: number | null;
}

export interface Evangelizado {
  id: string;
  persona_id: string;
  nombre_completo: string;
  fecha: string;
  domicilio: string | null;
  evangelizado_por_id: string | null;
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
}
