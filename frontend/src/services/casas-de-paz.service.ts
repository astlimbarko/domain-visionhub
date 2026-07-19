import { supabase } from './supabase';
import { aISO } from '@/utils/calendario-fechas';
import type {
  CargoCdpCodigo,
  CargoRedCodigo,
  CargoVigente,
  CdpResumen,
  PersonaBusqueda,
  RedResumen,
} from '@/types/casas-de-paz.types';

export interface CargoCatalogo {
  id: string;
  codigo: string;
  nombre: string;
}

export async function obtenerCargos(): Promise<CargoCatalogo[]> {
  const { data, error } = await supabase.from('cargo').select('id, codigo, nombre').eq('activo', true);
  if (error) throw error;
  return data ?? [];
}

export async function obtenerRedes(iglesiaId: string): Promise<RedResumen[]> {
  const { data, error } = await supabase.rpc('fn_listar_redes', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerCdps(iglesiaId: string, redId?: string): Promise<CdpResumen[]> {
  const { data, error } = await supabase.rpc('fn_listar_cdp', { p_iglesia_id: iglesiaId, p_red_id: redId ?? null });
  if (error) throw error;
  return data ?? [];
}

export async function crearRed(iglesiaId: string, nombre: string): Promise<{ id: string }> {
  const { data, error } = await supabase.from('red').insert({ iglesia_id: iglesiaId, nombre }).select('id').single();
  if (error) throw error;
  return data;
}

export async function toggleActivoRed(redId: string, activo: boolean) {
  const { error } = await supabase.from('red').update({ activo }).eq('id', redId);
  if (error) throw error;
}

export async function crearCdp(
  iglesiaId: string,
  redId: string,
  nombre?: string,
  sublideresIds: string[] = []
): Promise<{ id: string }> {
  const { data: cdp, error: errorCdp } = await supabase
    .from('casa_de_paz')
    .insert({ iglesia_id: iglesiaId, nombre: nombre || null })
    .select('id')
    .single();
  if (errorCdp) throw errorCdp;

  const { error: errorRed } = await supabase.from('casa_de_paz_red').insert({
    iglesia_id: iglesiaId,
    casa_de_paz_id: cdp.id,
    red_id: redId,
    fecha_inicio: aISO(new Date()),
  });
  if (errorRed) throw errorRed;

  if (sublideresIds.length > 0) {
    const { data: cargo, error: errorCargo } = await supabase
      .from('cargo')
      .select('id')
      .eq('codigo', 'SUBLIDER_CDP')
      .eq('activo', true)
      .single();
    if (errorCargo) throw errorCargo;

    const { error: errorSublideres } = await supabase.from('casa_de_paz_cargo').insert(
      sublideresIds.map((personaId) => ({
        iglesia_id: iglesiaId,
        casa_de_paz_id: cdp.id,
        persona_id: personaId,
        cargo_id: cargo.id,
        fecha_inicio: aISO(new Date()),
      }))
    );
    if (errorSublideres) throw errorSublideres;
  }

  return cdp;
}

export async function toggleActivoCdp(cdpId: string, activo: boolean) {
  const { error } = await supabase.from('casa_de_paz').update({ activo }).eq('id', cdpId);
  if (error) throw error;
}

export async function buscarPersonas(iglesiaId: string, texto: string): Promise<PersonaBusqueda[]> {
  const tokens = texto.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  // Trae un lote amplio con cualquier campo que matchee cualquier palabra, y
  // filtra en el cliente exigiendo que TODAS las palabras aparezcan en el
  // nombre completo -- asi "Juan Perez" encuentra a alguien buscado por
  // nombre y apellido a la vez, que ningun campo individual cubre solo.
  const condiciones = tokens
    .flatMap((t) => [
      `primer_nombre.ilike.%${t}%`,
      `segundo_nombre.ilike.%${t}%`,
      `primer_apellido.ilike.%${t}%`,
      `segundo_apellido.ilike.%${t}%`,
    ])
    .join(',');

  const { data, error } = await supabase
    .from('persona')
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido')
    .eq('iglesia_id', iglesiaId)
    .or(condiciones)
    .limit(30);
  if (error) throw error;

  return (data ?? [])
    .map((p) => ({
      id: p.id,
      nombre_completo: [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' '),
    }))
    .filter((p) => {
      const nombreNormalizado = p.nombre_completo.toLowerCase();
      return tokens.every((t) => nombreNormalizado.includes(t.toLowerCase()));
    })
    .slice(0, 10);
}

export async function obtenerCargoVigenteRed(redId: string, codigo: CargoRedCodigo): Promise<CargoVigente[]> {
  const { data, error } = await supabase
    .from('red_cargo')
    .select('id, persona_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido), cargo:cargo_id(codigo)')
    .eq('red_id', redId)
    .is('fecha_fin', null);
  if (error) throw error;
  return (data ?? [])
    .filter((r) => {
      const cargo = Array.isArray(r.cargo) ? r.cargo[0] : r.cargo;
      return cargo?.codigo === codigo;
    })
    .map((r) => {
      const p = Array.isArray(r.persona) ? r.persona[0] : r.persona;
      return {
        id: r.id,
        persona_id: r.persona_id,
        nombre_completo: [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' '),
      };
    });
}

export async function obtenerCargoVigenteCdp(cdpId: string, codigo: CargoCdpCodigo): Promise<CargoVigente[]> {
  const { data, error } = await supabase
    .from('casa_de_paz_cargo')
    .select('id, persona_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido), cargo:cargo_id(codigo)')
    .eq('casa_de_paz_id', cdpId)
    .is('fecha_fin', null);
  if (error) throw error;
  return (data ?? [])
    .filter((r) => {
      const cargo = Array.isArray(r.cargo) ? r.cargo[0] : r.cargo;
      return cargo?.codigo === codigo;
    })
    .map((r) => {
      const p = Array.isArray(r.persona) ? r.persona[0] : r.persona;
      return {
        id: r.id,
        persona_id: r.persona_id,
        nombre_completo: [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' '),
      };
    });
}

const CARGOS_EXCLUSIVOS_RED: CargoRedCodigo[] = ['LIDER_RED', 'ENCARGADO_DEPARTAMENTOS_RED', 'ENCARGADO_MINISTERIO_RED'];
const CARGOS_EXCLUSIVOS_CDP: CargoCdpCodigo[] = ['LIDER_CDP', 'ANFITRION'];

export async function asignarCargoRed(
  iglesiaId: string,
  redId: string,
  personaId: string,
  codigo: CargoRedCodigo,
  cargoId: string
) {
  if (CARGOS_EXCLUSIVOS_RED.includes(codigo)) {
    const vigentes = await obtenerCargoVigenteRed(redId, codigo);
    for (const v of vigentes) {
      const { error } = await supabase.from('red_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', v.id);
      if (error) throw error;
    }
  }
  const { error } = await supabase.from('red_cargo').insert({
    iglesia_id: iglesiaId,
    red_id: redId,
    persona_id: personaId,
    cargo_id: cargoId,
    fecha_inicio: aISO(new Date()),
  });
  if (error) throw error;
}

export async function asignarCargoCdp(
  iglesiaId: string,
  cdpId: string,
  personaId: string,
  codigo: CargoCdpCodigo,
  cargoId: string
) {
  if (CARGOS_EXCLUSIVOS_CDP.includes(codigo)) {
    const vigentes = await obtenerCargoVigenteCdp(cdpId, codigo);
    for (const v of vigentes) {
      const { error } = await supabase.from('casa_de_paz_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', v.id);
      if (error) throw error;
    }
  }
  const { error } = await supabase.from('casa_de_paz_cargo').insert({
    iglesia_id: iglesiaId,
    casa_de_paz_id: cdpId,
    persona_id: personaId,
    cargo_id: cargoId,
    fecha_inicio: aISO(new Date()),
  });
  if (error) throw error;
}

export async function quitarCargoRed(cargoAsignacionId: string) {
  const { error } = await supabase.from('red_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', cargoAsignacionId);
  if (error) throw error;
}

export async function quitarCargoCdp(cargoAsignacionId: string) {
  const { error } = await supabase.from('casa_de_paz_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', cargoAsignacionId);
  if (error) throw error;
}
