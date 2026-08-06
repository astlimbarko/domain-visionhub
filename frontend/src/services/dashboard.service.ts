import { supabase } from './supabase';
import { aISO } from '@/utils/calendario-fechas';
import type { GranularidadTendencia } from '@/utils/periodo-dashboard';
import type {
  DashboardLiderCdp,
  DashboardLiderRed,
  DashboardPastor,
  DashboardSupervisor,
  IngresoDetalle,
  IngresoMoneda,
  MiembroCdpDashboard,
  MisRolesDashboard,
  PuntoTendenciaAsistencia,
} from '@/types/dashboard.types';

export async function obtenerMisRoles(iglesiaId: string): Promise<MisRolesDashboard> {
  const { data, error } = await supabase.rpc('fn_mis_roles_dashboard', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data as MisRolesDashboard;
}

export async function obtenerDashboardLiderCdp(casaDePazId: string): Promise<DashboardLiderCdp> {
  const { data, error } = await supabase.rpc('fn_dashboard_lider_cdp', { p_casa_de_paz_id: casaDePazId });
  if (error) throw error;
  return data as DashboardLiderCdp;
}

export async function obtenerDashboardSubliderCdp(casaDePazId: string): Promise<DashboardLiderCdp> {
  const { data, error } = await supabase.rpc('fn_dashboard_sublider_cdp', { p_casa_de_paz_id: casaDePazId });
  if (error) throw error;
  return data as DashboardLiderCdp;
}

/**
 * Semáforo de fidelidad (VERDE/AMARILLO/ROJO) de los miembros de una Casa de
 * Paz -- reusa `fn_lista_miembros_cdp`, que ya existe en el backend (usada
 * hoy solo internamente por `fn_dashboard_lider_cdp`) pero valida el acceso
 * por sí misma, así que se puede invocar directo (mismo criterio ya usado
 * para `fn_ingresos_cdp`, ver `obtenerIngresosCdpPeriodo` más abajo). Se usa
 * para armar el índice de fidelidad agregado por Red del Supervisor
 * (`HistorialAsistenciaSupervisorVista`) sumando el semáforo de cada CdP.
 */
export async function obtenerSemaforoCdp(casaDePazId: string): Promise<MiembroCdpDashboard[]> {
  const { data, error } = await supabase.rpc('fn_lista_miembros_cdp', { p_casa_de_paz_id: casaDePazId });
  if (error) throw error;
  return (data ?? []) as MiembroCdpDashboard[];
}

export async function obtenerDashboardLiderRed(redId: string): Promise<DashboardLiderRed> {
  const { data, error } = await supabase.rpc('fn_dashboard_lider_red', { p_red_id: redId });
  if (error) throw error;
  return data as DashboardLiderRed;
}

export async function obtenerDashboardSupervisor(iglesiaId: string): Promise<DashboardSupervisor> {
  const { data, error } = await supabase.rpc('fn_dashboard_supervisor', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data as DashboardSupervisor;
}

export async function obtenerDashboardPastor(): Promise<DashboardPastor> {
  const { data, error } = await supabase.rpc('fn_dashboard_pastor');
  if (error) throw error;
  return data as DashboardPastor;
}

function inicioSemanaDe(fecha: Date): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function claveBucket(fecha: Date, granularidad: GranularidadTendencia): string {
  if (granularidad === 'anio') return String(fecha.getFullYear());
  if (granularidad === 'trimestre') return `${fecha.getFullYear()}-Q${Math.floor(fecha.getMonth() / 3) + 1}`;
  if (granularidad === 'mes') return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  return aISO(inicioSemanaDe(fecha)); // semana: se identifica por el domingo con el que arranca
}

function desdeParaTendencia(granularidad: GranularidadTendencia, cantidad: number, ahora = new Date()): Date {
  const desde = new Date(ahora);
  if (granularidad === 'semana') {
    desde.setDate(desde.getDate() - 7 * (cantidad - 1));
    return inicioSemanaDe(desde);
  }
  if (granularidad === 'trimestre') {
    desde.setDate(1);
    desde.setMonth(desde.getMonth() - 3 * (cantidad - 1));
    return desde;
  }
  if (granularidad === 'anio') {
    desde.setMonth(0, 1);
    desde.setFullYear(desde.getFullYear() - (cantidad - 1));
    return desde;
  }
  desde.setDate(1);
  desde.setMonth(desde.getMonth() - (cantidad - 1));
  return desde;
}

/**
 * Tendencia de asistencia agrupada por semana/mes/trimestre/año, calculada en
 * el cliente a partir de `v_reporte_totales` (la misma vista que ya usa
 * Reportes.tsx para "Reportes recientes"). No hay una función de agregación
 * por período en el backend, así que se trae cada reporte del rango y se
 * agrupa/promedia acá.
 */
export async function obtenerTendenciaAsistencia(
  casaDePazId: string,
  granularidad: GranularidadTendencia,
  cantidad: number,
  /** Cuando viene informado, reemplaza el cálculo por cantidad/granularidad con un rango exacto. */
  rangoPersonalizado?: { desde: string; hasta: string }
): Promise<PuntoTendenciaAsistencia[]> {
  const desde = rangoPersonalizado ? rangoPersonalizado.desde : aISO(desdeParaTendencia(granularidad, cantidad));

  let query = supabase
    .from('v_reporte_totales')
    .select('fecha_reunion, total_asistentes')
    .eq('casa_de_paz_id', casaDePazId)
    .gte('fecha_reunion', desde);
  if (rangoPersonalizado) query = query.lte('fecha_reunion', rangoPersonalizado.hasta);

  const { data, error } = await query.order('fecha_reunion', { ascending: true });
  if (error) throw error;

  const buckets = new Map<string, { suma: number; cantidad: number }>();
  for (const r of data ?? []) {
    const clave = claveBucket(new Date(`${r.fecha_reunion}T00:00:00`), granularidad);
    const actual = buckets.get(clave) ?? { suma: 0, cantidad: 0 };
    actual.suma += r.total_asistentes;
    actual.cantidad += 1;
    buckets.set(clave, actual);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, v]) => ({ clave, promedioAsistencia: Math.round(v.suma / v.cantidad) }));
}

/** Promedio de asistencia dentro de un rango exacto [desde, hasta] — para el período seleccionado en el dashboard. */
export async function obtenerAsistenciaPromedioPeriodo(
  casaDePazId: string,
  desde: string,
  hasta: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('v_reporte_totales')
    .select('total_asistentes')
    .eq('casa_de_paz_id', casaDePazId)
    .gte('fecha_reunion', desde)
    .lte('fecha_reunion', hasta);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const suma = data.reduce((s, r) => s + r.total_asistentes, 0);
  return Math.round(suma / data.length);
}

/**
 * Ingresos de una Casa de Paz en un rango exacto — reusa `fn_ingresos_cdp`,
 * que ya existe en el backend (usada hoy solo internamente por
 * fn_dashboard_lider_cdp para "el mes calendario") pero acepta cualquier
 * rango y valida el acceso por sí misma, así que se puede invocar directo.
 */
export async function obtenerIngresosCdpPeriodo(casaDePazId: string, desde: string, hasta: string): Promise<IngresoDetalle[]> {
  const { data, error } = await supabase.rpc('fn_ingresos_cdp', {
    p_casa_de_paz_id: casaDePazId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return (data ?? []) as IngresoDetalle[];
}

/** Ingresos de una Red en un rango exacto — mismo patrón que `obtenerIngresosCdpPeriodo`, vía `fn_ingresos_red`. */
export async function obtenerIngresosRedPeriodo(redId: string, desde: string, hasta: string): Promise<IngresoDetalle[]> {
  const { data, error } = await supabase.rpc('fn_ingresos_red', {
    p_red_id: redId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return (data ?? []) as IngresoDetalle[];
}

/**
 * Ingresos de toda la iglesia en un rango exacto, para el panel de
 * Supervisor: no existe una función agregada a nivel iglesia, así que se
 * suman los resultados de `fn_ingresos_red` de cada red (típicamente pocas
 * redes por iglesia).
 */
export async function obtenerIngresosSupervisorPeriodo(redIds: string[], desde: string, hasta: string): Promise<IngresoMoneda[]> {
  const porRed = await Promise.all(redIds.map((redId) => obtenerIngresosRedPeriodo(redId, desde, hasta)));
  const totalPorMoneda = new Map<string, number>();
  for (const fila of porRed.flat()) {
    totalPorMoneda.set(fila.moneda_codigo, (totalPorMoneda.get(fila.moneda_codigo) ?? 0) + Number(fila.total));
  }
  return Array.from(totalPorMoneda.entries()).map(([moneda, total]) => ({ moneda, total }));
}
