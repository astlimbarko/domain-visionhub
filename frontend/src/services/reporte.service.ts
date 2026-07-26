import { supabase } from './supabase';
import { agregarTelefono, obtenerTiposTelefono } from './persona.service';
import { inicioSemanaISO } from '@/utils/calendario-fechas';
import { calcularEdad } from '@/utils/edad';
import type {
  CamposObligatoriosReporte,
  HistorialAsistencia,
  Libro,
  MegaFiestaDelDia,
  MiembroCdp,
  NuevoReporte,
  ReporteDeLaSemana,
  ReporteRedFila,
  ReporteReciente,
  ResultadoReporte,
  Tema,
} from '@/types/reporte.types';

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
    .select('reporte_id, casa_de_paz_id, fecha_reunion, total_asistentes')
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
  const { data: reportes, error: errorReportes } = await supabase
    .from('casa_de_paz_reporte')
    .select('id, fecha_reunion')
    .eq('casa_de_paz_id', casaDePazId)
    .order('fecha_reunion', { ascending: false })
    .limit(REUNIONES_HISTORIAL);
  if (errorReportes) throw errorReportes;

  const { data: miembros, error: errorMiembros } = await supabase
    .from('casa_de_paz_membresia')
    .select(
      'persona_id, persona:persona_id(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, sexo, fecha_nacimiento)'
    )
    .eq('casa_de_paz_id', casaDePazId)
    .is('fecha_fin', null);
  if (errorMiembros) throw errorMiembros;

  const reuniones = (reportes ?? []).map((r) => ({ id: r.id, fecha_reunion: r.fecha_reunion }));
  const reporteIds = reuniones.map((r) => r.id);
  const personaIds = (miembros ?? []).map((m) => m.persona_id);

  let asistencias: { reporte_id: string; persona_id: string }[] = [];
  if (reporteIds.length > 0) {
    const { data, error } = await supabase.from('casa_de_paz_asistencia').select('reporte_id, persona_id').in('reporte_id', reporteIds);
    if (error) throw error;
    asistencias = data ?? [];
  }

  let telefonos: { persona_id: string; telefono: { numero: string } | { numero: string }[] | null }[] = [];
  if (personaIds.length > 0) {
    const { data, error } = await supabase
      .from('telefono_asignacion')
      .select('persona_id, telefono:telefono_id(numero)')
      .in('persona_id', personaIds)
      .eq('es_principal', true)
      .is('fecha_eliminacion', null);
    if (error) throw error;
    telefonos = data ?? [];
  }

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

/** Un Reporte cuenta por semana, no por fecha exacta: avisa si la semana de `fecha` ya tiene uno. */
export async function obtenerReporteSemanaExistente(
  casaDePazId: string,
  fecha: string
): Promise<ReporteDeLaSemana | null> {
  const { data, error } = await supabase
    .from('casa_de_paz_reporte')
    .select('fecha_reunion')
    .eq('casa_de_paz_id', casaDePazId)
    .eq('semana_inicio', inicioSemanaISO(fecha))
    .maybeSingle();
  if (error) throw error;
  return data;
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

  const personaIds: { id: string; esMenor?: boolean; esVisita?: boolean }[] = datos.asistentesExistentes.map((a) => ({
    id: a.personaId,
    esMenor: a.esMenor,
    esVisita: a.esVisita,
  }));

  for (const visita of datos.visitasNuevas) {
    const { data: persona, error: errorPersona } = await supabase
      .from('persona')
      .insert({
        iglesia_id: datos.iglesia_id,
        primer_nombre: visita.primer_nombre,
        primer_apellido: visita.primer_apellido,
        sexo: visita.sexo,
      })
      .select('id')
      .single();
    if (errorPersona) throw errorPersona;
    personaIds.push({ id: persona.id, esMenor: visita.es_menor, esVisita: true });

    if (visita.telefono?.trim()) {
      const tipos = await obtenerTiposTelefono();
      if (tipos[0]) {
        await agregarTelefono(datos.iglesia_id, persona.id, tipos[0].id, visita.telefono.trim(), null, true);
      }
    }
  }

  if (personaIds.length > 0) {
    const { error: errorAsistencia } = await supabase.from('casa_de_paz_asistencia').insert(
      personaIds.map((p) => ({
        iglesia_id: datos.iglesia_id,
        reporte_id: reporteId,
        persona_id: p.id,
        es_menor: p.esMenor ?? null,
        es_visita: p.esVisita ?? false,
      }))
    );
    if (errorAsistencia) throw errorAsistencia;
  }

  const { error: errorIngresos } = await supabase.rpc('fn_registrar_ingresos_reporte', {
    p_reporte_id: reporteId,
    p_total_ofrendas: datos.totalOfrendas,
    p_total_diezmos: datos.totalDiezmos ?? null,
    p_moneda_id: datos.monedaId,
  });
  if (errorIngresos) throw errorIngresos;

  const { data: totales, error: errorTotales } = await supabase
    .from('v_reporte_totales')
    .select('total_menores, total_mayores, total_asistentes')
    .eq('reporte_id', reporteId)
    .single();
  if (errorTotales) throw errorTotales;

  return {
    reporteId,
    totalMenores: totales.total_menores,
    totalMayores: totales.total_mayores,
    totalAsistentes: totales.total_asistentes,
  };
}
