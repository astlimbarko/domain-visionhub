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
    es_visita: datos.esVisita,
    cdp_modo: datos.cdpModo,
    invitador_persona_id: datos.invitadorPersonaId,
    casa_de_paz_id: datos.casaDePazId,
  };
  const { data, error } = await supabase.rpc('fn_guardar_membresia_nuevos', {
    p_iglesia_id: iglesiaId,
    p_payload: payload,
  });
  if (error) throw error;
  return data as MembresiaNuevosGuardada;
}
