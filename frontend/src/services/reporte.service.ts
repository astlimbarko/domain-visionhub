import { supabase } from './supabase';
import { agregarTelefono, obtenerTiposTelefono } from './persona.service';
import { calcularEdad } from '@/utils/edad';
import { fechasReunionDelMes } from '@/utils/calendario-fechas';
import type {
  BorradorReporte,
  BorradorReportePayload,
  CamposObligatoriosReporte,
  CategoriaTestimonio,
  DiezmoLinea,
  EstadoAsistenciaReunion,
  HistorialAsistencia,
  Libro,
  MegafiestaDesgloseFila,
  MegafiestaDetalle,
  MegafiestaRedResumen,
  MiembroCdp,
  NuevoReporte,
  NuevoReporteMegafiesta,
  ReporteExistente,
  ReporteRedFila,
  ReporteReciente,
  ResultadoReporte,
  ResultadoReporteMegafiesta,
  Tema,
  TemaConLibro,
  TestimonioCdp,
  TestimonioLinea,
} from '@/types/reporte.types';

/** tipo_evento.codigo = 'MEGA_FIESTA' -- id fijo en la base (seed), confirmado por consulta directa. */
const TIPO_EVENTO_MEGAFIESTA_ID = '58640324-aa09-4fb2-b581-ddf634c57c12';

/**
 * KAN-435: si el líder marcó "¿Aceptó a Cristo?" al dar de alta una
 * persona nueva, se busca el id de NC una sola vez (no por persona, mismo
 * criterio que ya usa `obtenerTiposTelefono` acá arriba) -- undefined si
 * ninguna de las visitas de este reporte lo tildó.
 */
async function obtenerEstadoNcIdSiHaceFalta(visitasNuevas: { acepto_a_cristo?: boolean }[]): Promise<string | undefined> {
  if (!visitasNuevas.some((v) => v.acepto_a_cristo)) return undefined;
  const { data, error } = await supabase.from('estado').select('id').eq('sigla', 'NC').is('fecha_eliminacion', null).single();
  if (error) throw error;
  return data.id;
}

/**
 * NC puesto a mano en el momento del alta -- una decisión humana, no debe
 * depender del conteo automático de visitas (mismo criterio que RE, ver
 * migración 20260923050000). Sin esto, la persona entra como siempre
 * (SIM) y el motor decide después si llega a NC por conteo.
 */
async function marcarNuevoConvertidoSiCorresponde(iglesiaId: string, personaId: string, estadoNcId: string | undefined, aceptoACristo: boolean | undefined) {
  if (!estadoNcId || !aceptoACristo) return;
  const { error } = await supabase.from('persona_estado').insert({
    iglesia_id: iglesiaId,
    persona_id: personaId,
    estado_id: estadoNcId,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    es_automatico: false,
    motivo: 'Aceptó a Cristo al ser registrado/a en el reporte',
  });
  if (error) throw error;
}

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

/**
 * KAN-367 (2026-09-17): todos los temas de los 13 libros a la vez, con el
 * libro incluido -- para el buscador de temas (quien carga el reporte suele
 * saber el nombre del tema, no en qué libro está). Dataset chico (~13 libros
 * x ~52 temas), se trae todo de una vez y se filtra en el cliente.
 */
export async function obtenerTodosLosTemas(iglesiaId: string): Promise<TemaConLibro[]> {
  const { data, error } = await supabase
    .from('cdp_tema')
    .select('id, libro_id, numero, nombre, es_especial, libro:libro_id(numero, nombre)')
    .eq('activo', true)
    .or(`iglesia_id.is.null,iglesia_id.eq.${iglesiaId}`)
    .order('numero');
  if (error) throw error;
  return (data ?? []).map((t) => {
    const libro = Array.isArray(t.libro) ? t.libro[0] : t.libro;
    return {
      id: t.id,
      libro_id: t.libro_id,
      numero: t.numero,
      nombre: t.nombre,
      es_especial: t.es_especial,
      libro_numero: libro?.numero ?? 0,
      libro_nombre: libro?.nombre ?? '',
    };
  });
}

export async function obtenerMiembrosCdp(casaDePazId: string): Promise<MiembroCdp[]> {
  const [{ data, error }, { data: visitas, error: errorVisitas }] = await Promise.all([
    supabase
      .from('casa_de_paz_membresia')
      .select('persona_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento)')
      .eq('casa_de_paz_id', casaDePazId)
      .is('fecha_fin', null),
    // KAN-399 (2026-09-17): antes usaba fn_visitas_regulares_cdp, que exige
    // estado >= Nuevo Convertido -- una visita que se quedó en Simpatizante
    // quedaba afuera del pool local del buscador de asistencia, aunque
    // "Personas de mi Casa de Paz" (fn_personas_de_cdp) sí la reconoce como
    // de esta CdP. fn_visitas_cdp usa el mismo criterio de "asistencia sin
    // membresía en esta CdP" que fn_personas_de_cdp, sin filtrar por estado.
    supabase.rpc('fn_visitas_cdp', { p_casa_de_paz_id: casaDePazId }),
  ]);
  if (error) throw error;
  if (errorVisitas) throw errorVisitas;

  // OJO: esta lista se usa tanto para "a quién marcarle asistencia" (Reportes.tsx,
  // donde el Líder se filtra puntualmente al llamarla) como para "a quién puedo
  // mover a la CdP nueva" al multiplicar una CdP (MultiplicarCdpDialog.tsx, donde
  // el Líder SÍ debe poder elegirse) -- no filtrar al Líder acá, es compartida.
  const miembros = (data ?? []).map((r) => {
    const p = Array.isArray(r.persona) ? r.persona[0] : r.persona;
    const nombre = [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ');
    return {
      persona_id: r.persona_id,
      nombre_completo: nombre,
      tiene_fecha_nacimiento: !!p?.fecha_nacimiento,
      edad: p?.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null,
    };
  });

  return [...miembros, ...((visitas ?? []) as MiembroCdp[])];
}

/** Persona(s) con cargo LIDER_CDP vigente en esta Casa de Paz -- el Líder no
 * es "alguien a quien seguirle la asistencia" (pedido del owner, 2026-09-10):
 * desde el fix de membresía del 2026-09-09 (fn_asegurar_membresia_cdp_por_cargo)
 * el Líder SÍ tiene fila en casa_de_paz_membresia (a propósito, para que
 * cuente en Personas/censo/ministerios de los Dashboards), pero no debe
 * figurar en la lista de asistencia semanal (Reportes.tsx) ni en el
 * Historial de Asistencia. Sublíder NO se excluye (sí es alguien a quien
 * tiene sentido marcarle presente/ausente). Normalmente hay una sola
 * persona, se resuelve como Set por si hay más de una fila real. */
export async function obtenerIdsLiderCdp(casaDePazId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('casa_de_paz_cargo')
    .select('persona_id, cargo:cargo_id!inner(codigo)')
    .eq('casa_de_paz_id', casaDePazId)
    .eq('cargo.codigo', 'LIDER_CDP')
    .is('fecha_fin', null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.persona_id));
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

/**
 * KAN-409: reporte reducido de Megafiesta -- solo fecha + asistencia, sin
 * tema/libro/disertador/evangelismo/finanzas/testimonio (esos se completan
 * a nivel del consolidado, no por cada CdP -- ver actualizarDetalleMegafiesta).
 * Busca o crea automáticamente el consolidado (evento tipo MEGA_FIESTA) de
 * la Red+fecha vía RPC SECURITY DEFINER: el Líder de CdP normalmente no
 * puede crear eventos de Red (RLS pol_evento_insert exige
 * fn_es_lider_de_red), pero acá sí puede reportar una Megafiesta sin que el
 * Líder de Red la haya programado antes (requisito explícito de KAN-409).
 * El trigger fn_validar_reporte_megafiesta (ya existía) sigue validando
 * server-side que el evento sea MEGA_FIESTA, de la misma fecha y de la
 * misma Red que esta CdP -- no se duplica esa validación acá.
 */
export async function crearReporteMegafiesta(datos: NuevoReporteMegafiesta): Promise<ResultadoReporteMegafiesta> {
  const { data: eventoMegafiestaId, error: errorEvento } = await supabase.rpc('fn_megafiesta_obtener_o_crear', {
    p_casa_de_paz_id: datos.casa_de_paz_id,
    p_fecha: datos.fecha_reunion,
  });
  if (errorEvento) throw errorEvento;

  const { data: reporte, error: errorReporte } = await supabase
    .from('casa_de_paz_reporte')
    .insert({
      iglesia_id: datos.iglesia_id,
      casa_de_paz_id: datos.casa_de_paz_id,
      fecha_reunion: datos.fecha_reunion,
      evento_megafiesta_id: eventoMegafiestaId,
      salio_evangelizar: false,
    })
    .select('id')
    .single();
  if (errorReporte) throw errorReporte;
  const reporteId = reporte.id;

  // Mismo patrón de reversión de mejor esfuerzo que crearReporte -- si la
  // asistencia falla a mitad de camino, no debe quedar un reporte huérfano
  // visible en Historial/Dashboard.
  try {
    const personaIds: { id: string; esMenor?: boolean; esVisita?: boolean }[] = datos.asistentesExistentes.map((a) => ({
      id: a.personaId,
      esMenor: a.esMenor,
      esVisita: a.esVisita,
    }));

    const tieneAlgunTelefono = datos.visitasNuevas.some((v) => v.telefono?.trim());
    const tipoTelefonoId = tieneAlgunTelefono ? (await obtenerTiposTelefono())[0]?.id : undefined;
    const estadoNcId = await obtenerEstadoNcIdSiHaceFalta(datos.visitasNuevas);

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
            membresia_completada: false,
          })
          .select('id')
          .single();
        if (errorPersona) throw errorPersona;

        if (visita.telefono?.trim() && tipoTelefonoId) {
          await agregarTelefono(datos.iglesia_id, persona.id, tipoTelefonoId, visita.telefono.trim(), null, true);
        }
        await marcarNuevoConvertidoSiCorresponde(datos.iglesia_id, persona.id, estadoNcId, visita.acepto_a_cristo);

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
          confirmado_manualmente: true,
        }))
      );
      if (errorAsistencia) throw errorAsistencia;
    }

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
      eventoMegafiestaId,
    };
  } catch (e) {
    try {
      const { error: errorRevertir } = await supabase.rpc('fn_revertir_reporte_cdp', { p_reporte_id: reporteId });
      if (errorRevertir) console.error('No se pudo revertir el reporte huérfano', errorRevertir);
    } catch (revertError) {
      console.error('No se pudo revertir el reporte huérfano', revertError);
    }
    throw e;
  }
}

/**
 * KAN-409: consolidados de Megafiesta (evento tipo MEGA_FIESTA) de una Red,
 * con el total de asistentes ya sumado -- vista "Megafiestas de Casa de
 * Paz" del Líder de Red. RLS ya limita a lo que el usuario puede ver
 * (pol_evento_select vía fn_puede_ver_red).
 */
export async function obtenerMegafiestasRed(redId: string): Promise<MegafiestaRedResumen[]> {
  const { data: eventos, error: errorEventos } = await supabase
    .from('evento')
    .select('id, titulo, fecha_inicio')
    .eq('red_id', redId)
    .eq('tipo_evento_id', TIPO_EVENTO_MEGAFIESTA_ID)
    .is('fecha_eliminacion', null)
    .order('fecha_inicio', { ascending: false });
  if (errorEventos) throw errorEventos;
  if (!eventos || eventos.length === 0) return [];

  const eventoIds = eventos.map((e) => e.id);
  const { data: reportes, error: errorReportes } = await supabase
    .from('casa_de_paz_reporte')
    .select('id, evento_megafiesta_id')
    .in('evento_megafiesta_id', eventoIds)
    .is('fecha_eliminacion', null);
  if (errorReportes) throw errorReportes;

  const reporteIds = (reportes ?? []).map((r) => r.id);
  const totalesPorReporte = new Map<string, number>();
  if (reporteIds.length > 0) {
    const { data: totales, error: errorTotales } = await supabase
      .from('v_reporte_totales')
      .select('reporte_id, total_asistentes')
      .in('reporte_id', reporteIds);
    if (errorTotales) throw errorTotales;
    for (const t of totales ?? []) totalesPorReporte.set(t.reporte_id, t.total_asistentes);
  }

  const reportesPorEvento = new Map<string, string[]>();
  for (const r of reportes ?? []) {
    if (!r.evento_megafiesta_id) continue;
    const lista = reportesPorEvento.get(r.evento_megafiesta_id) ?? [];
    lista.push(r.id);
    reportesPorEvento.set(r.evento_megafiesta_id, lista);
  }

  return eventos.map((e) => {
    const reportesDeEsteEvento = reportesPorEvento.get(e.id) ?? [];
    const totalAsistentes = reportesDeEsteEvento.reduce((suma, id) => suma + (totalesPorReporte.get(id) ?? 0), 0);
    return {
      evento_id: e.id,
      fecha: e.fecha_inicio,
      titulo: e.titulo,
      totalAsistentes,
      cantidadCdpReportaron: reportesDeEsteEvento.length,
    };
  });
}

/**
 * KAN-409: desglose por CdP de un consolidado puntual -- "CdP Daniel — 14
 * personas". RLS ya limita las filas de casa_de_paz_reporte a lo que el
 * usuario puede ver (fn_puede_ver_cdp), igual que en Control de Reportes.
 * No trae el nombre de la CdP acá (ver comentario en MegafiestaDesgloseFila) --
 * el componente lo cruza con useCdps.
 */
export async function obtenerDesgloseMegafiesta(eventoId: string): Promise<MegafiestaDesgloseFila[]> {
  const { data: reportes, error: errorReportes } = await supabase
    .from('casa_de_paz_reporte')
    .select('id, casa_de_paz_id')
    .eq('evento_megafiesta_id', eventoId)
    .is('fecha_eliminacion', null);
  if (errorReportes) throw errorReportes;
  if (!reportes || reportes.length === 0) return [];

  const reporteIds = reportes.map((r) => r.id);
  const { data: totales, error: errorTotales } = await supabase
    .from('v_reporte_totales')
    .select('reporte_id, total_asistentes')
    .in('reporte_id', reporteIds);
  if (errorTotales) throw errorTotales;
  const totalPorReporte = new Map((totales ?? []).map((t) => [t.reporte_id, t.total_asistentes]));

  return reportes
    .map((r) => ({
      reporte_id: r.id,
      casa_de_paz_id: r.casa_de_paz_id,
      total_asistentes: totalPorReporte.get(r.id) ?? 0,
    }))
    .sort((a, b) => b.total_asistentes - a.total_asistentes);
}

/** KAN-409: datos generales ya guardados de un consolidado (Tema/Finanzas/Testimonio). */
export async function obtenerDetalleMegafiesta(eventoId: string): Promise<MegafiestaDetalle | null> {
  const { data, error } = await supabase
    .from('evento_megafiesta_detalle')
    .select('evento_id, libro_id, tema_id, tema_especial_txt, total_ofrendas, moneda_id, testimonios')
    .eq('evento_id', eventoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * KAN-409: el Líder de Red completa/actualiza Tema, Finanzas y Testimonio
 * desde el consolidado (punto 5 del ticket) -- upsert porque la primera vez
 * no existe la fila. RLS exige fn_es_lider_de_red sobre la Red del evento.
 */
export async function actualizarDetalleMegafiesta(
  eventoId: string,
  datos: {
    libro_id?: string | null;
    tema_id?: string | null;
    tema_especial_txt?: string | null;
    total_ofrendas?: number | null;
    moneda_id?: string | null;
    testimonios?: string | null;
  }
): Promise<void> {
  // fecha_actualizacion/actualizado_por los pone el trigger
  // trg_auditoria_evento_megafiesta_detalle, no el cliente.
  const { error } = await supabase.from('evento_megafiesta_detalle').upsert({ evento_id: eventoId, ...datos });
  if (error) throw error;
}

/**
 * KAN-367: ordenado por fecha_creacion (últimos ENVÍOS, como ya dice el
 * título de la sección), no por fecha_reunion -- un reporte atrasado
 * (backfill, fecha_reunion vieja) recién creado tiene que aparecer acá
 * arriba de todo para poder corregirlo mientras está en ventana, si no,
 * quedaba invisible detrás de reportes con fecha_reunion más reciente pero
 * cargados hace más tiempo (justo el caso que este ticket resuelve).
 */
export async function obtenerReportesRecientes(casaDePazIds: string[]): Promise<ReporteReciente[]> {
  if (casaDePazIds.length === 0) return [];
  const { data, error } = await supabase
    .from('v_reporte_totales')
    .select('reporte_id, casa_de_paz_id, fecha_reunion, fecha_creacion, total_asistentes, total_menores, total_mayores')
    .in('casa_de_paz_id', casaDePazIds)
    .order('fecha_creacion', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.reporte_id,
    casa_de_paz_id: r.casa_de_paz_id,
    fecha_reunion: r.fecha_reunion,
    fecha_creacion: r.fecha_creacion,
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
 * error. Mismo permiso y misma ventana configurable que la edición (KAN-367
 * -- `fn_anular_reporte_cdp` reusa `fn_puede_editar_reporte_cdp` tal cual),
 * validado server-side. Da de baja también su asistencia e ingresos (estos
 * vía trigger de cascada).
 */
export async function anularReporte(reporteId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_anular_reporte_cdp', { p_reporte_id: reporteId });
  if (error) throw error;
}

export interface HistorialReporteEntrada {
  id: string;
  tipo: 'MODIFICADO' | 'ANULADO';
  snapshotAnterior: Record<string, unknown>;
  modificadoPorNombre: string;
  fechaCreacion: string;
}

/**
 * KAN-367 (2026-09-17): historial de cambios de un reporte -- solo Pastor/
 * Supervisor de la Visión en Acción (fn_historial_reporte_cdp lo exige server-side,
 * la tabla en sí no tiene GRANT directo a authenticated).
 */
export async function obtenerHistorialReporte(reporteId: string): Promise<HistorialReporteEntrada[]> {
  const { data, error } = await supabase.rpc('fn_historial_reporte_cdp', { p_reporte_id: reporteId });
  if (error) throw error;
  return (data ?? []).map((r: { id: string; tipo: string; snapshot_anterior: Record<string, unknown>; modificado_por_nombre: string; fecha_creacion: string }) => ({
    id: r.id,
    tipo: r.tipo as 'MODIFICADO' | 'ANULADO',
    snapshotAnterior: r.snapshot_anterior,
    modificadoPorNombre: r.modificado_por_nombre,
    fechaCreacion: r.fecha_creacion,
  }));
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

export interface ReporteCalendarioFila {
  reporte_id: string;
  fecha_reunion: string;
  fecha_creacion: string;
  /** Asistentes mayores de la edad mínima de creyente (ver EDAD_MINIMA_CREYENTE) -- "adultos" para el resumen del calendario. */
  total_mayores: number;
  total_menores: number;
  total_ofrendas: number;
  total_diezmos: number;
  /** KAN-409: true si este reporte se cargó como Megafiesta (evento_megafiesta_id IS NOT NULL) -- indicador morado propio en el calendario. */
  es_megafiesta: boolean;
}

/**
 * KAN-367: mismo rango que obtenerFechasReportadas, pero con lo que hace
 * falta para que el calendario (círculos verdes) sea clickeable directo a
 * editar y muestre un resumen al pasar el mouse -- reporte_id, fecha_creacion,
 * adultos/niños y ofrendas/diezmos. Se mantiene obtenerFechasReportadas sin
 * tocar (otros 2 consumidores -- DashboardLiderCdp, el propio
 * HistorialReportes -- solo necesitan las fechas).
 *
 * 2 consultas en paralelo (no N+1 por círculo, todo el año de una vez):
 * v_reporte_totales ya trae total_mayores/total_menores por reporte_id sin
 * join extra; finanzas_ingreso ya tiene índice por reporte_id
 * (idx_ingreso_reporte, 14_finanzas.sql) así que el filtro `IN (...)` no
 * hace table scan.
 */
export async function obtenerReportesParaCalendario(
  casaDePazId: string,
  desde: string,
  hasta: string
): Promise<ReporteCalendarioFila[]> {
  const { data: totales, error: errorTotales } = await supabase
    .from('v_reporte_totales')
    .select('reporte_id, fecha_reunion, fecha_creacion, total_mayores, total_menores')
    .eq('casa_de_paz_id', casaDePazId)
    .gte('fecha_reunion', desde)
    .lte('fecha_reunion', hasta);
  if (errorTotales) throw errorTotales;
  if (!totales || totales.length === 0) return [];

  const reporteIds = totales.map((r) => r.reporte_id);
  // KAN-409: evento_megafiesta_id no está en v_reporte_totales -- consulta
  // aparte, en paralelo con finanzas_ingreso (ambas dependen solo de
  // reporteIds, independientes entre sí).
  const [{ data: ingresos, error: errorIngresos }, { data: megafiestas, error: errorMegafiestas }] = await Promise.all([
    supabase
      .from('finanzas_ingreso')
      .select('reporte_id, monto, tipo_ingreso:tipo_ingreso_id(codigo)')
      .in('reporte_id', reporteIds)
      .is('fecha_eliminacion', null),
    supabase.from('casa_de_paz_reporte').select('id, evento_megafiesta_id').in('id', reporteIds),
  ]);
  if (errorIngresos) throw errorIngresos;
  if (errorMegafiestas) throw errorMegafiestas;

  const ofrendaPorReporte = new Map<string, number>();
  const diezmoPorReporte = new Map<string, number>();
  for (const ing of ingresos ?? []) {
    if (!ing.reporte_id) continue;
    const tipo = Array.isArray(ing.tipo_ingreso) ? ing.tipo_ingreso[0] : ing.tipo_ingreso;
    const mapa = tipo?.codigo === 'OFRENDA' ? ofrendaPorReporte : tipo?.codigo === 'DIEZMO' ? diezmoPorReporte : null;
    if (mapa) mapa.set(ing.reporte_id, (mapa.get(ing.reporte_id) ?? 0) + Number(ing.monto));
  }
  const esMegafiestaPorReporte = new Set((megafiestas ?? []).filter((m) => m.evento_megafiesta_id).map((m) => m.id));

  return totales.map((r) => ({
    reporte_id: r.reporte_id,
    fecha_reunion: r.fecha_reunion,
    fecha_creacion: r.fecha_creacion,
    total_mayores: r.total_mayores,
    total_menores: r.total_menores,
    total_ofrendas: ofrendaPorReporte.get(r.reporte_id) ?? 0,
    total_diezmos: diezmoPorReporte.get(r.reporte_id) ?? 0,
    es_megafiesta: esMegafiestaPorReporte.has(r.reporte_id),
  }));
}

/**
 * KAN-367: primera fecha de reunión con reporte, en toda la historia de la
 * CdP (no solo el año en pantalla) -- usa idx_reporte_cdp_fecha, consulta
 * liviana (MIN con índice). Antes de esa fecha ninguna semana "faltó" un
 * reporte: la CdP todavía no existía/no se reunía, así que el calendario la
 * pinta gris en vez de roja.
 */
export async function obtenerPrimeraFechaReunion(casaDePazId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('casa_de_paz_reporte')
    .select('fecha_reunion')
    .eq('casa_de_paz_id', casaDePazId)
    .is('fecha_eliminacion', null)
    .order('fecha_reunion', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.fecha_reunion ?? null;
}

/**
 * Testimonios ya guardados en los reportes semanales de una CdP (campo libre
 * `casa_de_paz_reporte.testimonios`), agrupados por reunión -- card
 * "Testimonio" del dashboard del Líder de CdP (2026-09-08).
 */
export async function obtenerTestimoniosCdp(casaDePazId: string, desde?: string, hasta?: string): Promise<TestimonioCdp[]> {
  const { data, error } = await supabase.rpc('fn_testimonios_cdp', {
    p_casa_de_paz_id: casaDePazId,
    p_desde: desde ?? null,
    p_hasta: hasta ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: { reporte_id: string; fecha_reunion: string; testimonios: string }) => ({
    reporte_id: r.reporte_id,
    fecha_reunion: r.fecha_reunion,
    testimonios: r.testimonios,
  }));
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

/**
 * Historial de asistencia por miembro para un mes calendario puntual --
 * pedido del owner (2026-09-07): las columnas ya no son "las últimas N
 * reuniones cargadas" sino TODAS las fechas en las que a la CdP le tocaba
 * reunirse ese mes según su `dia_reunion` (Perfil de CdP), incluyendo las
 * que nunca se llegaron a reportar (`reporte_id: null` -- estado
 * 'SIN_REPORTE', distinto de 'FALTO': ahí ni siquiera hay reporte cargado).
 * El telefono sale de `telefono_asignacion` (RLS ya filtra datos
 * confidenciales por cargo ministerial, ver 28_invitaciones_y_privacidad.sql),
 * no hace falta replicar ese filtro aca.
 */
export async function obtenerHistorialAsistencia(
  casaDePazId: string,
  anio: number,
  mes: number,
  diaReunion: number | null
): Promise<HistorialAsistencia> {
  const fechasEsperadas = fechasReunionDelMes(anio, mes, diaReunion);
  if (fechasEsperadas.length === 0) return { reuniones: [], miembros: [] };

  // reportes, miembros y visitas son independientes entre si -- se piden en
  // paralelo en vez de uno tras otro.
  const [
    { data: reportes, error: errorReportes },
    { data: miembrosCrudo, error: errorMiembros },
    { data: visitas, error: errorVisitas },
    idsLider,
  ] = await Promise.all([
    supabase
      .from('casa_de_paz_reporte')
      .select('id, fecha_reunion')
      .eq('casa_de_paz_id', casaDePazId)
      .in('fecha_reunion', fechasEsperadas),
    supabase
      .from('casa_de_paz_membresia')
      .select(
        'persona_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento)'
      )
      .eq('casa_de_paz_id', casaDePazId)
      .is('fecha_fin', null),
    // Asistentes Nuevos que ya llegaron a Nuevo Convertido/Creyente por
    // asistencia (fn_recalcular_estados_cdp_reporte, 2026-09-06): cuentan
    // para el Historial igual que "Asistencia Regular", sin membresía formal.
    supabase.rpc('fn_visitas_regulares_cdp', { p_casa_de_paz_id: casaDePazId }),
    obtenerIdsLiderCdp(casaDePazId),
  ]);
  if (errorReportes) throw errorReportes;
  if (errorMiembros) throw errorMiembros;
  if (errorVisitas) throw errorVisitas;

  // El Líder de la CdP no es "alguien a quien seguirle la asistencia" -- ver
  // nota en obtenerMiembrosCdp (mismo pedido del owner, 2026-09-10).
  const miembros = (miembrosCrudo ?? []).filter((m) => !idsLider.has(m.persona_id));

  const reporteIdPorFecha = new Map<string, string>();
  for (const r of reportes ?? []) reporteIdPorFecha.set(r.fecha_reunion, r.id);
  const reuniones = fechasEsperadas.map((fecha) => ({ fecha_reunion: fecha, reporte_id: reporteIdPorFecha.get(fecha) ?? null }));
  const reporteIds = (reportes ?? []).map((r) => r.id);
  const personaIds = [
    ...miembros.map((m) => m.persona_id),
    ...((visitas ?? []) as { persona_id: string }[]).map((v) => v.persona_id),
  ];

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

  function estadosDePersona(personaId: string): EstadoAsistenciaReunion[] {
    return reuniones.map((r) => {
      if (!r.reporte_id) return 'SIN_REPORTE';
      return asistioSet.has(`${r.reporte_id}:${personaId}`) ? 'ASISTIO' : 'FALTO';
    });
  }

  const miembrosFormales = miembros.map((m) => {
    const p = Array.isArray(m.persona) ? m.persona[0] : m.persona;
    const nombre = [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ');
    return {
      persona_id: m.persona_id,
      nombre_completo: nombre,
      sexo: (p?.sexo ?? 'M') as 'M' | 'F',
      edad: p?.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null,
      telefono: telefonoPorPersona.get(m.persona_id) ?? null,
      estados: estadosDePersona(m.persona_id),
    };
  });

  const visitasRegulares = (
    (visitas ?? []) as { persona_id: string; nombre_completo: string; sexo: 'M' | 'F'; edad: number | null }[]
  ).map((v) => ({
    persona_id: v.persona_id,
    nombre_completo: v.nombre_completo,
    sexo: v.sexo,
    edad: v.edad,
    telefono: telefonoPorPersona.get(v.persona_id) ?? null,
    estados: estadosDePersona(v.persona_id),
  }));

  return {
    reuniones,
    miembros: [...miembrosFormales, ...visitasRegulares],
  };
}

/** KAN-392 (2026-09-17, pedido del owner): insert mínimo, aparte del flujo
 * normal de crearReporte -- sin asistencia/finanzas/evangelismo, ninguna de
 * esas validaciones aplica porque no se llaman esas RPCs. `motivo` es
 * obligatorio también del lado de la base (chk_reporte_motivo_no_realizada),
 * no solo en el formulario. */
export async function crearReunionNoRealizada(datos: {
  iglesia_id: string;
  casa_de_paz_id: string;
  fecha_reunion: string;
  motivo: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('casa_de_paz_reporte')
    .insert({
      iglesia_id: datos.iglesia_id,
      casa_de_paz_id: datos.casa_de_paz_id,
      fecha_reunion: datos.fecha_reunion,
      reunion_no_realizada: true,
      motivo_no_realizada: datos.motivo,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/** KAN-393: semanas marcadas "reunión no realizada" en el rango -- quedan
 * afuera de v_reporte_totales a propósito (no cuentan como presentado), así
 * que el calendario las resuelve con un query aparte. */
export async function obtenerReunionesNoRealizadas(
  casaDePazId: string,
  desde: string,
  hasta: string
): Promise<{ fecha_reunion: string; motivo: string | null }[]> {
  const { data, error } = await supabase
    .from('casa_de_paz_reporte')
    .select('fecha_reunion, motivo_no_realizada')
    .eq('casa_de_paz_id', casaDePazId)
    .eq('reunion_no_realizada', true)
    .is('fecha_eliminacion', null)
    .gte('fecha_reunion', desde)
    .lte('fecha_reunion', hasta);
  if (error) throw error;
  return (data ?? []).map((r) => ({ fecha_reunion: r.fecha_reunion, motivo: r.motivo_no_realizada }));
}

/**
 * KAN-423: reemplaza por completo los testimonios personales de un reporte
 * -- da de baja (soft-delete) los que ya estaban y crea de nuevo la lista
 * actual. Más simple que diffear altas/bajas/cambios (lista chica, sin
 * historial de auditoría fila por fila que preservar) y sigue el mismo
 * patrón append-only del resto del proyecto (fecha_eliminacion, no DELETE).
 * Ignora líneas sin categoría o sin texto -- el formulario ya filtra esto
 * antes de enviar, pero queda protegido igual ante datos a medio completar.
 */
async function reemplazarTestimoniosCategorizados(reporteId: string, testimonios: TestimonioLinea[]) {
  const { error: errorBaja } = await supabase
    .from('casa_de_paz_reporte_testimonio')
    .update({ fecha_eliminacion: new Date().toISOString() })
    .eq('reporte_id', reporteId)
    .is('fecha_eliminacion', null);
  if (errorBaja) throw errorBaja;

  const validos = testimonios.filter((t) => t.categoria && t.texto.trim());
  if (validos.length === 0) return;

  const { error: errorAlta } = await supabase.from('casa_de_paz_reporte_testimonio').insert(
    validos.map((t) => ({
      reporte_id: reporteId,
      categoria: t.categoria,
      texto: t.texto.trim(),
      persona_id: t.personaId ?? null,
      nombre_persona: t.nombrePersona.trim() || null,
    }))
  );
  if (errorAlta) throw errorAlta;
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
    const estadoNcId = await obtenerEstadoNcIdSiHaceFalta(datos.visitasNuevas);

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
            // KAN-406: edad aproximada cuando no se conoce fecha_nacimiento
            // -- dato no confirmado, se guarda tal cual (nunca se deriva una
            // fecha ficticia a partir de esto).
            edad_aproximada: visita.edad_aproximada ?? null,
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
        await marcarNuevoConvertidoSiCorresponde(datos.iglesia_id, persona.id, estadoNcId, visita.acepto_a_cristo);

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

    // KAN-423: testimonios personales por categoría, aparte de la narración
    // general (testimonios/"¿Qué se desató en la CdP?", ya guardada arriba
    // en la columna de casa_de_paz_reporte).
    await reemplazarTestimoniosCategorizados(reporteId, datos.testimoniosCategorizados);

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
 * KAN-271/375/367: mismo límite que fn_puede_editar_reporte_cdp -- solo para
 * decidir si se muestra el botón "Editar" en la UI (evita un click que
 * sabemos que va a rebotar). El permiso real siempre lo valida el backend
 * vía RLS, esto no lo reemplaza.
 * KAN-367 (2026-09-14): la ventana ya no se cuenta desde la fecha de
 * reunión -- se cuenta desde `fecha_creacion` (cuándo se cargó el
 * reporte), para que un reporte atrasado nazca con margen real para
 * corregirse. Además se separó en 2 códigos de configuración: uno para
 * Líder/Sublíder de CdP (`DIAS_LIMITE_EDICION_REPORTE_CDP`, default 3) y
 * otro para Líder/Supervisor de Red, Pastor y Supervisor de la Visión en
 * Acción (`DIAS_LIMITE_EDICION_REPORTE_RED`, default 30).
 */
export async function obtenerDiasLimiteEdicionReporte(
  iglesiaId: string,
  codigo: 'DIAS_LIMITE_EDICION_REPORTE_CDP' | 'DIAS_LIMITE_EDICION_REPORTE_RED'
): Promise<number> {
  const { data, error } = await supabase.rpc('fn_criterio', { p_iglesia_id: iglesiaId, p_codigo: codigo });
  if (error) throw error;
  return data ?? (codigo === 'DIAS_LIMITE_EDICION_REPORTE_CDP' ? 3 : 30);
}

/**
 * `fechaCreacionISO` es un timestamp completo (con hora) -- se compara por día
 * calendario UTC, igual que `fecha_creacion::date >= current_date - N` en
 * `fn_puede_editar_reporte_cdp` (Postgres corre en UTC). Antes comparaba contra
 * el día local del navegador: un reporte cargado cerca de la medianoche podía
 * verse como editable en el calendario (círculo verde clickeable) y el backend
 * lo rechazaba igual al intentar abrirlo -- bug real encontrado en KAN-367
 * (2026-09-15), reportado como "algunos círculos verdes no muestran contenido".
 */
export function dentroDeVentanaEdicionReporte(fechaCreacionISO: string, diasLimite: number): boolean {
  const limite = new Date(`${fechaCreacionISO.slice(0, 10)}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + diasLimite);
  const hoyUTC = new Date().toISOString().slice(0, 10);
  return hoyUTC <= limite.toISOString().slice(0, 10);
}

/** KAN-271/367: si el reporte todavía se puede editar (rol + ventana configurable, ver fn_puede_editar_reporte_cdp). */
export async function puedeEditarReporte(reporteId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_puede_editar_reporte_cdp', { p_reporte_id: reporteId });
  if (error) throw error;
  return !!data;
}

/** KAN-367: si el reporte todavía se puede ANULAR -- ventana propia, en horas, más corta que la de editar (ver fn_puede_anular_reporte_cdp). */
export async function puedeAnularReporte(reporteId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_puede_anular_reporte_cdp', { p_reporte_id: reporteId });
  if (error) throw error;
  return !!data;
}

/**
 * KAN-367: contexto de la CdP (Líder, Anfitrión, Dirección, Ciudad) del
 * reporte que se está editando -- se muestra en el panel de modificación
 * cuando quien edita no es el propio Líder/Sublíder de esa CdP (Líder/
 * Supervisor de Red, Pastor, Supervisor, que pueden estar editando reportes
 * de varias CdP distintas desde Control de Reportes).
 */
export async function obtenerCdpContextoReporte(casaDePazId: string): Promise<{ etiqueta: string; anfitrion_nombre: string; direccion: string; ciudad: string }> {
  const { data, error } = await supabase.rpc('fn_cdp_contexto_reporte', { p_casa_de_paz_id: casaDePazId });
  if (error) throw error;
  return data;
}

/**
 * KAN-367: si este usuario (Pastor o Supervisor de la Visión en Acción)
 * puede pedir autorización para editar este reporte aunque esté fuera de la
 * ventana normal -- se usa solo para decidir si se le ofrece esa opción en
 * vez de simplemente "ya no se puede editar" (Líder/Sublíder de CdP y
 * Líder/Supervisor de Red no tienen este escape).
 */
export async function puedeSolicitarEdicionFueraVentana(reporteId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_puede_solicitar_edicion_fuera_ventana', { p_reporte_id: reporteId });
  if (error) throw error;
  return !!data;
}

/**
 * KAN-367: autoriza (justificación + OTP) editar un reporte fuera de la
 * ventana normal. No modifica el reporte -- deja una autorización vigente
 * por 15 minutos que fn_puede_editar_reporte_cdp reconoce, así el resto del
 * flujo de edición (reporte + asistencia + ingresos) funciona sin cambios.
 */
export async function autorizarEdicionReporteFueraVentana(reporteId: string, justificacion: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('fn_autorizar_edicion_reporte_fuera_ventana', {
    p_reporte_id: reporteId,
    p_justificacion: justificacion,
    p_pin: pin,
  });
  if (error) throw error;
}

/**
 * KAN-271: trae un reporte ya enviado para precargar el formulario en modo
 * edición (Líder/Supervisor de Red, Líder/Sublíder de CdP, dentro de la
 * ventana configurable -- el gate real vive en RLS/fn_puede_editar_reporte_cdp,
 * acá solo se lee).
 */
export async function obtenerReportePorId(reporteId: string): Promise<ReporteExistente> {
  const [
    { data: reporte, error: errorReporte },
    { data: asistencia, error: errorAsistencia },
    { data: ingresos, error: errorIngresos },
    { data: testimoniosCategorizados, error: errorTestimonios },
  ] = await Promise.all([
      supabase
        .from('casa_de_paz_reporte')
        .select(
          'id, casa_de_paz_id, iglesia_id, fecha_reunion, libro_id, tema_id, tema_especial_txt, disertador_id, salio_evangelizar, evangelizados_declarados, testimonios, comentarios, disertador:disertador_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)'
        )
        .eq('id', reporteId)
        .single(),
      supabase
        .from('casa_de_paz_asistencia')
        .select('persona_id, es_visita, es_menor, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)')
        .eq('reporte_id', reporteId)
        .is('fecha_eliminacion', null),
      supabase
        .from('finanzas_ingreso')
        .select('monto, moneda_id, persona_id, tipo_ingreso:tipo_ingreso_id(codigo), persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)')
        .eq('reporte_id', reporteId)
        .is('fecha_eliminacion', null),
      // KAN-423
      supabase
        .from('casa_de_paz_reporte_testimonio')
        .select('id, categoria, texto, persona_id, nombre_persona')
        .eq('reporte_id', reporteId)
        .is('fecha_eliminacion', null),
    ]);
  if (errorReporte) throw errorReporte;
  if (errorAsistencia) throw errorAsistencia;
  if (errorIngresos) throw errorIngresos;
  if (errorTestimonios) throw errorTestimonios;

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
    testimoniosCategorizados: (testimoniosCategorizados ?? []).map((t) => ({
      clave: t.id,
      id: t.id,
      categoria: t.categoria as CategoriaTestimonio,
      texto: t.texto,
      personaId: t.persona_id ?? undefined,
      nombrePersona: t.nombre_persona ?? '',
      esExterno: !t.persona_id && !!t.nombre_persona,
    })),
    totalOfrendas,
    diezmos,
    monedaId,
    asistentes: (asistencia ?? []).map((a) => {
      const p = Array.isArray(a.persona) ? a.persona[0] : a.persona;
      const nombreCompleto = p ? [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ') : undefined;
      return { personaId: a.persona_id, esVisita: a.es_visita, esMenor: a.es_menor ?? undefined, nombreCompleto };
    }),
  };
}

/**
 * KAN-271/367: edita un reporte ya enviado -- mismo flujo de datos que
 * crearReporte (asistencia + ingresos), pero contra un reporte existente en
 * vez de crear uno nuevo. El permiso (rol + ventana configurable desde
 * fecha_creacion) lo valida RLS (fn_puede_editar_reporte_cdp); acá solo se
 * calcula el diff de asistencia contra lo que ya estaba guardado.
 * KAN-367: fecha_reunion ya es parte de lo editable (antes quedaba fija) --
 * el índice único uq_reporte_cdp_fecha sigue protegiendo contra choques al
 * cambiarla, y fecha_creacion (el ancla real de la ventana) nunca se toca
 * acá, así que cambiar fecha_reunion no altera el resultado de
 * fn_puede_editar_reporte_cdp para esta misma fila.
 */
export async function actualizarReporte(reporteId: string, datos: NuevoReporte): Promise<ResultadoReporte> {
  const { error: errorReporte } = await supabase
    .from('casa_de_paz_reporte')
    .update({
      fecha_reunion: datos.fecha_reunion,
      libro_id: datos.libro_id || null,
      tema_id: datos.tema_id || null,
      tema_especial_txt: datos.tema_especial_txt || null,
      disertador_id: datos.disertador_id || null,
      salio_evangelizar: datos.salio_evangelizar,
      evangelizados_declarados: datos.evangelizados_declarados ?? null,
      testimonios: datos.testimonios || null,
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
  const estadoNcId = await obtenerEstadoNcIdSiHaceFalta(datos.visitasNuevas);

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
          // KAN-406: edad aproximada cuando no se conoce fecha_nacimiento --
          // dato no confirmado, se guarda tal cual (nunca se deriva una
          // fecha ficticia a partir de esto).
          edad_aproximada: visita.edad_aproximada ?? null,
          membresia_completada: false,
        })
        .select('id')
        .single();
      if (errorPersona) throw errorPersona;

      if (visita.telefono?.trim() && tipoTelefonoId) {
        await agregarTelefono(datos.iglesia_id, persona.id, tipoTelefonoId, visita.telefono.trim(), null, true);
      }
      await marcarNuevoConvertidoSiCorresponde(datos.iglesia_id, persona.id, estadoNcId, visita.acepto_a_cristo);

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

  // KAN-423: mismo reemplazo completo que en crearReporte.
  await reemplazarTestimoniosCategorizados(reporteId, datos.testimoniosCategorizados);

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

/**
 * KAN-435 (autoguardado del Reporte de Casa de Paz): un borrador por
 * (casa_de_paz_id, fecha_reunion) -- mismo criterio de unicidad que el
 * reporte real. `fechaReunion` identifica CUÁL borrador (el líder puede
 * tener el de hoy y, aparte, uno de una semana atrasada que está
 * completando desde el círculo rojo del calendario, sin pisarse).
 */
export async function obtenerBorradorReporte(casaDePazId: string, fechaReunion: string): Promise<BorradorReporte | null> {
  const { data, error } = await supabase
    .from('casa_de_paz_reporte_borrador')
    .select('id, payload, fecha_actualizacion')
    .eq('casa_de_paz_id', casaDePazId)
    .eq('payload->>fecha_reunion', fechaReunion)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, payload: data.payload as BorradorReportePayload, fechaActualizacion: data.fecha_actualizacion };
}

/**
 * `borradorId` viene de un guardado anterior (o de `obtenerBorradorReporte`)
 * -- si no hay todavía, se crea. Si el insert choca contra el índice único
 * (otra pestaña lo creó primero para la misma CdP+fecha), se recupera y se
 * actualiza en vez de fallar -- el autoguardado nunca debería mostrarle un
 * error al líder por esto.
 */
export async function guardarBorradorReporte(
  borradorId: string | null,
  iglesiaId: string,
  casaDePazId: string,
  payload: BorradorReportePayload
): Promise<string> {
  if (borradorId) {
    const { error } = await supabase
      .from('casa_de_paz_reporte_borrador')
      .update({ payload, fecha_actualizacion: new Date().toISOString() })
      .eq('id', borradorId);
    if (error) throw error;
    return borradorId;
  }

  const { data, error } = await supabase
    .from('casa_de_paz_reporte_borrador')
    .insert({ iglesia_id: iglesiaId, casa_de_paz_id: casaDePazId, payload })
    .select('id')
    .single();
  if (!error) return data.id;

  if (error.code === '23505') {
    const existente = await obtenerBorradorReporte(casaDePazId, payload.fecha_reunion);
    if (existente) {
      const { error: errorUpdate } = await supabase
        .from('casa_de_paz_reporte_borrador')
        .update({ payload, fecha_actualizacion: new Date().toISOString() })
        .eq('id', existente.id);
      if (errorUpdate) throw errorUpdate;
      return existente.id;
    }
  }
  throw error;
}

export async function eliminarBorradorReporte(borradorId: string): Promise<void> {
  const { error } = await supabase.from('casa_de_paz_reporte_borrador').delete().eq('id', borradorId);
  if (error) throw error;
}
