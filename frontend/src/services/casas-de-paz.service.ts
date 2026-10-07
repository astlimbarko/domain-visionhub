import { supabase } from './supabase';
import { aISO } from '@/utils/calendario-fechas';
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
  PersonaSimilar,
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

/**
 * Actualiza día/hora de reunión de la CdP DEJANDO HISTORIAL de quién cambió y
 * cuándo (pedido del owner desde el panel del Constructor). A diferencia de
 * `actualizarReunionCdp` (update directo), esto va por RPC SECURITY DEFINER
 * `fn_cdp_actualizar_horario` -- esa función es la que escribe la fila de
 * historial además de actualizar la tabla, por eso NO se hace el update
 * directo acá. (La RPC la crea el equipo de backend; mientras no exista, esta
 * llamada falla y el toast de error del diálogo lo refleja.)
 */
export async function actualizarHorarioCdp(cdpId: string, diaReunion: number | null, horaReunion: string | null) {
  const { error } = await supabase.rpc('fn_cdp_actualizar_horario', {
    p_cdp_id: cdpId,
    p_dia: diaReunion,
    p_hora: horaReunion,
  });
  if (error) throw error;
}

/** Una entrada del historial de cambios de horario de una CdP
 * (fn_cdp_historial_horario), más nuevo primero. */
export interface HorarioCdpCambio {
  /** 0=domingo … 6=sábado, o null si ese cambio lo dejó sin definir. */
  dia_reunion: number | null;
  /** 'HH:MM:SS' o null. */
  hora_reunion: string | null;
  /** Nombre de quien hizo el cambio (null si no se pudo resolver). */
  cambiado_por_nombre: string | null;
  /** timestamptz ISO del cambio. */
  fecha_cambio: string;
}

/** KAN (horario con historial): lista de cambios de día/hora de una CdP. La RPC
 * `fn_cdp_historial_horario` la crea el equipo de backend; mientras no exista,
 * la query falla y el historial simplemente no se muestra. */
export async function obtenerHistorialHorarioCdp(cdpId: string): Promise<HorarioCdpCambio[]> {
  const { data, error } = await supabase.rpc('fn_cdp_historial_horario', { p_cdp_id: cdpId });
  if (error) throw error;
  return (data ?? []) as HorarioCdpCambio[];
}

/** Día/hora de reunión VIGENTE de una CdP, leído con permiso de constructor
 * (super admin/pastor/supervisor/líder de red/líder de CdP). A diferencia de
 * fn_mi_cdp_perfil, NO exige ser miembro de la CdP -- por eso el panel del
 * organigrama usa esta y no el perfil (2026-10-07: el perfil tiraba
 * PERFIL_FUERA_DE_ALCANCE para un admin que no es de esa CdP, y el horario
 * nunca se mostraba aunque estuviera guardado). */
export async function obtenerHorarioCdp(cdpId: string): Promise<{ dia_reunion: number | null; hora_reunion: string | null }> {
  const { data, error } = await supabase.rpc('fn_cdp_horario_actual', { p_cdp_id: cdpId });
  if (error) throw error;
  const fila = (data ?? [])[0] as { dia_reunion: number | null; hora_reunion: string | null } | undefined;
  return { dia_reunion: fila?.dia_reunion ?? null, hora_reunion: fila?.hora_reunion ?? null };
}

/** Una entrada del historial de LÍDER de una CdP (fn_cdp_historial_lider), más
 * nuevo primero. Cada persona que fue líder, desde/hasta cuándo y quién la
 * designó. */
export interface LiderCdpCambio {
  persona_nombre: string;
  /** Nombre de quién designó a esa persona como líder (null si no se pudo resolver). */
  designado_por_nombre: string | null;
  fecha_inicio: string;
  /** null = sigue siendo el líder vigente. */
  fecha_fin: string | null;
  vigente: boolean;
}

/** Historial de cambios de líder de una CdP (fn_cdp_historial_lider). El dato ya
 * vive en casa_de_paz_cargo (fecha_inicio/fecha_fin por designación). */
export async function obtenerHistorialLiderCdp(cdpId: string): Promise<LiderCdpCambio[]> {
  const { data, error } = await supabase.rpc('fn_cdp_historial_lider', { p_cdp_id: cdpId });
  if (error) throw error;
  return (data ?? []) as LiderCdpCambio[];
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

/** KAN-391: resuelve de qué CdP es miembro principal cada persona de un lote
 * -- vía RPC (`fn_origen_cdp_personas`) porque la RLS de `casa_de_paz`
 * bloquea al Líder/Sublíder de CdP leer el nombre de una CdP ajena con un
 * `.select()` normal, aunque la persona en sí sea visible. */
type FilaOrigenCdp = { persona_id: string; casa_de_paz_id: string; casa_de_paz_nombre: string };

async function enriquecerConOrigenCdp(personas: PersonaBusqueda[]): Promise<PersonaBusqueda[]> {
  if (personas.length === 0) return personas;
  const { data, error } = await supabase.rpc('fn_origen_cdp_personas', { p_persona_ids: personas.map((p) => p.id) });
  if (error) throw error;
  // El cliente de Supabase no está tipado con el schema (createClient sin
  // Database genérico, ver supabase.ts) -- sin esta anotación explícita,
  // tsc infiere `data` como `{}[]` en vez de `any[]` y rompe el build de
  // producción (tsc -b sí es estricto, a diferencia de vite dev/HMR que no
  // lo nota). Mismo shape que retorna fn_origen_cdp_personas.
  const filas = (data ?? []) as FilaOrigenCdp[];
  const origenPorPersona = new Map(filas.map((r) => [r.persona_id, { id: r.casa_de_paz_id, nombre: r.casa_de_paz_nombre }]));
  return personas.map((p) => {
    const origen = origenPorPersona.get(p.id);
    return origen ? { ...p, casa_de_paz_id: origen.id, casa_de_paz_nombre: origen.nombre } : p;
  });
}

/**
 * Q-MR-12 (2026-08-15) + KAN-419 seguimiento (2026-09-22, pedido explícito
 * del owner): con `cdpId`, prioriza 3 niveles EN ORDEN -- la propia Casa de
 * Paz, si ahí no aparece nadie entonces toda su Red, y recién si tampoco hay
 * resultado ahí, toda la iglesia (puede visitar la CdP alguien de otra
 * parte y hay que poder anotarlo igual). Sin `cdpId` (ej. cargos de Red/
 * Departamento), busca en toda la iglesia directamente, como siempre. Los 3
 * niveles se resuelven en un solo viaje a `fn_buscar_personas_reporte`
 * (SQL, con `RETURN` anticipado apenas un nivel tiene resultados).
 *
 * KAN-418: el filtro que exige que TODAS las palabras buscadas aparezcan en
 * el nombre completo ("Juan Perez" encuentra a alguien buscado por nombre y
 * apellido a la vez) también vive en esa función (SQL), no en JS -- antes
 * se traía un lote de hasta 30 filas que matcheaban CUALQUIER palabra y se
 * filtraba en el cliente, así que con nombres comunes la persona buscada
 * podía quedar fuera de esas 30 filas antes de llegar al filtro.
 */
export async function buscarPersonas(iglesiaId: string, texto: string, edadMinima?: number, cdpId?: string): Promise<PersonaBusqueda[]> {
  if (!texto.trim()) return [];

  const { data, error } = await supabase.rpc('fn_buscar_personas_reporte', {
    p_iglesia_id: iglesiaId,
    p_texto: texto,
    p_edad_minima: edadMinima ?? null,
    p_cdp_id: cdpId ?? null,
    p_limite: 10,
  });
  if (error) throw error;

  // KAN-391: de qué CdP viene cada resultado, para mostrar el origen cuando
  // no es de la CdP activa -- vía RPC aparte (ver enriquecerConOrigenCdp),
  // no con un `.select()` anidado (la RLS de `casa_de_paz` lo bloquea).
  return enriquecerConOrigenCdp((data ?? []) as PersonaBusqueda[]);
}

export interface DatosNombreBusquedaSimilitud {
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  /** KAN-497 paso 12: señales fuertes además del nombre -- CI/teléfono
   * exactos pesan más que la similitud de nombre (ver fn_buscar_personas_
   * similares). Opcionales: no todos los formularios piden CI (Bautismo/RSIL
   * no lo tienen todavía). `telefono` va compuesto (ej. "+59170000000",
   * mismo formato que `componerTelefono`), no el número suelto. */
  ci?: string;
  telefono?: string;
  sexo?: 'M' | 'F' | '';
}

/**
 * KAN-407: antes de dar de alta una persona "nueva" (Evangelismo, Casas de
 * Paz), busca coincidencias tolerantes a errores de tipeo (pg_trgm) contra
 * las personas ya cargadas en la misma iglesia -- `buscarPersonas` de arriba
 * (ILIKE) exige un substring literal y no detecta a la misma persona escrita
 * distinto ("Alberto Peres" vs "Alberto Pérez"), lo que terminaba en fichas
 * duplicadas de la misma persona real.
 */
export async function buscarPersonasSimilares(
  iglesiaId: string,
  datos: DatosNombreBusquedaSimilitud
): Promise<PersonaSimilar[]> {
  // KAN-497 paso 12: antes exigía nombre + apellido -- ahora alcanza con
  // CUALQUIER señal (nombre, CI o teléfono), para que una persona que ya
  // cargó su documento o teléfono antes que el nombre completo también
  // dispare la búsqueda ("mientras más lleno, más certero", pero sirve
  // incluso con pocos datos).
  const tieneNombre = datos.primer_nombre.trim() !== '' && datos.primer_apellido.trim() !== '';
  const tieneCi = !!datos.ci?.trim();
  const tieneTelefono = !!datos.telefono?.trim();
  if (!tieneNombre && !tieneCi && !tieneTelefono) return [];
  const { data, error } = await supabase.rpc('fn_buscar_personas_similares', {
    p_iglesia_id: iglesiaId,
    p_primer_nombre: datos.primer_nombre.trim(),
    p_primer_apellido: datos.primer_apellido.trim(),
    p_segundo_nombre: datos.segundo_nombre?.trim() || null,
    p_segundo_apellido: datos.segundo_apellido?.trim() || null,
    p_ci: datos.ci?.trim() || null,
    p_telefono: datos.telefono?.trim() || null,
    p_sexo: datos.sexo || null,
  });
  if (error) throw error;
  // Mismo motivo que enriquecerConOrigenCdp: el cliente de Supabase no está
  // tipado con el schema, `data` llega como `any[]`.
  return (data ?? []) as PersonaSimilar[];
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

// El cierre del cargo anterior en los exclusivos ahora lo hace la RPC
// server-side (fn_asignar_cargo_cdp / fn_asignar_cargo_red), no el cliente --
// por eso ya no se usan las listas CARGOS_EXCLUSIVOS_* acá.

export async function asignarCargoRed(
  _iglesiaId: string,
  redId: string,
  personaId: string,
  codigo: CargoRedCodigo,
  cargoId: string
): Promise<{ pendiente: boolean }> {
  // Fix 2026-10-03 (mismo problema que asignarCargoCdp): TODOS los cargos de
  // Red pasan por la RPC fn_asignar_cargo_red (SECURITY DEFINER), no solo
  // LIDER_RED. Antes, sublíder/encargados se asignaban por INSERT directo
  // sujeto a la RLS de red_cargo (que excluye a Pastor y Super Admin), así que
  // asignar a una persona EXISTENTE les fallaba. La RPC ya tiene el permiso
  // correcto y cierra el cargo anterior en los exclusivos. `data === null` =
  // quedó pendiente de autorización (solicitud de cambio de Líder).
  const { data, error } = await supabase.rpc('fn_asignar_cargo_red', {
    p_red_id: redId,
    p_persona_id: personaId,
    p_codigo: codigo,
    p_cargo_id: cargoId,
  });
  if (error) throw error;
  return { pendiente: data === null };
}

export async function asignarCargoCdp(
  _iglesiaId: string,
  cdpId: string,
  personaId: string,
  codigo: CargoCdpCodigo,
  cargoId: string
): Promise<{ pendiente: boolean }> {
  // Fix 2026-10-03: TODOS los cargos de CdP (no solo LIDER_CDP) pasan por la
  // RPC fn_asignar_cargo_cdp (SECURITY DEFINER). Antes, sublíder/anfitrión se
  // asignaban por INSERT directo del cliente, sujeto a la política RLS de
  // INSERT de casa_de_paz_cargo -- que NO permite al Pastor ni al Super Admin
  // (solo Supervisor Visión en Acción / líder de la CdP / líder de la Red),
  // así que asignar a una persona EXISTENTE les fallaba con "new row violates
  // row-level security policy". La RPC ya tiene el permiso correcto
  // (super admin + pastor + supervisor + líder de red), cierra el cargo
  // anterior en los exclusivos (LIDER_CDP/ANFITRION) y crea el usuario_rol del
  // sublíder. `data === null` = quedó pendiente de autorización (solicitud de
  // cambio de Líder pedida por el Supervisor), igual que antes.
  const { data, error } = await supabase.rpc('fn_asignar_cargo_cdp', {
    p_cdp_id: cdpId,
    p_persona_id: personaId,
    p_codigo: codigo,
    p_cargo_id: cargoId,
  });
  if (error) throw error;
  return { pendiente: data === null };
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
