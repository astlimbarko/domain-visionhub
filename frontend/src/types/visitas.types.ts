export type MotivoVisita = 'SEGUIMIENTO' | 'APERTURA_NUEVA_CDP';

/** Códigos fijos de `chk_visita_cdp_aspectos` (56_visitas_red.sql) -- mismo
 * set que el formulario de referencia (img/3.jpeg). */
export type AspectoVisita =
  | 'PUNTUALIDAD'
  | 'PARTICIPACION_ASISTENTES'
  | 'AMBIENTE_REUNION'
  | 'ORGANIZACION'
  | 'EVANGELISMO'
  | 'ENSENANZA'
  | 'LIDERAZGO'
  | 'AFIRMACION_NUEVOS'
  | 'OTRO';

export const MOTIVOS_VISITA: { value: MotivoVisita; label: string }[] = [
  { value: 'SEGUIMIENTO', label: 'Seguimiento' },
  { value: 'APERTURA_NUEVA_CDP', label: 'Apertura de nueva Casa de Paz' },
];

export const ASPECTOS_VISITA: { value: AspectoVisita; label: string }[] = [
  { value: 'PUNTUALIDAD', label: 'Puntualidad' },
  { value: 'PARTICIPACION_ASISTENTES', label: 'Participación de los asistentes' },
  { value: 'AMBIENTE_REUNION', label: 'Ambiente de la reunión' },
  { value: 'ORGANIZACION', label: 'Organización' },
  { value: 'EVANGELISMO', label: 'Evangelismo' },
  { value: 'ENSENANZA', label: 'Enseñanza' },
  { value: 'LIDERAZGO', label: 'Liderazgo' },
  { value: 'AFIRMACION_NUEVOS', label: 'Afirmación de nuevos' },
  { value: 'OTRO', label: 'Otro' },
];

/** Fila de fn_visitas_red (56_visitas_red.sql). */
export interface VisitaRed {
  id: string;
  casa_de_paz_id: string;
  casa_de_paz_etiqueta: string;
  lider_cdp_nombre: string | null;
  motivo: MotivoVisita;
  aspectos: AspectoVisita[];
  aspecto_otro_detalle: string | null;
  observaciones: string | null;
  fecha_visita: string;
  hora_registro: string;
}

export interface NuevaVisita {
  iglesiaId: string;
  casaDePazId: string;
  redId: string;
  liderRedId: string;
  motivo: MotivoVisita;
  aspectos: AspectoVisita[];
  aspectoOtroDetalle?: string;
  observaciones?: string;
  fechaVisita: string;
}
