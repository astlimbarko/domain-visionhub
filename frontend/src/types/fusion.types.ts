export interface FusionCdp {
  id: string;
  fecha_fusion: string;
  motivo: string;
  deshecha_en: string | null;
  deshecha_motivo: string | null;
  origen_id: string;
  origen_etiqueta: string;
  destino_id: string;
  destino_etiqueta: string;
  puede_deshacer: boolean;
}

export interface FusionRed {
  id: string;
  fecha_fusion: string;
  motivo: string;
  deshecha_en: string | null;
  deshecha_motivo: string | null;
  origen_id: string;
  origen_nombre: string;
  destino_id: string;
  destino_nombre: string;
  puede_deshacer: boolean;
}
