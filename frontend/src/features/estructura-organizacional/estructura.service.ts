import { supabase } from '@/services/supabase';
import type { CargoCdpCodigo } from '@/types/casas-de-paz.types';
import type {
  CargoRedEstructura,
  CasaDePazEstructura,
  CrearRedEstructuraEntrada,
  DepartamentoEstructura,
  EstructuraOrganizacionalDatos,
  PersonaEstructura,
  PersonaOpcionEstructura,
  PosicionNodoGuardar,
  RedEstructura,
} from './types';

function esCimientoNoDisponible(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

interface IglesiaFila {
  id: string;
  nombre: string | null;
  sufijo: string;
  pastor_id: string | null;
  supervisor_id: string | null;
}

interface PersonaFila {
  id: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  correo: string | null;
  usuario_id: string | null;
}

interface CargoFila { id: string; codigo: string }
interface DepartamentoFila {
  id: string;
  codigo: string;
  nombre: string;
  color: string;
  color_nombre: string;
}
interface CargoEntidadFila { persona_id: string; cargo_id: string; red_id?: string; casa_de_paz_id?: string; departamento_id?: string }
interface UsuarioRolFila {
  usuario_id: string;
  correo: string;
  rol: string;
  persona_id: string | null;
  persona_nombre: string | null;
}

interface InvitacionRedFila {
  id: string;
  correo: string;
  red_id: string;
  cargo_codigo: CargoRedEstructura;
  estado: 'PENDIENTE' | 'COMPLETADA';
}

interface PersonaBusquedaFila {
  id: string;
  nombre_completo: string;
  correo: string | null;
}

function nombrePersona(persona: PersonaFila): string {
  return [persona.primer_nombre, persona.segundo_nombre, persona.primer_apellido, persona.segundo_apellido]
    .filter(Boolean)
    .join(' ');
}

// Formato corto pedido por el owner (2026-08-07) para tarjetas de espacio
// reducido (ej. lider de Casa de Paz en el lienzo): primer nombre y primer
// apellido completos, segundo nombre/apellido solo como inicial. Ejemplo:
// "Gonzalo Joaquin Veizaga Justiniano" -> "Gonzalo J. Veizaga J.".
function nombreAbreviado(persona: PersonaFila): string {
  return [
    persona.primer_nombre,
    persona.segundo_nombre ? `${persona.segundo_nombre.charAt(0)}.` : null,
    persona.primer_apellido,
    persona.segundo_apellido ? `${persona.segundo_apellido.charAt(0)}.` : null,
  ].filter(Boolean).join(' ');
}

export async function obtenerEstructuraOrganizacional(
  iglesiaId: string,
): Promise<EstructuraOrganizacionalDatos> {
  // Una Red eliminada sigue visible (agrisada) durante 1 año antes de
  // desaparecer del panel -- pedido explícito del owner, mismo criterio de
  // "nunca borrado físico" que ya usa toda la app.
  const cortePeriodoGracia = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const [iglesiaResultado, departamentosResultado, redesResultado, casasResultado, relacionesResultado,
    configuracionResultado, posicionesResultado, invitacionesRedResultado, usuariosResultado, cargosResultado,
    cargosRedResultado, cargosCdpResultado, cargosDepartamentoResultado] =
    await Promise.all([
      supabase
        .from('iglesia')
        .select('id, nombre, sufijo, pastor_id, supervisor_id')
        .eq('id', iglesiaId)
        .is('fecha_eliminacion', null)
        .single(),
      supabase
        .from('departamento')
        .select('id, codigo, nombre, color, color_nombre')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_eliminacion', null)
        .order('codigo'),
      supabase
        .from('red')
        .select('id, nombre, color, fecha_eliminacion')
        .eq('iglesia_id', iglesiaId)
        .or(`fecha_eliminacion.is.null,fecha_eliminacion.gte.${cortePeriodoGracia}`)
        .order('nombre'),
      supabase
        .from('casa_de_paz')
        .select('id, nombre')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_eliminacion', null)
        .order('nombre'),
      supabase
        .from('casa_de_paz_red')
        .select('casa_de_paz_id, red_id')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_fin', null)
        .is('fecha_eliminacion', null),
      supabase
        .from('estructura_organigrama')
        .select('version, otp_requerido')
        .eq('iglesia_id', iglesiaId)
        .maybeSingle(),
      supabase
        .from('estructura_nodo_posicion')
        .select('nodo_clave, posicion_x, posicion_y')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_eliminacion', null),
      supabase.rpc('fn_estructura_listar_invitaciones_red', { p_iglesia_id: iglesiaId }),
      supabase.rpc('fn_listar_usuarios', { p_iglesia_id: iglesiaId }),
      supabase
        .from('cargo')
        .select('id, codigo')
        .in('codigo', ['LIDER_RED', 'SUBLIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP', 'ANFITRION', 'LIDER_DEPARTAMENTO'])
        .is('fecha_eliminacion', null),
      supabase
        .from('red_cargo')
        .select('red_id, persona_id, cargo_id')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_fin', null)
        .is('fecha_eliminacion', null),
      supabase
        .from('casa_de_paz_cargo')
        .select('casa_de_paz_id, persona_id, cargo_id')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_fin', null)
        .is('fecha_eliminacion', null),
      supabase
        .from('departamento_cargo')
        .select('departamento_id, persona_id, cargo_id')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_fin', null)
        .is('fecha_eliminacion', null),
    ]);

  const errores = [
    iglesiaResultado.error,
    departamentosResultado.error,
    redesResultado.error,
    casasResultado.error,
    relacionesResultado.error,
    invitacionesRedResultado.error,
    usuariosResultado.error,
    cargosResultado.error,
    cargosRedResultado.error,
    cargosCdpResultado.error,
    cargosDepartamentoResultado.error,
  ].filter(Boolean);
  if (errores[0]) throw errores[0];

  const errorLayout = configuracionResultado.error ?? posicionesResultado.error;
  if (errorLayout && !esCimientoNoDisponible(errorLayout)) throw errorLayout;

  const iglesia = iglesiaResultado.data as IglesiaFila;
  const todasAsignaciones = [
    ...(cargosRedResultado.data ?? []),
    ...(cargosCdpResultado.data ?? []),
    ...(cargosDepartamentoResultado.data ?? []),
  ] as CargoEntidadFila[];
  const personaIds = [...new Set([
    ...todasAsignaciones.map((asignacion) => asignacion.persona_id),
    iglesia.pastor_id,
    iglesia.supervisor_id,
  ].filter((id): id is string => Boolean(id)))];

  const casaIds = (casasResultado.data ?? []).map((casa) => casa.id);
  const direccionesPorCasa = new Map<string, string>();
  if (casaIds.length > 0) {
    const { data, error } = await supabase
      .from('direccion_asignacion')
      .select('casa_de_paz_id, direccion:direccion_id(zona, calle, numero)')
      .in('casa_de_paz_id', casaIds)
      .eq('activo', true)
      .is('fecha_eliminacion', null);
    if (error) throw error;
    for (const fila of data ?? []) {
      const d = Array.isArray(fila.direccion) ? fila.direccion[0] : fila.direccion;
      const breve = [d?.calle, d?.numero].filter(Boolean).join(' ') || d?.zona || null;
      if (breve) direccionesPorCasa.set(fila.casa_de_paz_id, breve);
    }
  }

  let personas = new Map<string, PersonaEstructura>();
  if (personaIds.length > 0) {
    const { data, error } = await supabase
      .from('persona')
      .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, correo, usuario_id')
      .in('id', personaIds)
      .is('fecha_eliminacion', null);
    if (error) throw error;
    personas = new Map(
      ((data ?? []) as PersonaFila[]).map((persona) => [
        persona.id,
        {
          id: persona.id,
          nombre: nombrePersona(persona),
          nombreAbreviado: nombreAbreviado(persona) || persona.correo || 'Persona sin identificar',
          correo: persona.correo,
          etiqueta: nombrePersona(persona) || persona.correo || 'Persona sin identificar',
          membresiaPendiente: !persona.usuario_id,
        },
      ]),
    );
  }

  const redPorCasa = new Map(
    (relacionesResultado.data ?? []).map((relacion) => [relacion.casa_de_paz_id, relacion.red_id]),
  );
  const codigoPorCargo = new Map(
    ((cargosResultado.data ?? []) as CargoFila[]).map((cargo) => [cargo.id, cargo.codigo]),
  );
  const responsablesDe = (
    asignaciones: CargoEntidadFila[],
    campo: 'red_id' | 'casa_de_paz_id' | 'departamento_id',
    entidadId: string,
    codigo: string,
  ): PersonaEstructura[] => asignaciones
    .filter((asignacion) => asignacion[campo] === entidadId && codigoPorCargo.get(asignacion.cargo_id) === codigo)
    .map((asignacion) => personas.get(asignacion.persona_id))
    .filter((persona): persona is PersonaEstructura => Boolean(persona));

  const invitacionesPendientes = (invitacionesRedResultado.data ?? []) as InvitacionRedFila[];
  const invitadosDe = (redId: string, codigo: CargoRedEstructura): PersonaEstructura[] =>
    invitacionesPendientes
      .filter((invitacion) =>
        invitacion.red_id === redId
        && invitacion.cargo_codigo === codigo
        && invitacion.estado === 'PENDIENTE',
      )
      .map((invitacion) => ({
        id: `invitacion:${invitacion.id}`,
        nombre: null,
        correo: invitacion.correo,
        etiqueta: invitacion.correo,
        membresiaPendiente: true,
        invitacionId: invitacion.id,
      }));
  const usuarios = (usuariosResultado.data ?? []) as UsuarioRolFila[];
  const responsablesRol = (rol: string, personaIdPrincipal: string | null): PersonaEstructura[] => {
    const responsables: PersonaEstructura[] = usuarios
      .filter((usuario) => usuario.rol === rol)
      .map((usuario) => {
      const nombre = usuario.persona_nombre?.trim() || null;
      return {
        id: usuario.persona_id ?? usuario.usuario_id,
        nombre,
        correo: usuario.correo,
        etiqueta: nombre ?? usuario.correo,
        membresiaPendiente: !nombre,
      };
    });
    const principal = personaIdPrincipal ? personas.get(personaIdPrincipal) : null;
    if (principal && !responsables.some((responsable) => responsable.id === principal.id)) {
      responsables.unshift(principal);
    }
    return responsables;
  };

  return {
    iglesia: {
      id: iglesia.id,
      nombre: iglesia.nombre ?? iglesia.sufijo,
    },
    pastores: responsablesRol('PASTOR', iglesia.pastor_id),
    supervisores: responsablesRol('SUPERVISOR_VISION_ACCION', iglesia.supervisor_id),
    departamentos: ((departamentosResultado.data ?? []) as DepartamentoFila[]).map((departamento) => ({
      id: departamento.id,
      codigo: departamento.codigo,
      nombre: departamento.nombre,
      color: departamento.color,
      colorNombre: departamento.color_nombre,
      lideres: responsablesDe(
        (cargosDepartamentoResultado.data ?? []) as CargoEntidadFila[],
        'departamento_id', departamento.id, 'LIDER_DEPARTAMENTO',
      ),
    })) as DepartamentoEstructura[],
    redes: (redesResultado.data ?? []).map((red) => ({
      id: red.id,
      nombre: red.nombre,
      color: red.color,
      eliminada: red.fecha_eliminacion !== null,
      lideres: [
        ...responsablesDe((cargosRedResultado.data ?? []) as CargoEntidadFila[], 'red_id', red.id, 'LIDER_RED'),
        ...invitadosDe(red.id, 'LIDER_RED'),
      ],
      supervisores: [
        ...responsablesDe((cargosRedResultado.data ?? []) as CargoEntidadFila[], 'red_id', red.id, 'SUBLIDER_RED'),
        ...invitadosDe(red.id, 'SUBLIDER_RED'),
      ],
    })) as RedEstructura[],
    casasDePaz: (casasResultado.data ?? []).map((casa) => ({
      id: casa.id,
      nombre: casa.nombre,
      redId: redPorCasa.get(casa.id) ?? null,
      lideres: responsablesDe((cargosCdpResultado.data ?? []) as CargoEntidadFila[], 'casa_de_paz_id', casa.id, 'LIDER_CDP'),
      sublideres: responsablesDe((cargosCdpResultado.data ?? []) as CargoEntidadFila[], 'casa_de_paz_id', casa.id, 'SUBLIDER_CDP'),
      anfitriones: responsablesDe((cargosCdpResultado.data ?? []) as CargoEntidadFila[], 'casa_de_paz_id', casa.id, 'ANFITRION'),
      direccionBreve: direccionesPorCasa.get(casa.id) ?? null,
    })) as CasaDePazEstructura[],
    layout: {
      disponible: !errorLayout,
      version: Number(configuracionResultado.data?.version ?? 0),
      otpRequerido: Boolean(configuracionResultado.data?.otp_requerido),
      posiciones: posicionesResultado.data ?? [],
    },
  };
}

export async function guardarPosicionesEstructura(
  iglesiaId: string,
  nodos: PosicionNodoGuardar[],
  versionEsperada: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('fn_estructura_guardar_posiciones', {
    p_iglesia_id: iglesiaId,
    p_nodos: nodos,
    p_version_esperada: versionEsperada,
  });
  if (error) throw error;
  return Number(data);
}
export async function crearRedEstructura(entrada: CrearRedEstructuraEntrada): Promise<string> {
  const { data, error } = await supabase.rpc('fn_estructura_crear_red', {
    p_iglesia_id: entrada.iglesiaId,
    p_nombre: entrada.nombre,
    p_color: entrada.color,
    p_lider_persona_id: entrada.liderPersonaId ?? null,
    p_supervisor_persona_id: entrada.supervisorPersonaId ?? null,
    p_otp: entrada.otp ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function eliminarRedEstructura(redId: string, otp?: string | null): Promise<void> {
  const { error } = await supabase.rpc('fn_estructura_eliminar_red', { p_red_id: redId, p_otp: otp ?? null });
  if (error) throw error;
}

export async function reactivarRedEstructura(redId: string, otp?: string | null): Promise<void> {
  const { error } = await supabase.rpc('fn_estructura_reactivar_red', { p_red_id: redId, p_otp: otp ?? null });
  if (error) throw error;
}

export async function programarBorradoDefinitivoRedEstructura(redId: string, otp: string): Promise<void> {
  const { error } = await supabase.rpc('fn_estructura_programar_borrado_red', { p_red_id: redId, p_otp: otp });
  if (error) throw error;
}

export async function deshacerBorradoDefinitivoRedEstructura(redId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_estructura_deshacer_borrado_red', { p_red_id: redId });
  if (error) throw error;
}

export async function eliminarCasaDePazEstructura(cdpId: string, otp?: string | null): Promise<void> {
  const { error } = await supabase.rpc('fn_estructura_eliminar_casa_de_paz', { p_cdp_id: cdpId, p_otp: otp ?? null });
  if (error) throw error;
}

export async function actualizarRedEstructura(
  redId: string,
  nombre: string,
  color: string,
  otp?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('fn_estructura_actualizar_red', {
    p_red_id: redId,
    p_nombre: nombre,
    p_color: color,
    p_otp: otp ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function asignarCargoRedEstructura(
  redId: string,
  personaId: string,
  codigo: CargoRedEstructura,
  otp?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('fn_estructura_asignar_cargo_red', {
    p_red_id: redId,
    p_persona_id: personaId,
    p_codigo: codigo,
    p_otp: otp ?? null,
  });
  if (error) throw error;
  return data as string;
}

// REQ-ASG-7: aviso por correo a quien fue designado. No bloquea el flujo
// de asignacion si falla (ya se asigno el cargo igual) -- por eso quien
// llama la usa "en paralelo", sin esperar el resultado para dar por hecha
// la asignacion.
export async function notificarAsignacionCargoRed(
  redId: string,
  personaId: string,
  codigo: CargoRedEstructura,
): Promise<void> {
  const { error } = await supabase.functions.invoke('notificar-asignacion-cargo', {
    body: { redId, personaId, cargo: codigo },
  });
  if (error) throw error;
}

// KAN-117: mismo hueco que REQ-ASG-7 pero para Lider/Sublider de Casa de Paz
// y para Pastor/Supervisor de la Vision en Accion -- ver notas en la Edge
// Function y en las migraciones fn_estructura_datos_notificacion_cargo_cdp /
// _principal. No bloquea el flujo de asignacion si falla, mismo criterio
// que notificarAsignacionCargoRed de arriba.
export async function notificarAsignacionCargoCdp(
  cdpId: string,
  personaId: string,
  codigo: CargoCdpCodigo,
): Promise<void> {
  const { error } = await supabase.functions.invoke('notificar-asignacion-cargo', {
    body: { cdpId, personaId, cargo: codigo },
  });
  if (error) throw error;
}

export async function notificarAsignacionCargoPrincipal(
  iglesiaId: string,
  personaId: string,
  tipo: 'PASTOR' | 'SUPERVISOR',
): Promise<void> {
  const { error } = await supabase.functions.invoke('notificar-asignacion-cargo', {
    body: { iglesiaId, personaId, cargo: tipo },
  });
  if (error) throw error;
}

export async function quitarCargoRedEstructura(
  redId: string,
  codigo: CargoRedEstructura,
  otp?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('fn_estructura_quitar_cargo_red', {
    p_red_id: redId,
    p_codigo: codigo,
    p_otp: otp ?? null,
  });
  if (error) throw error;
  return Number(data);
}

export async function configurarOtpEstructura(
  iglesiaId: string,
  requerido: boolean,
  otp?: string | null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_estructura_configurar_otp', {
    p_iglesia_id: iglesiaId,
    p_requerido: requerido,
    p_otp: otp ?? null,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function asignarPastorEstructura(
  iglesiaId: string,
  personaId: string,
  otp?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('fn_estructura_asignar_pastor', {
    p_iglesia_id: iglesiaId,
    p_persona_id: personaId,
    p_otp: otp ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function quitarPastorEstructura(iglesiaId: string, personaId: string, otp?: string | null): Promise<void> {
  const { error } = await supabase.rpc('fn_estructura_quitar_pastor', {
    p_iglesia_id: iglesiaId,
    p_persona_id: personaId,
    p_otp: otp ?? null,
  });
  if (error) throw error;
}

export async function quitarSupervisorEstructura(iglesiaId: string, personaId: string, otp?: string | null): Promise<void> {
  const { error } = await supabase.rpc('fn_estructura_quitar_supervisor', {
    p_iglesia_id: iglesiaId,
    p_persona_id: personaId,
    p_otp: otp ?? null,
  });
  if (error) throw error;
}

export async function asignarSupervisorEstructura(
  iglesiaId: string,
  personaId: string,
  otp?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('fn_estructura_asignar_supervisor', {
    p_iglesia_id: iglesiaId,
    p_persona_id: personaId,
    p_otp: otp ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function crearCasaDePazEstructura(
  redId: string,
  liderPersonaId?: string | null,
  otp?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('fn_estructura_crear_cdp', {
    p_red_id: redId,
    p_lider_persona_id: liderPersonaId ?? null,
    p_otp: otp ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function buscarPersonasEstructura(
  iglesiaId: string,
  texto: string,
): Promise<PersonaOpcionEstructura[]> {
  const { data, error } = await supabase.rpc('fn_buscar_personas', {
    p_iglesia_id: iglesiaId,
    p_texto: texto.trim(),
    p_incluir_ocultas: false,
    p_limite: 10,
  });
  if (error) throw error;
  return ((data ?? []) as PersonaBusquedaFila[]).map((persona) => ({
    id: persona.id,
    nombre: persona.nombre_completo,
    correo: persona.correo,
  }));
}
