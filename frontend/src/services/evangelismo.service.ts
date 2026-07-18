import { supabase } from './supabase';
import type { Evangelizado, NuevoEvangelizado, TasaEvangelismo } from '@/types/evangelismo.types';

export async function obtenerTasaEvangelismo(
  casaDePazId: string,
  desde: string,
  hasta: string
): Promise<TasaEvangelismo> {
  const { data, error } = await supabase.rpc('fn_tasa_evangelismo', {
    p_casa_de_paz_id: casaDePazId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return (data?.[0] as TasaEvangelismo) ?? { evangelizados: 0, meta: null, origen: null, tasa: null };
}

export async function obtenerEvangelizados(
  casaDePazId: string,
  desde: string,
  hasta: string
): Promise<Evangelizado[]> {
  const { data, error } = await supabase
    .from('evangelismo')
    .select('id, persona_id, fecha, domicilio, evangelizado_por_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)')
    .eq('casa_de_paz_id', casaDePazId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const p = Array.isArray(r.persona) ? r.persona[0] : r.persona;
    const nombre = [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ');
    return {
      id: r.id,
      persona_id: r.persona_id,
      nombre_completo: nombre,
      fecha: r.fecha,
      domicilio: r.domicilio,
      evangelizado_por_id: r.evangelizado_por_id,
    };
  });
}

export async function crearEvangelizado(datos: NuevoEvangelizado) {
  let personaId = datos.persona_id;

  if (!personaId) {
    const { data: persona, error: errorPersona } = await supabase
      .from('persona')
      .insert({
        iglesia_id: datos.iglesia_id,
        primer_nombre: datos.primer_nombre,
        primer_apellido: datos.primer_apellido,
        sexo: datos.sexo,
      })
      .select('id')
      .single();
    if (errorPersona) throw errorPersona;
    personaId = persona.id;
  }

  const { error } = await supabase.from('evangelismo').insert({
    iglesia_id: datos.iglesia_id,
    casa_de_paz_id: datos.casa_de_paz_id,
    persona_id: personaId,
    fecha: datos.fecha,
    domicilio: datos.domicilio,
    observaciones: datos.observaciones,
  });
  if (error) throw error;
}

export async function actualizarMetaPropia(casaDePazId: string, meta: number | null) {
  const { error } = await supabase.from('casa_de_paz').update({ meta_evangelismo: meta }).eq('id', casaDePazId);
  if (error) throw error;
}
