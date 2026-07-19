export interface MultiplicacionCdp {
  id: string;
  fecha_multiplicacion: string;
  motivo: string;
  cantidad_movidos: number;
  origen_id: string;
  origen_etiqueta: string;
  nueva_id: string;
  nueva_etiqueta: string;
}

export interface MultiplicacionRed {
  id: string;
  fecha_multiplicacion: string;
  motivo: string;
  cantidad_movidas: number;
  origen_id: string;
  origen_nombre: string;
  nueva_id: string;
  nueva_nombre: string;
}
