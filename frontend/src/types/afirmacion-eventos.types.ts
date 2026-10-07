export type TipoEvento = {
  id: string;
  nombre: string;
  codigo: string;
  color: string;
};

export type EventoAfirmacion = {
  id: string;
  titulo: string;
  tipo_evento_id: string;
  tipo_nombre: string;
  color: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  es_recurrente: boolean;
  activo: boolean;
  total_personas: number;
  total_rsil: number;
  total_bautismo: number;
  total_membresia: number;
};

export type FilaHistorialProcesoConEvento = {
  id: string;
  persona_id: string;
  nombre_completo: string;
  fecha: string | null;
  fecha_creacion: string;
  registrado_por: string | null;
  registrado_por_nombre: string | null;
};

export enum ProcesoAfirmacionCodigo {
  ALTAR = 'ALTAR',
  BAUTISMO = 'BAUTISMO',
  RSIL = 'RSIL',
  MEMBRESIA_NUEVOS = 'MEMBRESIA_NUEVOS',
}
