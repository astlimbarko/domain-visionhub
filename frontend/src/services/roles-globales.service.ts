import { supabase } from './supabase';
import { aISO } from '@/utils/calendario-fechas';
import type { CargoVigente } from '@/types/casas-de-paz.types';
import type { JovenIglesia, MatrimonioIglesia } from '@/types/roles-globales.types';

export async function obtenerJovenesIglesia(iglesiaId: string): Promise<JovenIglesia[]> {
  const { data, error } = await supabase.rpc('fn_jovenes_iglesia', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerMatrimoniosIglesia(iglesiaId: string): Promise<MatrimonioIglesia[]> {
  const { data, error } = await supabase.rpc('fn_matrimonios_iglesia', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

// ---- Asignación de los cargos Tipo B de nivel IGLESIA (persona_cargo) ----
// Mismo patrón sin OTP que casa_de_paz_cargo (asignarCargoCdp/quitarCargoCdp):
// son roles de solo lectura, no estructurales -- no ameritan el mismo
// endurecimiento que departamento_cargo (75_otp_baja_cargo_departamento_red.sql).

export type CodigoRolGlobal = 'LIDER_JOVENES' | 'ENCARGADO_MATRIMONIOS';

export async function obtenerCargoVigenteGlobal(iglesiaId: string, codigo: CodigoRolGlobal): Promise<CargoVigente[]> {
  const { data, error } = await supabase
    .from('persona_cargo')
    .select('id, persona_id, fecha_inicio, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, correo), cargo:cargo_id!inner(codigo)')
    .eq('iglesia_id', iglesiaId)
    .eq('cargo.codigo', codigo)
    .is('fecha_fin', null);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const p = Array.isArray(r.persona) ? r.persona[0] : r.persona;
    return {
      id: r.id,
      persona_id: r.persona_id,
      fecha_inicio: r.fecha_inicio,
      correo: p?.correo ?? null,
      nombre_completo: [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' '),
    };
  });
}

export async function asignarCargoGlobal(iglesiaId: string, personaId: string, codigo: CodigoRolGlobal) {
  const { data: cargo, error: errorCargo } = await supabase.from('cargo').select('id').eq('codigo', codigo).single();
  if (errorCargo) throw errorCargo;

  const { error } = await supabase.from('persona_cargo').insert({
    iglesia_id: iglesiaId,
    persona_id: personaId,
    cargo_id: cargo.id,
    fecha_inicio: aISO(new Date()),
  });
  if (error) throw error;
}

export async function quitarCargoGlobal(asignacionId: string) {
  const { error } = await supabase.from('persona_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', asignacionId);
  if (error) throw error;
}
