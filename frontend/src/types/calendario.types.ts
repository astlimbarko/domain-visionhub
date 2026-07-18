export interface TipoEvento {
  id: string;
  codigo: string;
  nombre: string;
  color: string;
  icono: string | null;
}

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo_codigo: string;
  tipo_nombre: string;
  color: string;
  icono: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  es_multi_dia: boolean;
  ambito: 'CDP' | 'RED';
}

export interface Cumpleanos {
  persona_id: string;
  nombre: string;
  fecha_cumpleanos: string;
  edad_cumple: number;
}

export interface Proximo {
  clase: 'EVENTO' | 'CUMPLEANOS';
  titulo: string;
  fecha: string;
  dias_faltantes: number;
}

export interface NuevoEvento {
  casa_de_paz_id: string;
  tipo_evento_id: string;
  titulo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  hora_inicio?: string;
  hora_fin?: string;
  iglesia_id: string;
}

export interface CasaDePazPropia {
  casa_de_paz_id: string;
  nombre: string;
}
