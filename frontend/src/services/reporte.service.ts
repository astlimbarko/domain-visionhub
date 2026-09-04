import { supabase } from './supabase';
import { agregarTelefono, obtenerTiposTelefono } from './persona.service';
import { calcularEdad } from '@/utils/edad';
import { aISO } from '@/utils/calendario-fechas';
import type {
  CamposObligatoriosReporte,
  DiezmoLinea,
  HistorialAsistencia,
  Libro,
  MegaFiestaDelDia,
  MiembroCdp,
  NuevoReporte,
  ReporteExistente,
  ReporteRedFila,
  ReporteReciente,
  ResultadoReporte,
  Tema,
} from '@/types/reporte.types';

/**
 * Convierte la lista de diezmantes del formulario al payload `[{persona_id,
 * monto}]` que espera fn_registrar_diezmos_reporte. Cada diezmante existente usa
 * su personaId; cada diezmante nuevo (tecleado a mano) se crea como persona
 * "lead" (membresia_completada: false, igual que las visitas del reporte) con su
 * celular opcional. Se ignoran las líneas con monto <= 0.
 */
async function construirDiezmosPayload(
  iglesiaId: string,
  diezmos: DiezmoLinea[]
): Promise<{ persona_id: string; monto: number }[]> {
  const validos = diezmos.filter((d) => d.monto > 0);
  const tieneTelefono = validos.some((d) => !d.personaId && d.telefono?.trim());
  const tipoTelefonoId = tieneTelefono ? (await obtenerTiposTelefono())[0]?.id : undefined;

  return Promise.all(
    validos.map(async (d) => {
      if (d.personaId) return { persona_id: d.personaId, monto: d.monto };

      const { data: persona, error } = await supabase
        .from('persona')
        // Diezmante que no está en el sistema: lead, no miembro completo (mismo
        // motivo que las visitas -- DEFAULT true + trigger de CI obligatorio).
        .insert({
          iglesia_id: iglesiaId,
          primer_nombre: d.primer_nombre,
          primer_apellido: d.primer_apellido,
          sexo: d.sexo,
          membresia_completada: false,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (d.telefono?.trim() && tipoTelefonoId) {
        await agregarTelefono(iglesiaId, persona.id, tipoTelefonoId, d.telefono.trim(), null, true);
      }
      return { persona_id: persona.id, monto: d.monto };
    })
  );
}

export async function obtenerLibros(): Promise<Libro[]> {
  const { data, error } = await supabase.from('cdp_libro').select('id, numero, nombre').eq('activo', true).order('numero');
  if (error) throw error;
  return data ?? [];
}

export async function obtenerTemas(libroId: string, iglesiaId: string): Promise<Tema[]> {
  const { data, error } = await supabase
    .from('cdp_tema')
    .select('id, libro_id, numero, nombre, es_especial')
    .eq('libro_id', libroId)
    .eq('activo', true)
    .or(`iglesia_id.is.null,iglesia_id.eq.${iglesiaId}`)
    .order('numero');
  if (error) throw error;
  return data ?? [];
}

export async function obtenerMiembrosCdp(casaDePazId: string): Promise<MiembroCdp[]> {
  const { data, error } = await supabase
    .from('casa_de_paz_membresia')
    .select('persona_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento)')
    .eq('casa_de_paz_id', casaDePazId)
    .is('fecha_fin', null);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const p = Array.isArray(r.persona) ? r.persona[0] : r.persona;
    const nombre = [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ');
    return {
      persona_id: r.persona_id,
      nombre_completo: nombre,
      tiene_fecha_nacimiento: !!p?.fecha_nacimiento,
      edad: p?.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null,
    };
  });
}

/**
 * Umbral de edad que separa "niño" de "regular", configurable por iglesia
 * (`EDAD_MINIMA_CREYENTE`, criterio ya usado por el backend para Estados
 * SSVA y el Dashboard). Antes este umbral estaba hardcodeado en 12 acá: si
 * una iglesia lo configura distinto, alguien podía quedar mal clasificado
 * hasta que de casualidad coincidiera con el default.
 */
export async function obtenerEdadMinimaCreyente(iglesiaId: string): Promise<number> {
  const { data, error } = await supabase.rpc('fn_criterio', { p_iglesia_id: iglesiaId, p_codigo: 'EDAD_MINIMA_CREYENTE' });
  if (error) throw error;
  return data ?? 12;
}

/** KAN-31: plazo de gracia (días) para considerar un reporte "a tiempo" en
 * Control de Reportes -- ya no es un número fijo en el componente. */
export async function obtenerDiasPlazoReporte(iglesiaId: string): Promise<number> {
  const { data, error } = await supabase.rpc('fn_criterio', { p_iglesia_id: iglesiaId, p_codigo: 'DIAS_PLAZO_REPORTE' });
  if (error) throw error;
  return data ?? 2;
}

export async function obtenerCamposObligatorios(iglesiaId: string): Promise<CamposObligatoriosReporte> {
  const { data, error } = await supabase.rpc('fn_config_formulario', {
    p_iglesia_id: iglesiaId,
    p_formulario: 'FORMULARIO_REPORTE',
  });
  if (error) throw error;
  return data as CamposObligatoriosReporte;
}

export async function obtenerMegaFiestaDelDia(casaDePazId: string, fecha: string): Promise<MegaFiestaDelDia | null> {
  const { data: cdr, error: errorRed } = await supabase
    .from('casa_de_paz_red')
    .select('red_id')
    .eq('casa_de_paz_id', casaDePazId)
    .is('fecha_fin', null)
    .maybeSingle();
  if (errorRed) throw errorRed;
  if (!cdr) return null;

  const { data, error } = await supabase
    .from('evento')
    .select('id, titulo, tipo_evento:tipo_evento_id(codigo)')
    .eq('red_id', cdr.red_id)
    .eq('fecha_inicio', fecha)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const tipo = Array.isArray(data.tipo_evento) ? data.tipo_evento[0] : data.tipo_evento;
  if (tipo?.codigo !== 'MEGA_FIESTA') return null;
  return { evento_id: data.id, titulo: data.titulo };
}

export async function obtenerReportesRecientes(casaDePazIds: string[]): Promise<ReporteReciente[]> {
  if (casaDePazIds.length === 0) return [];
  const { data, error } = await supabase
    .from('v_reporte_totales')
    .select('reporte_id, casa_de_paz_id, fecha_reunion, total_asistentes, total_menores, total_mayores')
    .in('casa_de_paz_id', casaDePazIds)
    .order('fecha_reunion', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.reporte_id,
    casa_de_paz_id: r.casa_de_paz_id,
    fecha_reunion: r.fecha_reunion,
    total_asistentes: r.total_asistentes,
    total_menores: r.total_menores,
    total_mayores: r.total_mayores,
  }));
}

/**
 * Última fecha de reunión con reporte enviado entre un conjunto de Casas de Paz
 * (las de una Red) -- para que Control de Reportes abra por defecto en el mes que
 * de verdad tiene datos, no siempre el mes actual (que a principios de mes está
 * vacío porque las reuniones todavía no pasaron, aunque haya reportes recién
 * cargados de reuniones del mes anterior). `null` si esas CdP no tienen ningún
 * reporte. RLS ya limita las filas a lo que el usuario puede ver.
 */
export async function obtenerUltimaFechaReporteRed(casaDePazIds: string[]): Promise<string | null> {
  if (casaDePazIds.length === 0) return null;
  const { data, error } = await supabase
    .from('casa_de_paz_reporte')
    .select('fecha_reunion')
    .in('casa_de_paz_id', casaDePazIds)
    .order('fecha_reunion', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.fecha_reunion ?? null;
}

/**
 * Anula (baja lógica) un reporte ya enviado -- p. ej. un duplicado cargado por
 * error. Mismo permiso y ventana de 7 días que la edición (KAN-271), validado
 * server-side por `fn_anular_reporte_cdp`. Da de baja también su asistencia e
 * ingresos (estos vía trigger de cascada).
 */
export async function anularReporte(reporteId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_anular_reporte_cdp', { p_reporte_id: reporteId });
  if (error) throw error;
}

/** Fechas de reunion con reporte enviado dentro del rango -- para pintar el calendario de Historial de Reportes. */
export async function obtenerFechasReportadas(casaDePazId: string, desde: string, hasta: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('casa_de_paz_reporte')
    .select('fecha_reunion')
    .eq('casa_de_paz_id', casaDePazId)
    .gte('fecha_reunion', desde)
    .lte('fecha_reunion', hasta);
  if (error) throw error;
  return (data ?? []).map((r) => r.fecha_reunion);
}

/**
 * Reportes enviados por un conjunto de Casas de Paz (las de una Red) dentro de
 * un rango — alimenta la matriz CdP × semana del "Control de Reportes" del
 * Líder de Red. Reusa `v_reporte_totales` (misma vista que "Reportes
 * recientes"); RLS ya limita las filas a las Casas de Paz que el usuario puede
 * ver, así que no hace falta un endpoint nuevo. Una fila = un reporte enviado.
 */
export async function obtenerReportesRedRango(
  casaDePazIds: string[],
  desde: string,
  hasta: string
): Promise<ReporteRedFila[]> {
  if (casaDePazIds.length === 0) return [];
  const { data, error } = await supabase
    .from('v_reporte_totales')
    .select('reporte_id, casa_de_paz_id, fecha_reunion, total_asistentes, fecha_creacion, estado_carga')
    .in('casa_de_paz_id', casaDePazIds)
    .gte('fecha_reunion', desde)
    .lte('fecha_reunion', hasta)
    .order('fecha_reunion', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReporteRedFila[];
}

// Ahora vive en su propia página (Historial de Asistencia), no en una card
// compacta metida en Reportes -- hay más lugar en pantalla, así que se
// muestran más reuniones que antes (8) para un historial más largo.
const REUNIONES_HISTORIAL = 12;

/**
 * Historial de asistencia por miembro para las ultimas `REUNIONES_HISTORIAL`
 * reuniones -- suficiente para ver la tendencia y para detectar 2 faltas
 * seguidas sin traer todo el historico. El telefono sale de
 * `telefono_asignacion` (RLS ya filtra datos confidenciales por cargo
 * ministerial, ver 28_invitaciones_y_privacidad.sql), no hace falta
 * replicar ese filtro aca.
 */
export async function obtenerHistorialAsistencia(casaDePazId: string): Promise<HistorialAsistencia> {
  // reportes y miembros son independientes entre si -- se piden en paralelo
  // en vez de uno tras otro (eran 4 round-trips en serie, quedan 2).
  const [
    { data: reportes, error: errorReportes },
    { data: miembros, error: errorMiembros },
  ] = await Promise.all([
    supabase
      .from('casa_de_paz_reporte')
      .select('id, fecha_reunion')
      .eq('casa_de_paz_id', casaDePazId)
      .order('fecha_reunion', { ascending: false })
      .limit(REUNIONES_HISTORIAL),
    supabase
      .from('casa_de_paz_membresia')
      .select(
        'persona_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento)'
      )
      .eq('casa_de_paz_id', casaDePazId)
      .is('fecha_fin', null),
  ]);
  if (errorReportes) throw errorReportes;
  if (errorMiembros) throw errorMiembros;

  const reuniones = (reportes ?? []).map((r) => ({ id: r.id, fecha_reunion: r.fecha_reunion }));
  const reporteIds = reuniones.map((r) => r.id);
  const personaIds = (miembros ?? []).map((m) => m.persona_id);

  // asistencias depende solo de reportes, telefonos depende solo de miembros
  // -- independientes entre si, tambien en paralelo.
  const [asistenciasRes, telefonosRes] = await Promise.all([
    reporteIds.length > 0
      ? supabase.from('casa_de_paz_asistencia').select('reporte_id, persona_id').in('reporte_id', reporteIds)
      : Promise.resolve({ data: [] as { reporte_id: string; persona_id: string }[], error: null }),
    personaIds.length > 0
      ? supabase
          .from('telefono_asignacion')
          .select('persona_id, telefono:telefono_id(numero)')
          .in('persona_id', personaIds)
          .eq('es_principal', true)
          .is('fecha_eliminacion', null)
      : Promise.resolve({
          data: [] as { persona_id: string; telefono: { numero: string } | { numero: string }[] | null }[],
          error: null,
        }),
  ]);
  if (asistenciasRes.error) throw asistenciasRes.error;
  if (telefonosRes.error) throw telefonosRes.error;
  const asistencias = asistenciasRes.data ?? [];
  const telefonos = telefonosRes.data ?? [];

  const asistioSet = new Set(asistencias.map((a) => `${a.reporte_id}:${a.persona_id}`));
  const telefonoPorPersona = new Map<string, string>();
  for (const t of telefonos) {
    const tel = Array.isArray(t.telefono) ? t.telefono[0] : t.telefono;
    if (tel?.numero) telefonoPorPersona.set(t.persona_id, tel.numero);
  }

  return {
    reuniones,
    miembros: (miembros ?? []).map((m) => {
      const p = Array.isArray(m.persona) ? m.persona[0] : m.persona;
      const nombre = [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ');
      return {
        persona_id: m.persona_id,
        nombre_completo: nombre,
        sexo: (p?.sexo ?? 'M') as 'M' | 'F',
        edad: p?.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null,
        telefono: telefonoPorPersona.get(m.persona_id) ?? null,
        asistio: reuniones.map((r) => asistioSet.has(`${r.id}:${m.persona_id}`)),
      };
    }),
  };
}

export async function crearReporte(datos: NuevoReporte): Promise<ResultadoReporte> {
  const { data: reporte, error: errorReporte } = await supabase
    .from('casa_de_paz_reporte')
    .insert({
      iglesia_id: datos.iglesia_id,
      casa_de_paz_id: datos.casa_de_paz_id,
      fecha_reunion: datos.fecha_reunion,
      libro_id: datos.libro_id || null,
      tema_id: datos.tema_id || null,
      tema_especial_txt: datos.tema_especial_txt || null,
      disertador_id: datos.disertador_id || null,
      evento_megafiesta_id: datos.evento_megafiesta_id || null,
      salio_evangelizar: datos.salio_evangelizar,
      evangelizados_declarados: datos.evangelizados_declarados ?? null,
      testimonios: datos.testimonios || null,
      comentarios: datos.comentarios || null,
    })
    .select('id')
    .single();
  if (errorReporte) throw errorReporte;
  const reporteId = reporte.id;

  // El reporte ya quedó insertado. Como no hay transacción del lado del
  // cliente, si un paso posterior (asistencia, ingresos) falla, el reporte
  // quedaría huérfano (0 asistencias) visible en Historial/Dashboard. Por eso
  // todo lo que sigue va dentro de un try que, ante cualquier error, revierte
  // el reporte con una baja lógica de mejor esfuerzo antes de propagar.
  try {
    const personaIds: { id: string; esMenor?: boolean; esVisita?: boolean }[] = datos.asistentesExistentes.map((a) => ({
      id: a.personaId,
      esMenor: a.esMenor,
      esVisita: a.esVisita,
    }));

    // El tipo de telefono es el mismo para todas las visitas -- antes se
    // pedia una vez por visita (N consultas identicas). Se pide una sola vez
    // arriba del loop, y las visitas se procesan en paralelo (cada una crea
    // una persona independiente, no hay dependencia entre iteraciones): eran
    // hasta ~3 round-trips en serie por visita, ahora todas concurrentes.
    const tieneAlgunTelefono = datos.visitasNuevas.some((v) => v.telefono?.trim());
    const tipoTelefonoId = tieneAlgunTelefono ? (await obtenerTiposTelefono())[0]?.id : undefined;

    const nuevasPersonas = await Promise.all(
      datos.visitasNuevas.map(async (visita) => {
        const { data: persona, error: errorPersona } = await supabase
          .from('persona')
          .insert({
            iglesia_id: datos.iglesia_id,
            primer_nombre: visita.primer_nombre,
            segundo_nombre: visita.segundo_nombre || null,
            primer_apellido: visita.primer_apellido,
            segundo_apellido: visita.segundo_apellido || null,
            sexo: visita.sexo,
            fecha_nacimiento: visita.fecha_nacimiento || null,
            // Visita de reporte: es un lead, no un miembro con membresía
            // completada. Sin este false toma el DEFAULT true y el trigger
            // fn_validar_campos_membresia_persona exige CI (rompía el reporte
            // con "el campo ci es obligatorio" en iglesias con CI obligatorio).
            membresia_completada: false,
          })
          .select('id')
          .single();
        if (errorPersona) throw errorPersona;

        if (visita.telefono?.trim() && tipoTelefonoId) {
          await agregarTelefono(datos.iglesia_id, persona.id, tipoTelefonoId, visita.telefono.trim(), null, true);
        }

        return { id: persona.id, esMenor: visita.es_menor, esVisita: true, clave: visita.clave };
      })
    );
    personaIds.push(...nuevasPersonas);

    if (personaIds.length > 0) {
      const { error: errorAsistencia } = await supabase.from('casa_de_paz_asistencia').insert(
        personaIds.map((p) => ({
          iglesia_id: datos.iglesia_id,
          reporte_id: reporteId,
          persona_id: p.id,
          es_menor: p.esMenor ?? null,
          es_visita: p.esVisita ?? false,
          // El líder ya decidió por persona si asiste como habitual o
          // visita (checkbox "Asiste a esta CDP" en Reportes.tsx) -- este
          // valor debe respetarse tal cual, no recalcularse en el trigger.
          confirmado_manualmente: true,
        }))
      );
      if (errorAsistencia) throw errorAsistencia;
    }

    // Ofrendas (agregado). p_total_diezmos: null -- los diezmos ahora se
    // registran por persona más abajo; pasar null da de baja cualquier DIEZMO
    // agregado viejo que hubiera quedado.
    const { error: errorIngresos } = await supabase.rpc('fn_registrar_ingresos_reporte', {
      p_reporte_id: reporteId,
      p_total_ofrendas: datos.totalOfrendas,
      p_total_diezmos: null,
      p_moneda_id: datos.monedaId,
    });
    if (errorIngresos) throw errorIngresos;

    const diezmosPayload = await construirDiezmosPayload(datos.iglesia_id, datos.diezmos);
    const { error: errorDiezmos } = await supabase.rpc('fn_registrar_diezmos_reporte', {
      p_reporte_id: reporteId,
      p_diezmos: diezmosPayload,
      p_moneda_id: datos.monedaId,
    });
    if (errorDiezmos) throw errorDiezmos;

    const { data: totales, error: errorTotales } = await supabase
      .from('v_reporte_totales')
      .select('total_menores, total_mayores, total_asistentes')
      .eq('reporte_id', reporteId)
      .single();
    if (errorTotales) throw errorTotales;

    // KAN-183: reclasificación automática Simpatizante/Creyente según
    // ausencias/asistencia en esta CdP -- best-effort, un fallo acá no debe
    // revertir un reporte que ya se guardó bien (por eso su propio try/catch,
    // sin relanzar hacia el catch de más abajo).
    try {
      const { error: errorRecalculo } = await supabase.rpc('fn_recalcular_estados_cdp_reporte', { p_reporte_id: reporteId });
      if (errorRecalculo) throw errorRecalculo;
    } catch (e) {
      console.error('No se pudo recalcular Simpatizante/Creyente', e);
    }

    return {
      reporteId,
      totalMenores: totales.total_menores,
      totalMayores: totales.total_mayores,
      totalAsistentes: totales.total_asistentes,
      visitasNuevasCreadas: nuevasPersonas.map((p) => ({ clave: p.clave, personaId: p.id })),
    };
  } catch (e) {
    // Reversión de mejor esfuerzo del reporte huérfano, vía RPC SECURITY
    // DEFINER (111_fix_moneda_iglesia_y_revertir_reporte.sql) en vez de un
    // UPDATE directo -- el UPDATE directo lo bloqueaba silenciosamente la RLS
    // para un Sublíder (pol_casa_de_paz_reporte_update exige
    // SUBLIDER_PUEDE_EDITAR_REPORTE, apagado por defecto), sin lanzar
    // excepción ni avisar. El RPC valida el mismo permiso que dejó crear el
    // reporte, acotado a que sea el propio creador revirtiendo su propio
    // reporte recién creado (ver comentario del RPC).
    try {
      const { error: errorRevertir } = await supabase.rpc('fn_revertir_reporte_cdp', { p_reporte_id: reporteId });
      if (errorRevertir) console.error('No se pudo revertir el reporte huérfano', errorRevertir);
    } catch (revertError) {
      // Ignorado a propósito: no debe tapar el error real de arriba.
      console.error('No se pudo revertir el reporte huérfano', revertError);
    }
    throw e;
  }
}

/**
 * KAN-271: mismo límite que fn_puede_editar_reporte_cdp (7 días desde la
 * fecha de reunión, inclusive) -- solo para decidir si se muestra el botón
 * "Editar" en la UI (evita un click que sabemos que va a rebotar). El
 * permiso real siempre lo valida el backend vía RLS, esto no lo reemplaza.
 */
export const DIAS_LIMITE_EDICION_REPORTE = 7;

export function dentroDeVentanaEdicionReporte(fechaReunionISO: string, hoyISO: string = aISO(new Date())): boolean {
  const limite = new Date(`${fechaReunionISO}T00:00:00`);
  limite.setDate(limite.getDate() + DIAS_LIMITE_EDICION_REPORTE);
  return hoyISO <= aISO(limite);
}

/** KAN-271: si el reporte todavía se puede editar (rol + ventana de 7 días) -- ver fn_puede_editar_reporte_cdp. */
export async function puedeEditarReporte(reporteId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_puede_editar_reporte_cdp', { p_reporte_id: reporteId });
  if (error) throw error;
  return !!data;
}

/**
 * KAN-271: trae un reporte ya enviado para precargar el formulario en modo
 * edición (Líder/Supervisor de Red, Líder/Sublíder de CdP, dentro de la
 * ventana de 7 días -- el gate real vive en RLS/fn_puede_editar_reporte_cdp,
 * acá solo se lee).
 */
export async function obtenerReportePorId(reporteId: string): Promise<ReporteExistente> {
  const [{ data: reporte, error: errorReporte }, { data: asistencia, error: errorAsistencia }, { data: ingresos, error: errorIngresos }] =
    await Promise.all([
      supabase
        .from('casa_de_paz_reporte')
        .select(
          'id, casa_de_paz_id, iglesia_id, fecha_reunion, libro_id, tema_id, tema_especial_txt, disertador_id, salio_evangelizar, evangelizados_declarados, testimonios, comentarios, disertador:disertador_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)'
        )
        .eq('id', reporteId)
        .single(),
      supabase.from('casa_de_paz_asistencia').select('persona_id, es_visita, es_menor').eq('reporte_id', reporteId).is('fecha_eliminacion', null),
      supabase
        .from('finanzas_ingreso')
        .select('monto, moneda_id, persona_id, tipo_ingreso:tipo_ingreso_id(codigo), persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)')
        .eq('reporte_id', reporteId)
        .is('fecha_eliminacion', null),
    ]);
  if (errorReporte) throw errorReporte;
  if (errorAsistencia) throw errorAsistencia;
  if (errorIngresos) throw errorIngresos;

  const disertador = Array.isArray(reporte.disertador) ? reporte.disertador[0] : reporte.disertador;
  const disertadorNombre = disertador
    ? [disertador.primer_nombre, disertador.segundo_nombre, disertador.primer_apellido, disertador.segundo_apellido].filter(Boolean).join(' ')
    : null;

  let totalOfrendas = 0;
  let monedaId: string | null = null;
  const diezmos: DiezmoLinea[] = [];
  for (const ing of ingresos ?? []) {
    const tipo = Array.isArray(ing.tipo_ingreso) ? ing.tipo_ingreso[0] : ing.tipo_ingreso;
    monedaId = ing.moneda_id;
    if (tipo?.codigo === 'OFRENDA') totalOfrendas = Number(ing.monto);
    if (tipo?.codigo === 'DIEZMO' && ing.persona_id) {
      const p = Array.isArray(ing.persona) ? ing.persona[0] : ing.persona;
      const nombre = [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ');
      diezmos.push({ clave: ing.persona_id, personaId: ing.persona_id, nombre_completo: nombre, monto: Number(ing.monto) });
    }
  }

  return {
    id: reporte.id,
    casa_de_paz_id: reporte.casa_de_paz_id,
    iglesia_id: reporte.iglesia_id,
    fecha_reunion: reporte.fecha_reunion,
    libro_id: reporte.libro_id,
    tema_id: reporte.tema_id,
    tema_especial_txt: reporte.tema_especial_txt,
    disertador_id: reporte.disertador_id,
    disertador_nombre: disertadorNombre,
    salio_evangelizar: reporte.salio_evangelizar,
    evangelizados_declarados: reporte.evangelizados_declarados,
    testimonios: reporte.testimonios,
    comentarios: reporte.comentarios,
    totalOfrendas,
    diezmos,
    monedaId,
    asistentes: (asistencia ?? []).map((a) => ({ personaId: a.persona_id, esVisita: a.es_visita, esMenor: a.es_menor ?? undefined })),
  };
}

/**
 * KAN-271: edita un reporte ya enviado -- mismo flujo de datos que
 * crearReporte (asistencia + ingresos), pero contra un reporte existente en
 * vez de crear uno nuevo. El permiso (rol + ventana de 7 días desde
 * fecha_reunion) lo valida RLS (fn_puede_editar_reporte_cdp); acá solo se
 * calcula el diff de asistencia contra lo que ya estaba guardado.
 */
export async function actualizarReporte(reporteId: string, datos: NuevoReporte): Promise<ResultadoReporte> {
  const { error: errorReporte } = await supabase
    .from('casa_de_paz_reporte')
    .update({
      libro_id: datos.libro_id || null,
      tema_id: datos.tema_id || null,
      tema_especial_txt: datos.tema_especial_txt || null,
      disertador_id: datos.disertador_id || null,
      salio_evangelizar: datos.salio_evangelizar,
      evangelizados_declarados: datos.evangelizados_declarados ?? null,
      testimonios: datos.testimonios || null,
      comentarios: datos.comentarios || null,
    })
    .eq('id', reporteId);
  if (errorReporte) throw errorReporte;

  const { data: existentes, error: errorExistentes } = await supabase
    .from('casa_de_paz_asistencia')
    .select('id, persona_id, es_visita, es_menor')
    .eq('reporte_id', reporteId)
    .is('fecha_eliminacion', null);
  if (errorExistentes) throw errorExistentes;

  const tieneAlgunTelefono = datos.visitasNuevas.some((v) => v.telefono?.trim());
  const tipoTelefonoId = tieneAlgunTelefono ? (await obtenerTiposTelefono())[0]?.id : undefined;

  const nuevasPersonas = await Promise.all(
    datos.visitasNuevas.map(async (visita) => {
      const { data: persona, error: errorPersona } = await supabase
        .from('persona')
        // membresia_completada: false -- lead de visita, no miembro completo
        // (mismo motivo que arriba: DEFAULT true + trigger CI obligatorio).
        .insert({
          iglesia_id: datos.iglesia_id,
          primer_nombre: visita.primer_nombre,
          segundo_nombre: visita.segundo_nombre || null,
          primer_apellido: visita.primer_apellido,
          segundo_apellido: visita.segundo_apellido || null,
          sexo: visita.sexo,
          fecha_nacimiento: visita.fecha_nacimiento || null,
          membresia_completada: false,
        })
        .select('id')
        .single();
      if (errorPersona) throw errorPersona;

      if (visita.telefono?.trim() && tipoTelefonoId) {
        await agregarTelefono(datos.iglesia_id, persona.id, tipoTelefonoId, visita.telefono.trim(), null, true);
      }

      return { id: persona.id, esMenor: visita.es_menor, esVisita: true, clave: visita.clave };
    })
  );

  // Un único mapa "cómo debería quedar la asistencia" -- se compara contra lo
  // que ya estaba guardado (existentesPorPersona) para decidir altas, bajas
  // y cambios, en vez de borrar todo y reinsertar (evita perder el historial
  // de auditoría de filas que no cambiaron).
  const deseados = new Map<string, { esMenor?: boolean; esVisita: boolean }>();
  for (const a of datos.asistentesExistentes) deseados.set(a.personaId, { esMenor: a.esMenor, esVisita: a.esVisita ?? false });
  for (const p of nuevasPersonas) deseados.set(p.id, { esMenor: p.esMenor, esVisita: true });

  const existentesPorPersona = new Map((existentes ?? []).map((e) => [e.persona_id, e]));

  const aQuitar = (existentes ?? []).filter((e) => !deseados.has(e.persona_id));
  const aAgregar = Array.from(deseados.entries()).filter(([personaId]) => !existentesPorPersona.has(personaId));
  const aActualizar = Array.from(deseados.entries()).filter(([personaId, v]) => {
    const actual = existentesPorPersona.get(personaId);
    return actual && (actual.es_visita !== v.esVisita || (actual.es_menor ?? undefined) !== v.esMenor);
  });

  if (aQuitar.length > 0) {
    const { error } = await supabase
      .from('casa_de_paz_asistencia')
      .update({ fecha_eliminacion: new Date().toISOString() })
      .in('id', aQuitar.map((e) => e.id));
    if (error) throw error;
  }

  if (aAgregar.length > 0) {
    const { error } = await supabase.from('casa_de_paz_asistencia').insert(
      aAgregar.map(([personaId, v]) => ({
        iglesia_id: datos.iglesia_id,
        reporte_id: reporteId,
        persona_id: personaId,
        es_menor: v.esMenor ?? null,
        es_visita: v.esVisita,
        confirmado_manualmente: true,
      }))
    );
    if (error) throw error;
  }

  for (const [personaId, v] of aActualizar) {
    const fila = existentesPorPersona.get(personaId);
    if (!fila) continue;
    const { error } = await supabase
      .from('casa_de_paz_asistencia')
      .update({ es_visita: v.esVisita, es_menor: v.esMenor ?? null, confirmado_manualmente: true })
      .eq('id', fila.id);
    if (error) throw error;
  }

  const { error: errorIngresos } = await supabase.rpc('fn_registrar_ingresos_reporte', {
    p_reporte_id: reporteId,
    p_total_ofrendas: datos.totalOfrendas,
    p_total_diezmos: null,
    p_moneda_id: datos.monedaId,
  });
  if (errorIngresos) throw errorIngresos;

  const diezmosPayload = await construirDiezmosPayload(datos.iglesia_id, datos.diezmos);
  const { error: errorDiezmos } = await supabase.rpc('fn_registrar_diezmos_reporte', {
    p_reporte_id: reporteId,
    p_diezmos: diezmosPayload,
    p_moneda_id: datos.monedaId,
  });
  if (errorDiezmos) throw errorDiezmos;

  const { data: totales, error: errorTotales } = await supabase
    .from('v_reporte_totales')
    .select('total_menores, total_mayores, total_asistentes')
    .eq('reporte_id', reporteId)
    .single();
  if (errorTotales) throw errorTotales;

  try {
    const { error: errorRecalculo } = await supabase.rpc('fn_recalcular_estados_cdp_reporte', { p_reporte_id: reporteId });
    if (errorRecalculo) throw errorRecalculo;
  } catch (e) {
    console.error('No se pudo recalcular Simpatizante/Creyente', e);
  }

  return {
    reporteId,
    totalMenores: totales.total_menores,
    totalMayores: totales.total_mayores,
    totalAsistentes: totales.total_asistentes,
    visitasNuevasCreadas: nuevasPersonas.map((p) => ({ clave: p.clave, personaId: p.id })),
  };
}
