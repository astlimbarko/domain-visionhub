// KAN-488 (harness/21, Membresía desde 0): autoguardado del borrador en la
// BD (tabla membresia_borrador), 1 por usuario+iglesia. Mismo criterio que el
// borrador de reporte de CdP (KAN-435): el payload es todo el formulario como
// JSON, no toca las tablas reales de persona hasta que se presiona "Guardar".
import { supabase } from './supabase';
import { componerTelefono, desglosarTelefono } from '@/utils/paises-telefono';
import { DATOS_MEMBRESIA_NUEVOS_VACIO, type DatosMembresiaNuevos } from '@/types/membresia-nuevos.types';

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
  actualizada?: boolean;
}

/**
 * harness/21 Req 1: trae los datos de una persona EXISTENTE mapeados a los
 * campos del formulario de Membresía desde 0, para precargarlo (ej. al llegar
 * desde el botón "Llenar membresía" de Bautismo, o al buscar a alguien ya
 * registrado). El teléfono se separa en país + número con desglosarTelefono.
 */
export async function obtenerPersonaParaMembresia(personaId: string): Promise<DatosMembresiaNuevos> {
  const { data, error } = await supabase.rpc('fn_obtener_persona_para_membresia', { p_persona_id: personaId });
  if (error) throw error;
  const d = data as Record<string, string | boolean>;
  const tel = desglosarTelefono((d.telefono as string) || '');
  return {
    ...DATOS_MEMBRESIA_NUEVOS_VACIO,
    personaExistenteId: (d.persona_id as string) ?? personaId,
    primerNombre: (d.primer_nombre as string) || '',
    segundoNombre: (d.segundo_nombre as string) || '',
    primerApellido: (d.primer_apellido as string) || '',
    segundoApellido: (d.segundo_apellido as string) || '',
    sexo: ((d.sexo as string) || '') as DatosMembresiaNuevos['sexo'],
    fechaNacimiento: (d.fecha_nacimiento as string) || '',
    telefonoPais: tel.pais?.codigo ?? '+591',
    telefonoNumero: tel.numero,
    direccion: (d.direccion as string) || '',
    ci: (d.ci as string) || '',
    ciNoRecuerda: (d.ci_no_recuerda as boolean) ?? false,
    correo: (d.correo as string) || '',
    estadoCivil: (d.estado_civil as string) || '',
    ocupacion: (d.ocupacion as string) || '',
    gradoInstruccion: (d.grado_instruccion as string) || '',
    discipuladoNivel: (d.discipulado_nivel as string) || '',
    motivoLlegadaId: (d.motivo_llegada_id as string) || '',
    invitadorPersonaId: (d.invitador_persona_id as string) || '',
    invitadorNombre: (d.invitador_nombre as string) || '',
    invitadorEsLibre: (d.invitador_es_libre as boolean) ?? false,
    casaDePazId: (d.casa_de_paz_id as string) || '',
    casaDePazNombre: (d.casa_de_paz_nombre as string) || '',
  };
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
    persona_id: datos.personaExistenteId,
    primer_nombre: datos.primerNombre,
    segundo_nombre: datos.segundoNombre,
    primer_apellido: datos.primerApellido,
    segundo_apellido: datos.segundoApellido,
    sexo: datos.sexo,
    fecha_nacimiento: datos.fechaNacimiento,
    ci: datos.ci,
    ci_no_recuerda: datos.ciNoRecuerda,
    correo: datos.correo,
    estado_civil: datos.estadoCivil,
    grado_instruccion: datos.gradoInstruccion,
    ocupacion: datos.ocupacion,
    telefono: componerTelefono(datos.telefonoPais, datos.telefonoNumero),
    direccion: datos.direccion,
    motivo_llegada_id: datos.motivoLlegadaId,
    discipulado_nivel: datos.discipuladoNivel,
    es_visita: datos.esVisita,
    // KAN-490: el frontend resuelve la CdP final; invitador por id (sistema) o txt (libre).
    invitador_persona_id: datos.invitadorEsLibre ? '' : datos.invitadorPersonaId,
    invitador_txt: datos.invitadorEsLibre ? datos.invitadorNombre : '',
    casa_de_paz_id: datos.casaDePazId,
    // UX 2026-10-02: Familia + Cónyuge (el cónyuge es un familiar con
    // tipo_relacion_codigo='CONYUGE'). La RPC los inserta en referencia_familiar.
    familiares: datos.familiares,
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

/** KAN-497 paso 6: dirección principal y ciudad de cada Casa de Paz, indexadas
 * por casa_de_paz_id (para el buscador). */
export async function listarDireccionesPrincipalesCdp(
  iglesiaId: string,
): Promise<Record<string, { direccion: string | null; ciudad: string | null }>> {
  const { data, error } = await supabase.rpc('fn_direccion_principal_cdp', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  const mapa: Record<string, { direccion: string | null; ciudad: string | null }> = {};
  for (const fila of (data as { casa_de_paz_id: string; direccion: string | null; ciudad: string | null }[]) ?? []) {
    mapa[fila.casa_de_paz_id] = { direccion: fila.direccion, ciudad: fila.ciudad };
  }
  return mapa;
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
