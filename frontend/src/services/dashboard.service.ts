import { supabase } from './supabase';
import type {
  DashboardLiderCdp,
  DashboardLiderRed,
  DashboardPastor,
  DashboardSupervisor,
  MisRolesDashboard,
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
