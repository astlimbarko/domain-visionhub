import { supabase } from './supabase';
import { inicioSemanaISO } from '@/utils/calendario-fechas';
import type {
  CamposObligatoriosReporte,
  Libro,
  MegaFiestaDelDia,
  MiembroCdp,
  NuevoReporte,
  ReporteDeLaSemana,
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
    return { persona_id: r.persona_id, nombre_completo: nombre, tiene_fecha_nacimiento: !!p?.fecha_nacimiento };
  });
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

export async function obtenerReportesRecientes(casaDePazId: string): Promise<ReporteReciente[]> {
  const { data, error } = await supabase
    .from('v_reporte_totales')
    .select('reporte_id, fecha_reunion, total_asistentes, total_menores, total_mayores')
    .eq('casa_de_paz_id', casaDePazId)
    .order('fecha_reunion', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.reporte_id,
    fecha_reunion: r.fecha_reunion,
    total_asistentes: r.total_asistentes,
    total_menores: r.total_menores,
    total_mayores: r.total_mayores,
  }));
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

  const personaIds: { id: string; esMenor?: boolean }[] = datos.asistentesExistentes.map((a) => ({
    id: a.personaId,
    esMenor: a.esMenor,
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
    personaIds.push({ id: persona.id, esMenor: visita.es_menor });
  }

  if (personaIds.length > 0) {
    const { error: errorAsistencia } = await supabase.from('casa_de_paz_asistencia').insert(
      personaIds.map((p) => ({
        iglesia_id: datos.iglesia_id,
        reporte_id: reporteId,
        persona_id: p.id,
        es_menor: p.esMenor ?? null,
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
