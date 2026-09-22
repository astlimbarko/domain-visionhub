import { supabase } from './supabase';
import type {
  CasaDePazAfirmacion,
  CasaPazUrlAfirmacion,
  DatosPersonaAfirmacion,
  EstadisticasPersonasAfirmacion,
  EstadisticasRegistroAfirmacion,
  EstadoUrl,
  LiderCdpAfirmacion,
  RedAfirmacion,
  RegistrarPersonaAfirmacionResponse,
  SetEstadoUrlResponse,
} from '@/types/afirmacion.types';
import type { CamposObligatorios } from '@/types/registro-publico.types';
import type { ResultadoBusquedaMembresia } from '@/types/persona.types';

// fn_config_formulario ya existe (06_configuracion.sql) y ya se usa para
// FORMULARIO_REPORTE (reporte.service.ts) -- se reutiliza aca con
// FORMULARIO_MEMBRESIA para que el registro interno pinte los mismos
// asteriscos de obligatoriedad que el registro publico. Sin migracion nueva.
// Devuelve las claves crudas de configuracion_definicion.codigo
// (MEMBRESIA_CI_OBLIGATORIO, etc.) -- se traducen aca al shape limpio que ya
// espera CamposMembresiaFields (mismo shape que fn_resolver_url_registro
// arma a mano para el flujo publico).
export async function obtenerCamposObligatoriosMembresia(iglesiaId: string): Promise<CamposObligatorios> {
  const { data, error } = await supabase.rpc('fn_config_formulario', {
    p_iglesia_id: iglesiaId,
    p_formulario: 'FORMULARIO_MEMBRESIA',
  });
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, boolean>;
  return {
    ci: raw.MEMBRESIA_CI_OBLIGATORIO ?? false,
    fecha_nacimiento: raw.MEMBRESIA_FECHA_NACIMIENTO_OBLIGATORIO ?? false,
    ocupacion: raw.MEMBRESIA_OCUPACION_OBLIGATORIO ?? false,
    grado_instruccion: raw.MEMBRESIA_GRADO_INSTRUCCION_OBLIGATORIO ?? false,
  };
}

export async function listarLideresCdpAfirmacion(iglesiaId: string): Promise<LiderCdpAfirmacion[]> {
  const { data, error } = await supabase.rpc('fn_listar_lideres_cdp_afirmacion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

// Plan panel Afirmación 2026-08-21: selector de Red antes que el de líder.
export async function listarRedesAfirmacion(iglesiaId: string): Promise<RedAfirmacion[]> {
  const { data, error } = await supabase.rpc('fn_listar_redes_afirmacion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function registrarPersonaAfirmacion(
  datos: DatosPersonaAfirmacion,
  casaDePazCargoId: string,
): Promise<RegistrarPersonaAfirmacionResponse> {
  const { data, error } = await supabase.rpc('fn_registrar_persona_afirmacion', {
    p_datos: datos,
    p_casa_de_paz_cargo_id: casaDePazCargoId,
  });
  if (error) throw error;
  return data as RegistrarPersonaAfirmacionResponse;
}

export async function listarUrlsAfirmacion(iglesiaId: string): Promise<CasaPazUrlAfirmacion[]> {
  const { data, error } = await supabase.rpc('fn_listar_casa_paz_url_afirmacion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

export async function setEstadoUrlsAfirmacion(ids: string[], estado: EstadoUrl): Promise<SetEstadoUrlResponse> {
  const { data, error } = await supabase.rpc('fn_set_estado_casa_paz_url', { p_ids: ids, p_estado: estado });
  if (error) throw error;
  return data as SetEstadoUrlResponse;
}

// KAN-127: todas las Casas de Paz de la iglesia, con o sin líder vigente.
export async function listarCasasDePazAfirmacion(iglesiaId: string): Promise<CasaDePazAfirmacion[]> {
  const { data, error } = await supabase.rpc('fn_listar_casas_de_paz_afirmacion', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data ?? [];
}

// Plan panel Afirmación 2026-08-20, punto 1/4 (KAN-214): registros por URL vs. formulario interno.
export async function obtenerEstadisticasRegistroAfirmacion(iglesiaId: string): Promise<EstadisticasRegistroAfirmacion> {
  const { data, error } = await supabase.rpc('fn_afirmacion_estadisticas_registro', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data as EstadisticasRegistroAfirmacion;
}

const MEMBRESIA_POR_PAGINA = 50;

/** Catálogo global de Estado (SIM/NC/CRE/RE, etc) -- sin iglesia_id, no hace
 * falta scope por iglesia. Filtro de Estado en la tabla de Membresía. */
export interface EstadoCatalogo {
  id: string;
  sigla: string;
  nombre: string;
}

export async function listarEstados(): Promise<EstadoCatalogo[]> {
  const { data, error } = await supabase.rpc('fn_listar_estados');
  if (error) throw error;
  return data ?? [];
}

/** KAN-358 seguimiento (2026-09-10/11): tabla de Membresía con campos
 * reales del censo (estado civil, rango, bautizado, cargos reales de
 * CdP/Red) -- no solo identidad básica. Ver fn_afirmacion_buscar_membresia.
 * Filtros como objeto (no posicionales) -- ya son 8, en línea se vuelve
 * ilegible y fácil de desordenar por accidente. */
export type CumpleanosPeriodo = 'DIA' | 'SEMANA' | 'MES';

export type EfesioTipoFiltro = 'APOSTOL' | 'PROFETA' | 'PASTOR' | 'EVANGELISTA' | 'MAESTRO';
export type CargoCensoFiltro = 'MINISTRO' | 'ANCIANO' | 'DIACONO';
export type RangoEdadFiltro = 'NINOS' | 'ADOLESCENTES' | 'JOVENES' | 'ADULTOS' | 'MAYORES';

export interface FiltrosMembresiaAfirmacion {
  redId?: string;
  casaDePazId?: string;
  estadoId?: string;
  sexo?: 'M' | 'F';
  viaRegistro?: 'URL' | 'FORMULARIO';
  conProfesion?: boolean;
  estadoCivil?: string;
  bautizado?: boolean;
  /** KAN-401: filtra contra fecha_nacimiento ignorando el año (día/semana/mes actual). */
  cumpleanosPeriodo?: CumpleanosPeriodo;
  /** KAN-401 seguimiento (2026-09-20): categorías nuevas de filtro. */
  efesioTipo?: EfesioTipoFiltro;
  conMinisterio?: boolean;
  cargoCenso?: CargoCensoFiltro;
  rangoEdad?: RangoEdadFiltro;
}

export async function buscarMembresiaAfirmacion(
  iglesiaId: string,
  texto: string,
  pagina = 1,
  porPagina = MEMBRESIA_POR_PAGINA,
  filtros: FiltrosMembresiaAfirmacion = {},
): Promise<ResultadoBusquedaMembresia> {
  const { data, error } = await supabase.rpc('fn_afirmacion_buscar_membresia', {
    p_iglesia_id: iglesiaId,
    p_texto: texto.trim() === '' ? null : texto.trim(),
    p_pagina: pagina,
    p_por_pagina: porPagina,
    p_red_id: filtros.redId ?? null,
    p_casa_de_paz_id: filtros.casaDePazId ?? null,
    p_estado_id: filtros.estadoId ?? null,
    p_sexo: filtros.sexo ?? null,
    p_via_registro: filtros.viaRegistro ?? null,
    p_con_profesion: filtros.conProfesion ?? null,
    p_estado_civil: filtros.estadoCivil ?? null,
    p_bautizado: filtros.bautizado ?? null,
    p_cumpleanos_periodo: filtros.cumpleanosPeriodo ?? null,
    p_efesio_tipo: filtros.efesioTipo ?? null,
    p_con_ministerio: filtros.conMinisterio ?? null,
    p_cargo_censo: filtros.cargoCenso ?? null,
    p_rango_edad: filtros.rangoEdad ?? null,
  });
  if (error) throw error;
  const resultados = data ?? [];
  return { resultados, total: resultados[0]?.total ?? 0 };
}

// Plan panel Afirmación 2026-08-20, punto 3/4 (KAN-216): totales para la fila de KPIs de /afirmacion-personas.
// KAN-386 seguimiento (2026-09-17): casaDePazId opcional -- scoped al panel
// "Membresía" por CdP (Líder/Sublíder CdP, Líder/Supervisor de Red).
export async function obtenerEstadisticasPersonasAfirmacion(iglesiaId: string, casaDePazId?: string): Promise<EstadisticasPersonasAfirmacion> {
  const { data, error } = await supabase.rpc('fn_afirmacion_estadisticas_personas', { p_iglesia_id: iglesiaId, p_casa_de_paz_id: casaDePazId ?? null });
  if (error) throw error;
  return data as EstadisticasPersonasAfirmacion;
}

// Pedido explícito del owner (2026-08-21): el interruptor general
// REGISTRO_URL_ACTIVO solo se veía en el Panel de Configuración -- si
// alguien miraba el panel de Afirmación con todos los enlaces individuales
// en ACTIVO, no había forma de notar desde ahí que el interruptor general
// seguía apagado. Solo lectura -- el cambio en sí sigue yendo por
// fn_set_configuracion (panel-supervisor.service.ts), sin tocar permisos.
export async function obtenerConfigRegistroUrlAfirmacion(iglesiaId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_afirmacion_config_registro_url', { p_iglesia_id: iglesiaId });
  if (error) throw error;
  return data as boolean;
}
