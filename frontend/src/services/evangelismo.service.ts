import { supabase } from './supabase';
import { aISO } from '@/utils/calendario-fechas';
import type {
  Evangelizado,
  EvangelizadoRed,
  MetaCdpRed,
  MetaPropia,
  MetaRedAsignada,
  NuevaMetaAsignada,
  NuevaMetaAsignadaRed,
  NuevoEvangelizado,
  TasaEvangelismo,
  TasaEvangelismoRed,
  TipoEvangelismo,
} from '@/types/evangelismo.types';

export async function obtenerTiposEvangelismo(iglesiaId: string): Promise<TipoEvangelismo[]> {
  const { data, error } = await supabase
    .from('tipo_evangelismo')
    .select('id, codigo, nombre, color')
    .or(`iglesia_id.is.null,iglesia_id.eq.${iglesiaId}`)
    .eq('activo', true)
    .order('orden');
  if (error) throw error;
  return data ?? [];
}

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
    .select(
      'id, persona_id, fecha, domicilio, evangelizado_por_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido), tipo_evangelismo:tipo_evangelismo_id(nombre, color)'
    )
    .eq('casa_de_paz_id', casaDePazId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const p = Array.isArray(r.persona) ? r.persona[0] : r.persona;
    const t = Array.isArray(r.tipo_evangelismo) ? r.tipo_evangelismo[0] : r.tipo_evangelismo;
    const nombre = [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ');
    return {
      id: r.id,
      persona_id: r.persona_id,
      nombre_completo: nombre,
      fecha: r.fecha,
      domicilio: r.domicilio,
      evangelizado_por_id: r.evangelizado_por_id,
      tipo_evangelismo_nombre: t?.nombre ?? null,
      tipo_evangelismo_color: t?.color ?? null,
    };
  });
}

// KAN-277: persona + telefono + evangelismo en una sola RPC transaccional
// (fn_registrar_evangelizado). Antes eran 2-3 inserts separados desde el
// cliente -- si el insert de evangelismo fallaba, la persona ya creada
// quedaba huérfana y un reintento del líder generaba un duplicado (bug real,
// confirmado con datos: 2 personas con el mismo nombre, mismo creado_por, la
// primera sin evangelismo asociado). Con la RPC, si cualquier paso falla
// TODO se revierte junto, no puede quedar una persona a medias.
export async function crearEvangelizado(datos: NuevoEvangelizado) {
  const { error } = await supabase.rpc('fn_registrar_evangelizado', {
    p_datos: {
      persona_id: datos.persona_id ?? null,
      iglesia_id: datos.iglesia_id,
      casa_de_paz_id: datos.casa_de_paz_id,
      primer_nombre: datos.primer_nombre,
      primer_apellido: datos.primer_apellido,
      sexo: datos.sexo,
      fecha_nacimiento: datos.fecha_nacimiento || null,
      telefono: datos.telefono || null,
      fecha: datos.fecha,
      domicilio: datos.domicilio,
      observaciones: datos.observaciones,
      tipo_evangelismo_id: datos.tipo_evangelismo_id || null,
    },
  });
  if (error) throw error;
}

export async function actualizarMetaPropia(casaDePazId: string, meta: number | null) {
  const { error } = await supabase.from('casa_de_paz').update({ meta_evangelismo: meta }).eq('id', casaDePazId);
  if (error) throw error;
}

/**
 * Meta propia leída directo de `casa_de_paz`, no derivada de fn_tasa_evangelismo:
 * esa RPC solo devuelve la meta EFECTIVA (la asignada por un rol superior gana
 * si está vigente), así que si se usara para mostrar el input de "meta propia"
 * el líder perdería de vista -- y no podría editar -- su propia preferencia
 * mientras haya una asignada activa.
 */
export async function obtenerMetaPropia(casaDePazId: string): Promise<MetaPropia> {
  const { data, error } = await supabase.from('casa_de_paz').select('meta_evangelismo').eq('id', casaDePazId).single();
  if (error) throw error;
  return data;
}

export async function obtenerEvangelismoRed(redId: string, desde: string, hasta: string): Promise<EvangelizadoRed[]> {
  const { data, error } = await supabase.rpc('fn_evangelismo_red', { p_red_id: redId, p_desde: desde, p_hasta: hasta });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerTasaEvangelismoRed(redId: string, desde: string, hasta: string): Promise<TasaEvangelismoRed> {
  const { data, error } = await supabase.rpc('fn_tasa_evangelismo_red', { p_red_id: redId, p_desde: desde, p_hasta: hasta });
  if (error) throw error;
  return (data?.[0] as TasaEvangelismoRed) ?? { evangelizados: 0, meta_total: 0, cdp_con_meta: 0, cdp_total: 0, tasa: null };
}

export async function obtenerMetasCdpRed(redId: string): Promise<MetaCdpRed[]> {
  const { data, error } = await supabase.rpc('fn_metas_cdp_red', { p_red_id: redId });
  if (error) throw error;
  return data ?? [];
}

/**
 * Asigna (o reasigna) una meta de evangelismo a una CdP de la Red vía
 * `fn_asignar_meta_cdp` (20260902000000_metas_reasignar_sin_solapamiento.sql).
 * Antes era un INSERT directo, pero eso rebotaba con "solapamiento"
 * (excl_meta_asignada_solapada) al intentar CAMBIAR la meta del mismo período:
 * el RPC da de baja lógica la meta vigente que se solapa y recién ahí inserta
 * la nueva, todo en una transacción. El permiso es el mismo que exigía la RLS
 * (`fn_es_rol_superior_de_cdp`); `iglesia_id`/`asignador_id` los resuelve el
 * backend, por eso ya no se mandan desde acá.
 */
export async function asignarMetaEvangelismo(datos: NuevaMetaAsignada) {
  const { error } = await supabase.rpc('fn_asignar_meta_cdp', {
    p_casa_de_paz_id: datos.casaDePazId,
    p_meta: datos.meta,
    p_fecha_inicio: datos.fechaInicio,
    p_fecha_fin: datos.fechaFin,
    p_observaciones: datos.observaciones || null,
  });
  if (error) throw error;
}

/**
 * Meta que el Supervisor le asignó a una Red completa (`red_id`, no
 * `casa_de_paz_id`) y que esté vigente hoy -- lectura directa, mismo estilo
 * que `obtenerMetaPropia`. `null` si no hay ninguna vigente.
 */
export async function obtenerMetaRedAsignada(redId: string): Promise<MetaRedAsignada | null> {
  const hoy = aISO(new Date());
  const { data, error } = await supabase
    .from('meta_evangelismo_asignada')
    .select('meta, fecha_inicio, fecha_fin')
    .eq('red_id', redId)
    .lte('fecha_inicio', hoy)
    .gte('fecha_fin', hoy)
    .order('fecha_inicio', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Asigna (o reasigna) una meta de evangelismo a una Red completa vía
 * `fn_asignar_meta_red` (mismo motivo que `asignarMetaEvangelismo`: permitir
 * CAMBIAR la meta del mismo período sin chocar con excl_meta_asignada_red_
 * solapada). El permiso es el mismo que exigía la RLS bifurcada
 * (`fn_es_lider_de_red` o `fn_es_operativo_en`). `fn_meta_efectiva`
 * (104_fix_prioridad_meta_supervisor.sql) la hereda hacia cada Casa de Paz de
 * la Red que no tenga ya su propia meta asignada.
 */
export async function asignarMetaRedEvangelismo(datos: NuevaMetaAsignadaRed) {
  const { error } = await supabase.rpc('fn_asignar_meta_red', {
    p_red_id: datos.redId,
    p_meta: datos.meta,
    p_fecha_inicio: datos.fechaInicio,
    p_fecha_fin: datos.fechaFin,
    p_observaciones: datos.observaciones || null,
  });
  if (error) throw error;
}
