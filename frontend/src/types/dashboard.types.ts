export interface MisRolesDashboard {
  es_operativo: boolean;
  redes_lider: { id: string; nombre: string }[] | null;
  cdp_lider: { id: string; etiqueta: string }[] | null;
  cdp_sublider: { id: string; etiqueta: string }[] | null;
}

export type Vista =
  | { tipo: 'pastor' }
  | { tipo: 'supervisor'; iglesiaId: string }
  | { tipo: 'red'; redId: string }
  | { tipo: 'cdp'; cdpId: string; esSublider: boolean };

export interface KpiComparativo {
  valor: number | null;
  anterior: number | null;
  variacion_pct: number | null;
  fecha?: string;
}

export interface IngresoMoneda {
  moneda: string;
  total: number;
}

export interface IngresoDetalle {
  casa_de_paz_nombre?: string;
  tipo_codigo: string;
  moneda_codigo: string;
  moneda_simbolo: string;
  total: number;
}

export interface MiembroCdpDashboard {
  persona_id: string;
  nombre: string;
  estado_sigla: string | null;
  estado_nombre: string | null;
  ultima_asistencia: string | null;
  semanas_sin_venir: number | null;
  estado_civil: string | null;
  es_menor: boolean;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
}

export interface AsistenciaHistorico {
  fecha_reunion: string;
  total_asistentes: number;
  total_menores: number;
  total_mayores: number;
}

export interface DashboardLiderCdp {
  casa_de_paz: {
    id: string;
    nombre: string | null;
    red: string | null;
    miembros_total: number;
    ultima_reunion: string | null;
  };
  kpi: {
    miembros_activos: KpiComparativo;
    asistencia_ultima: KpiComparativo;
    ingresos_mes?: IngresoDetalle[] | null;
  };
  asistencia_historico?: AsistenciaHistorico[] | null;
  miembros: MiembroCdpDashboard[] | null;
  alertas: {
    inactivos: { persona_id: string; nombre: string }[] | null;
    reconciliados: { persona_id: string; nombre: string; fecha_reconciliacion: string }[] | null;
    simpatizantes: { persona_id: string; nombre: string; fecha_ingreso: string }[] | null;
  };
  proximos: { titulo: string; fecha: string }[] | null;
}

export interface CasaDePazRedResumen {
  casa_de_paz_id: string;
  etiqueta: string;
  ultima_asistencia: number | null;
  ultima_fecha: string | null;
}

export interface DashboardLiderRed {
  red: { id: string; nombre: string };
  kpi: {
    cdp_activas: number;
    miembros_totales: number;
    asistencia_promedio: number | null;
    ofrendas_mes: IngresoMoneda[] | null;
  };
  casas_de_paz: CasaDePazRedResumen[] | null;
  cdp_sin_reporte_semana: { id: string; etiqueta: string }[] | null;
  ingresos: IngresoDetalle[] | null;
}

export interface RedSupervisorResumen {
  id: string;
  nombre: string;
  cdp: number;
  miembros: number;
  asistencia_promedio: number | null;
  incompleta: boolean;
}

export interface AlertasSupervisor {
  cdp_sin_reporte: { casa_de_paz_id: string; casa_de_paz_nombre: string; red_nombre: string; lider: string | null }[] | null;
  redes_incompletas: { red_id: string; red_nombre: string; falta_departamentos: boolean; falta_ministerio: boolean }[] | null;
  evangelismo_discrepante: unknown[] | null;
  cdp_sin_red: { id: string; nombre: string | null }[] | null;
  iglesia_sin_autoridad: { id: string; nombre: string; falta_pastor: boolean; falta_supervisor: boolean }[] | null;
  miembros_inactivos: { casa_de_paz: string; cantidad: number }[] | null;
}

export interface DashboardSupervisor {
  kpi: {
    redes: number;
    cdp: number;
    miembros_totales: number;
    asistencia_promedio: number | null;
    ingresos_mes: IngresoMoneda[] | null;
  };
  redes_detalle: RedSupervisorResumen[] | null;
  departamentos_activos: { id: string; nombre: string }[] | null;
  estados: { estado_sigla: string; es_menor: boolean; cantidad: number }[] | null;
  alertas: AlertasSupervisor;
}

export interface IglesiaPastorResumen {
  id: string;
  nombre: string;
  ciudad: string;
  moneda_defecto: string;
  redes: number;
  cdp: number;
  miembros_cdp: number;
  familias: number;
  activa: boolean;
}

export interface DashboardPastor {
  iglesias: IglesiaPastorResumen[] | null;
  ingresos_por_moneda: { iglesia: string; moneda: string; tipo: string; total: number }[] | null;
}
