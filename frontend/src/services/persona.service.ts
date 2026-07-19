import { supabase } from './supabase';
import type {
  DatosCensales,
  DatosIdentidad,
  MotivoLlegada,
  NuevaPersona,
  PersonaFicha,
  PersonaResultadoBusqueda,
  TipoRelacion,
  TipoTelefono,
} from '@/types/persona.types';

export async function buscarPersonas(
  iglesiaId: string,
  texto: string,
  incluirOcultas = false,
): Promise<PersonaResultadoBusqueda[]> {
  const { data, error } = await supabase.rpc('fn_buscar_personas', {
    p_iglesia_id: iglesiaId,
    p_texto: texto.trim() === '' ? null : texto.trim(),
    p_incluir_ocultas: incluirOcultas,
  });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerFicha(personaId: string): Promise<PersonaFicha> {
  const { data, error } = await supabase.rpc('fn_persona_ficha', { p_persona_id: personaId });
  if (error) throw error;
  return data as PersonaFicha;
}

export async function crearPersona(datos: NuevaPersona): Promise<{ id: string }> {
  const { data, error } = await supabase.from('persona').insert(datos).select('id').single();
  if (error) throw error;
  return data;
}

export async function actualizarIdentidad(personaId: string, datos: Partial<DatosIdentidad>) {
  const { error } = await supabase.from('persona').update(datos).eq('id', personaId);
  if (error) throw error;
}

export async function guardarDetalle(personaId: string, datos: Partial<DatosCensales>) {
  const { error } = await supabase
    .from('persona_detalle')
    .upsert({ persona_id: personaId, ...datos }, { onConflict: 'persona_id' });
  if (error) throw error;
}

export async function toggleOculto(personaId: string, oculto: boolean) {
  const { error } = await supabase.from('persona').update({ oculto }).eq('id', personaId);
  if (error) throw error;
}

// ---- Direcciones ----

export interface DatosDireccion {
  ciudad?: string | null;
  zona?: string | null;
  anillo?: string | null;
  calle?: string | null;
  numero?: string | null;
  referencia?: string | null;
  url_gps?: string | null;
  observaciones?: string | null;
}

export async function agregarDireccion(
  iglesiaId: string,
  personaId: string,
  datos: DatosDireccion,
  esPrincipal: boolean,
) {
  const { data: direccion, error: errorDireccion } = await supabase
    .from('direccion')
    .insert({ iglesia_id: iglesiaId, ...datos })
    .select('id')
    .single();
  if (errorDireccion) throw errorDireccion;

  if (esPrincipal) {
    await desmarcarDireccionesPrincipales(personaId);
  }

  const { error } = await supabase
    .from('direccion_asignacion')
    .insert({ iglesia_id: iglesiaId, direccion_id: direccion.id, persona_id: personaId, es_principal: esPrincipal });
  if (error) throw error;
}

export async function actualizarDireccion(direccionId: string, datos: DatosDireccion) {
  const { error } = await supabase.from('direccion').update(datos).eq('id', direccionId);
  if (error) throw error;
}

async function desmarcarDireccionesPrincipales(personaId: string) {
  const { error } = await supabase
    .from('direccion_asignacion')
    .update({ es_principal: false })
    .eq('persona_id', personaId)
    .eq('es_principal', true);
  if (error) throw error;
}

export async function marcarDireccionPrincipal(personaId: string, asignacionId: string) {
  await desmarcarDireccionesPrincipales(personaId);
  const { error } = await supabase.from('direccion_asignacion').update({ es_principal: true }).eq('id', asignacionId);
  if (error) throw error;
}

export async function quitarDireccion(asignacionId: string) {
  const { error } = await supabase
    .from('direccion_asignacion')
    .update({ fecha_eliminacion: new Date().toISOString() })
    .eq('id', asignacionId);
  if (error) throw error;
}

// ---- Teléfonos ----

export async function obtenerTiposTelefono(): Promise<TipoTelefono[]> {
  const { data, error } = await supabase.from('tipo_telefono').select('id, codigo, nombre').eq('activo', true).order('orden');
  if (error) throw error;
  return data ?? [];
}

export async function agregarTelefono(
  iglesiaId: string,
  personaId: string,
  tipoTelefonoId: string,
  numero: string,
  observaciones: string | null,
  esPrincipal: boolean,
) {
  const { data: telefono, error: errorTelefono } = await supabase
    .from('telefono')
    .insert({ iglesia_id: iglesiaId, tipo_telefono_id: tipoTelefonoId, numero, observaciones })
    .select('id')
    .single();
  if (errorTelefono) throw errorTelefono;

  if (esPrincipal) {
    await desmarcarTelefonosPrincipales(personaId);
  }

  const { error } = await supabase
    .from('telefono_asignacion')
    .insert({ iglesia_id: iglesiaId, telefono_id: telefono.id, persona_id: personaId, es_principal: esPrincipal });
  if (error) throw error;
}

async function desmarcarTelefonosPrincipales(personaId: string) {
  const { error } = await supabase
    .from('telefono_asignacion')
    .update({ es_principal: false })
    .eq('persona_id', personaId)
    .eq('es_principal', true);
  if (error) throw error;
}

export async function marcarTelefonoPrincipal(personaId: string, asignacionId: string) {
  await desmarcarTelefonosPrincipales(personaId);
  const { error } = await supabase.from('telefono_asignacion').update({ es_principal: true }).eq('id', asignacionId);
  if (error) throw error;
}

export async function quitarTelefono(asignacionId: string) {
  const { error } = await supabase
    .from('telefono_asignacion')
    .update({ fecha_eliminacion: new Date().toISOString() })
    .eq('id', asignacionId);
  if (error) throw error;
}

// ---- Llegada ----

export async function obtenerMotivosLlegada(): Promise<MotivoLlegada[]> {
  const { data, error } = await supabase.from('motivo_llegada').select('id, codigo, nombre').eq('activo', true).order('orden');
  if (error) throw error;
  return data ?? [];
}

export async function agregarLlegada(
  iglesiaId: string,
  personaId: string,
  motivoLlegadaId: string,
  fechaIngreso: string,
  invitadoPorId: string | null,
  invitadoPorTxt: string | null,
  comentarios: string | null,
) {
  const { error } = await supabase.from('persona_llegada').insert({
    iglesia_id: iglesiaId,
    persona_id: personaId,
    motivo_llegada_id: motivoLlegadaId,
    fecha_ingreso: fechaIngreso,
    invitado_por_id: invitadoPorId,
    invitado_por_txt: invitadoPorTxt,
    comentarios,
  });
  if (error) throw error;
}

// ---- Familia ----

export async function obtenerTiposRelacion(): Promise<TipoRelacion[]> {
  const { data, error } = await supabase.from('tipo_relacion').select('id, codigo, nombre').eq('activo', true).order('orden');
  if (error) throw error;
  return data ?? [];
}

export async function agregarRelacionFamiliar(
  iglesiaId: string,
  personaId: string,
  familiarId: string,
  tipoRelacionId: string,
) {
  const { error } = await supabase
    .from('familia')
    .insert({ iglesia_id: iglesiaId, persona_id: personaId, familiar_id: familiarId, tipo_relacion_id: tipoRelacionId });
  if (error) throw error;
}

export async function quitarRelacionFamiliar(familiaId: string) {
  const { error } = await supabase
    .from('familia')
    .update({ fecha_eliminacion: new Date().toISOString() })
    .eq('id', familiaId);
  if (error) throw error;
}

export async function agregarReferenciaFamiliar(
  iglesiaId: string,
  personaId: string,
  nombreFamiliar: string,
  tipoRelacionId: string,
) {
  const { error } = await supabase
    .from('referencia_familiar')
    .insert({ iglesia_id: iglesiaId, persona_id: personaId, nombre_familiar: nombreFamiliar, tipo_relacion_id: tipoRelacionId });
  if (error) throw error;
}

export async function quitarReferenciaFamiliar(referenciaId: string) {
  const { error } = await supabase
    .from('referencia_familiar')
    .update({ fecha_eliminacion: new Date().toISOString() })
    .eq('id', referenciaId);
  if (error) throw error;
}
