import { supabase } from './supabase';
import { aISO } from '@/utils/calendario-fechas';
import { calcularEdad } from '@/utils/edad';
import type {
  CargoCdpCodigo,
  CargoRedCodigo,
  CargoVigente,
  CdpHistoricoEliminada,
  CdpPerfil,
  CdpResumen,
  Ciudad,
  DatosDomicilioCdp,
  DatosNuevaCdp,
  DomicilioCdp,
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

/**
 * Crea una Casa de Paz ya con líder, gente y lugar de reunión definidos --
 * sin líder la etiqueta cae en "Casa de Paz sin líder" (fn_etiqueta_cdp), así
 * que ya no se pide un nombre manual: se pide directamente quién lidera.
 * Reusa `actualizarReunionCdp`/`guardarDomicilioCdp` (misma lógica que la
 * edición del Perfil) en vez de duplicarla acá.
 */
export async function crearCdp(iglesiaId: string, redId: string, datos: DatosNuevaCdp): Promise<{ id: string }> {
  const { data: cdp, error: errorCdp } = await supabase
    .from('casa_de_paz')
    .insert({ iglesia_id: iglesiaId, modalidad: datos.modalidad })
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

  const codigosCargo: CargoCdpCodigo[] = ['LIDER_CDP'];
  if (datos.sublideresIds.length > 0) codigosCargo.push('SUBLIDER_CDP');
  if (datos.anfitrionId) codigosCargo.push('ANFITRION');

  const { data: cargosData, error: errorCargos } = await supabase
    .from('cargo')
    .select('id, codigo')
    .in('codigo', codigosCargo)
    .eq('activo', true);
  if (errorCargos) throw errorCargos;
  const cargoIdPorCodigo = new Map((cargosData ?? []).map((c) => [c.codigo, c.id]));

  const fechaHoy = aISO(new Date());
  const filasCargo: { iglesia_id: string; casa_de_paz_id: string; persona_id: string; cargo_id: string; fecha_inicio: string }[] = [
    { iglesia_id: iglesiaId, casa_de_paz_id: cdp.id, persona_id: datos.liderId, cargo_id: cargoIdPorCodigo.get('LIDER_CDP')!, fecha_inicio: fechaHoy },
  ];
  for (const personaId of datos.sublideresIds) {
    filasCargo.push({ iglesia_id: iglesiaId, casa_de_paz_id: cdp.id, persona_id: personaId, cargo_id: cargoIdPorCodigo.get('SUBLIDER_CDP')!, fecha_inicio: fechaHoy });
  }
  if (datos.anfitrionId) {
    filasCargo.push({ iglesia_id: iglesiaId, casa_de_paz_id: cdp.id, persona_id: datos.anfitrionId, cargo_id: cargoIdPorCodigo.get('ANFITRION')!, fecha_inicio: fechaHoy });
  }

  const { error: errorFilasCargo } = await supabase.from('casa_de_paz_cargo').insert(filasCargo);
  if (errorFilasCargo) throw errorFilasCargo;

  // Día/hora y domicilio son datos opcionales de un perfil que ya existe: si
  // fallan (p.ej. la migración de dia_reunion/hora_reunion todavía no está
  // aplicada en esta base) la Casa de Paz no debe quedar sin crear ni el
  // usuario debe reintentar sobre lo mismo -- eso fue justamente lo que dejó
  // Casas de Paz huérfanas la primera vez. Degradan en silencio, igual que ya
  // hace el Perfil de Casa de Paz con estos mismos campos.
  if (datos.diaReunion !== null || datos.horaReunion !== null) {
    try {
      await actualizarReunionCdp(cdp.id, datos.diaReunion, datos.horaReunion);
    } catch (e) {
      console.warn('No se pudo guardar el día/hora de reunión al crear la Casa de Paz', e);
    }
  }

  if (datos.domicilio) {
    try {
      await guardarDomicilioCdp(iglesiaId, cdp.id, datos.domicilio);
    } catch (e) {
      console.warn('No se pudo guardar la dirección de reunión al crear la Casa de Paz', e);
    }
  }

  return cdp;
}

export async function toggleActivoCdp(cdpId: string, activo: boolean) {
  const { error } = await supabase.from('casa_de_paz').update({ activo }).eq('id', cdpId);
  if (error) throw error;
}

/** Resumen del Perfil (red vigente, estado, apertura, día/hora de reunión). */
export async function obtenerCdpPerfil(cdpId: string): Promise<CdpPerfil> {
  const { data, error } = await supabase.rpc('fn_mi_cdp_perfil', { p_casa_de_paz_id: cdpId });
  if (error) throw error;
  return data as CdpPerfil;
}

/**
 * Actualiza día/hora de reunión de la CdP. Update directo: la política
 * pol_casa_de_paz_update ya autoriza al Líder de CdP (igual que toggleActivoCdp).
 */
export async function actualizarReunionCdp(cdpId: string, diaReunion: number | null, horaReunion: string | null) {
  const { error } = await supabase
    .from('casa_de_paz')
    .update({ dia_reunion: diaReunion, hora_reunion: horaReunion })
    .eq('id', cdpId);
  if (error) throw error;
}

/** Baja lógica: la tabla `casa_de_paz` bloquea el DELETE físico (trigger), así
 * que se desactiva y se marca `fecha_eliminacion` a la vez. Va por RPC
 * (SECURITY DEFINER) en vez de un UPDATE directo porque el trigger que cierra
 * membresías activas de la CdP escribe en `casa_de_paz_membresia`, tabla cuya
 * política RLS no incluye a un Líder de Red -- mismo patrón que
 * fn_fusionar_cdp/fn_multiplicar_cdp. */
export async function eliminarCdp(cdpId: string, motivo?: string) {
  const { error } = await supabase.rpc('fn_eliminar_cdp', { p_casa_de_paz_id: cdpId, p_motivo: motivo ?? null });
  if (error) throw error;
}

/** KAN-34: Histórico Anual de Casas de Paz eliminadas, filtrable por año y por Red. */
export async function obtenerHistoricoCdpEliminadas(
  iglesiaId: string,
  anio?: number,
  redId?: string
): Promise<CdpHistoricoEliminada[]> {
  const { data, error } = await supabase.rpc('fn_historico_cdp_eliminadas', {
    p_iglesia_id: iglesiaId,
    p_anio: anio ?? null,
    p_red_id: redId ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

export async function buscarPersonas(iglesiaId: string, texto: string, edadMinima?: number): Promise<PersonaBusqueda[]> {
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
    .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento')
    .eq('iglesia_id', iglesiaId)
    .or(condiciones)
    .limit(30);
  if (error) throw error;

  return (data ?? [])
    .map((p) => ({
      id: p.id,
      nombre_completo: [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' '),
      fecha_nacimiento: p.fecha_nacimiento as string | null,
    }))
    .filter((p) => {
      const nombreNormalizado = p.nombre_completo.toLowerCase();
      return tokens.every((t) => nombreNormalizado.includes(t.toLowerCase()));
    })
    // Sin fecha de nacimiento registrada no se puede saber si es menor -- se
    // deja pasar en vez de ocultar a alguien por falta de datos.
    .filter((p) => !edadMinima || !p.fecha_nacimiento || calcularEdad(p.fecha_nacimiento) >= edadMinima)
    .slice(0, 10)
    .map(({ id, nombre_completo }) => ({ id, nombre_completo }));
}

// KAN-205: RPC en vez de consulta directa -- persona.correo (campo de
// perfil aparte) casi siempre está vacío; el correo real de inicio de
// sesión vive en auth.users, solo accesible desde una función SECURITY
// DEFINER. Regla pedida por el owner para todo VisionHub: sin nombre,
// mostrar correo, siempre.
export async function obtenerCargoVigenteRed(redId: string, codigo: CargoRedCodigo): Promise<CargoVigente[]> {
  const { data, error } = await supabase.rpc('fn_cargo_vigente_red', { p_red_id: redId, p_codigo: codigo });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerCargoVigenteCdp(cdpId: string, codigo: CargoCdpCodigo): Promise<CargoVigente[]> {
  const { data, error } = await supabase.rpc('fn_cargo_vigente_cdp', { p_cdp_id: cdpId, p_codigo: codigo });
  if (error) throw error;
  return data ?? [];
}

const CARGOS_EXCLUSIVOS_RED: CargoRedCodigo[] = ['LIDER_RED', 'ENCARGADO_DEPARTAMENTOS_RED', 'ENCARGADO_MINISTERIO_RED'];
const CARGOS_EXCLUSIVOS_CDP: CargoCdpCodigo[] = ['LIDER_CDP', 'ANFITRION'];

export async function asignarCargoRed(
  iglesiaId: string,
  redId: string,
  personaId: string,
  codigo: CargoRedCodigo,
  cargoId: string
): Promise<{ pendiente: boolean }> {
  // Cambiar de Líder de Red pasa por el RPC server-side: si lo pide el
  // Supervisor y la Red ya tiene Líder vigente, queda pendiente de su
  // autorización en vez de aplicarse al instante (ver 58_solicitudes_estructura.sql).
  // El resto de los cargos (encargados, etc.) sigue el camino directo de siempre.
  if (codigo === 'LIDER_RED') {
    const { data, error } = await supabase.rpc('fn_asignar_cargo_red', {
      p_red_id: redId,
      p_persona_id: personaId,
      p_codigo: codigo,
      p_cargo_id: cargoId,
    });
    if (error) throw error;
    return { pendiente: data === null };
  }

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
  return { pendiente: false };
}

export async function asignarCargoCdp(
  iglesiaId: string,
  cdpId: string,
  personaId: string,
  codigo: CargoCdpCodigo,
  cargoId: string
): Promise<{ pendiente: boolean }> {
  // Cambiar de Líder de CdP -- mismo gate que asignarCargoRed, ver ahí.
  if (codigo === 'LIDER_CDP') {
    const { data, error } = await supabase.rpc('fn_asignar_cargo_cdp', {
      p_cdp_id: cdpId,
      p_persona_id: personaId,
      p_codigo: codigo,
      p_cargo_id: cargoId,
    });
    if (error) throw error;
    return { pendiente: data === null };
  }

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
  return { pendiente: false };
}

export async function quitarCargoRed(cargoAsignacionId: string) {
  const { error } = await supabase.from('red_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', cargoAsignacionId);
  if (error) throw error;
}

export async function quitarCargoCdp(cargoAsignacionId: string) {
  const { error } = await supabase.from('casa_de_paz_cargo').update({ fecha_fin: aISO(new Date()) }).eq('id', cargoAsignacionId);
  if (error) throw error;
}

export async function obtenerCiudades(): Promise<Ciudad[]> {
  const { data, error } = await supabase.from('ciudad').select('id, codigo, nombre').eq('activo', true).order('orden');
  if (error) throw error;
  return data ?? [];
}

export async function obtenerDomicilioCdp(cdpId: string): Promise<DomicilioCdp | null> {
  const { data, error } = await supabase
    .from('direccion_asignacion')
    .select('id, direccion:direccion_id(id, ciudad_id, zona, calle, numero, referencia, url_gps, ciudad:ciudad_id(nombre))')
    .eq('casa_de_paz_id', cdpId)
    .eq('activo', true)
    .is('fecha_eliminacion', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const d = Array.isArray(data.direccion) ? data.direccion[0] : data.direccion;
  if (!d || !d.ciudad_id) return null;
  const ciudad = Array.isArray(d.ciudad) ? d.ciudad[0] : d.ciudad;

  return {
    asignacion_id: data.id,
    direccion_id: d.id,
    ciudad_id: d.ciudad_id,
    ciudad_nombre: ciudad?.nombre ?? '',
    zona: d.zona,
    calle: d.calle,
    numero: d.numero,
    referencia: d.referencia,
    url_gps: d.url_gps ?? null,
  };
}

export async function guardarDomicilioCdp(iglesiaId: string, cdpId: string, datos: DatosDomicilioCdp) {
  const payload = {
    ciudad_id: datos.ciudadId,
    zona: datos.zona,
    calle: datos.calle,
    numero: datos.numero,
    referencia: datos.referencia,
    url_gps: datos.url_gps,
  };

  const { data: existente, error: errBuscar } = await supabase
    .from('direccion_asignacion')
    .select('id, direccion_id')
    .eq('casa_de_paz_id', cdpId)
    .eq('activo', true)
    .is('fecha_eliminacion', null)
    .maybeSingle();
  if (errBuscar) throw errBuscar;

  if (existente) {
    const { error } = await supabase.from('direccion').update(payload).eq('id', existente.direccion_id);
    if (error) throw error;
    return;
  }

  const { data: direccion, error: errDireccion } = await supabase
    .from('direccion')
    .insert({ iglesia_id: iglesiaId, ...payload })
    .select('id')
    .single();
  if (errDireccion) throw errDireccion;

  const { error } = await supabase
    .from('direccion_asignacion')
    .insert({ iglesia_id: iglesiaId, direccion_id: direccion.id, casa_de_paz_id: cdpId });
  if (error) throw error;
}
