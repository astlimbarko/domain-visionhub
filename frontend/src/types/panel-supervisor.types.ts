export type TipoConfiguracion = 'BOOLEANO' | 'NUMERICO' | 'TEXTO';

export interface ConfiguracionItem {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: TipoConfiguracion;
  valor_actual: string;
  valor_defecto: string;
  valor_min: number | null;
  valor_max: number | null;
  unidad: string | null;
  es_personalizado: boolean;
}

export interface DepartamentoItem {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface PanelConfiguracion {
  iglesia: { id: string; nombre: string; prefijo: string; sufijo: string; moneda_defecto: string };
  categorias: Record<string, ConfiguracionItem[]>;
  departamentos: DepartamentoItem[];
  advertencia: string;
}

export interface MonedaActiva {
  id: string;
  moneda_id: string;
  activa: boolean;
  codigo: string;
  nombre: string;
  simbolo: string;
}
