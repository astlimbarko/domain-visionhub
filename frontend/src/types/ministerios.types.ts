export interface MinisterioResumen {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
  lider_nombre: string | null;
  participantes_count: number;
}

export interface ParticipanteMinisterio {
  id: string;
  persona_id: string;
  nombre_completo: string;
  es_lider: boolean;
  red_nombre: string;
}
