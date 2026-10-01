// KAN-488 (harness/21, Membresía desde 0): autoguardado del borrador en la
// BD (tabla membresia_borrador), 1 por usuario+iglesia. Mismo criterio que el
// borrador de reporte de CdP (KAN-435): el payload es todo el formulario como
// JSON, no toca las tablas reales de persona hasta que se presiona "Guardar".
import { supabase } from './supabase';
import { componerTelefono } from '@/utils/paises-telefono';
import type { DatosMembresiaNuevos } from '@/types/membresia-nuevos.types';

export async function guardarBorradorMembresia(iglesiaId: string, payload: DatosMembresiaNuevos): Promise<string> {
  const { data, error } = await supabase.rpc('fn_guardar_borrador_membresia', {
    p_iglesia_id: iglesiaId,
    p_payload: payload,
  });
  if (error) throw error;
  return data as string;
}

export async function obtenerBorradorMembresia(iglesiaId: string): Promise<DatosMembresiaNuevos | null> {
  const { data, error } = await supabase.rpc('fn_obtener_borrador_membresia', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return (data as DatosMembresiaNuevos | null) ?? null;
}

export async function eliminarBorradorMembresia(iglesiaId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_eliminar_borrador_membresia', { p_iglesia_id: iglesiaId });
  if (error) throw error;
}

export interface MembresiaNuevosGuardada {
  persona_id: string;
  nombre_completo: string;
  casa_de_paz_id: string | null;
  sin_casa_de_paz: boolean;
}

/**
 * Guardado FINAL a las tablas reales (fn_guardar_membresia_nuevos): crea la
 * persona + detalle + teléfono + llegada + Casa de Paz (según los 3 modos) +
 * estado SSVA (SIM si es visita, NC si no). Mapea los campos camelCase del
 * formulario al payload snake_case que espera la RPC. El borrado del borrador
 * lo hace quien llama, tras el éxito.
 */
export async function guardarMembresiaNuevos(
  iglesiaId: string,
  datos: DatosMembresiaNuevos,
): Promise<MembresiaNuevosGuardada> {
  const payload = {
    primer_nombre: datos.primerNombre,
    segundo_nombre: datos.segundoNombre,
    primer_apellido: datos.primerApellido,
    segundo_apellido: datos.segundoApellido,
    sexo: datos.sexo,
    fecha_nacimiento: datos.fechaNacimiento,
    ci: datos.ci,
    correo: datos.correo,
    estado_civil: datos.estadoCivil,
    grado_instruccion: datos.gradoInstruccion,
    ocupacion: datos.ocupacion,
    telefono: componerTelefono(datos.telefonoPais, datos.telefonoNumero),
    direccion: datos.direccion,
    como_llego: datos.comoLlego,
    discipulado_nivel: datos.discipuladoNivel,
    es_visita: datos.esVisita,
    // KAN-490: el frontend resuelve la CdP final; invitador por id (sistema) o txt (libre).
    invitador_persona_id: datos.invitadorEsLibre ? '' : datos.invitadorPersonaId,
    invitador_txt: datos.invitadorEsLibre ? datos.invitadorNombre : '',
    casa_de_paz_id: datos.casaDePazId,
  };
  const { data, error } = await supabase.rpc('fn_guardar_membresia_nuevos', {
    p_iglesia_id: iglesiaId,
    p_payload: payload,
  });
  if (error) throw error;
  return data as MembresiaNuevosGuardada;
}

export interface CdpAsistencia {
  casa_de_paz_id: string;
  casa_de_paz_etiqueta: string;
  red_id: string | null;
  red_nombre: string | null;
  iglesia_id: string;
  iglesia_nombre: string;
  es_satelite: boolean;
  /** KAN-490: líder vigente de la CdP, para buscar por líder (null si no tiene). */
  lider_nombre: string | null;
}

/**
 * Lista las Casas de Paz para el picker buscable de la Membresía desde 0:
 * las de la iglesia Y las de sus satélites/hijas, con Red e iglesia para poder
 * agrupar por Red y distinguir las de satélite (fn_listar_cdp_asistencia).
 */
export async function listarCdpAsistencia(iglesiaId: string): Promise<CdpAsistencia[]> {
  const { data, error } = await supabase.rpc('fn_listar_cdp_asistencia', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return (data as CdpAsistencia[]) ?? [];
}

/**
 * KAN-490: aplica la Casa de Paz capturada (y el invitado_por) a una persona ya
 * creada, en las puertas de entrada Altar/Bautismo/RSIL (fn_asignar_entrada_cdp).
 * El frontend ya resolvió la casa_de_paz_id final (sugerida del invitador o
 * elegida); si va vacía, la persona queda sin CdP (designación).
 */
export async function asignarEntradaCdp(
  personaId: string,
  iglesiaId: string,
  datos: { invitadorPersonaId: string; invitadorNombre: string; invitadorEsLibre: boolean; casaDePazId: string },
): Promise<void> {
  const { error } = await supabase.rpc('fn_asignar_entrada_cdp', {
    p_persona_id: personaId,
    p_iglesia_id: iglesiaId,
    p_payload: {
      invitador_persona_id: datos.invitadorEsLibre ? '' : datos.invitadorPersonaId,
      invitador_txt: datos.invitadorEsLibre ? datos.invitadorNombre : '',
      casa_de_paz_id: datos.casaDePazId,
    },
  });
  if (error) throw error;
}
