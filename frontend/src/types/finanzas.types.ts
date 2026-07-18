export interface TipoIngreso {
  id: string;
  codigo: string;
  nombre: string;
}

export interface TotalIngreso {
  tipo_codigo: string;
  tipo_nombre: string;
  moneda_codigo: string;
  moneda_simbolo: string;
  total: number;
}

export interface ComparativoIngreso {
  moneda_id: string;
  moneda_codigo: string;
  total_actual: number;
  total_anterior: number;
  variacion_pct: number | null;
}

export interface NuevoIngreso {
  iglesia_id: string;
  casa_de_paz_id: string;
  tipo_ingreso_id: string;
  monto: number;
  moneda_id: string;
  fecha: string;
  observaciones?: string;
}
