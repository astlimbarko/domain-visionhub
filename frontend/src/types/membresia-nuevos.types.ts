// KAN-488 (harness/21): datos de la "Membresía desde 0" (para gente nueva
// captada, distinta de la membresía por link). Extiende los campos básicos
// de persona (reusa DatosBasicosPersonaValores para poder pasarlos tal cual a
// DatosBasicosPersonaFields) y agrega los campos del inventario del spec +
// la opción "Asignar" de CdP (harness/23).
import {
  DATOS_BASICOS_PERSONA_VACIO,
  type DatosBasicosPersonaValores,
} from '@/components/personas/DatosBasicosPersonaFields';
import type { FamiliarInput } from '@/types/membresia-extendida.types';

export interface DatosMembresiaNuevos extends DatosBasicosPersonaValores {
  // harness/21 Req 1: si está seteado, es una persona EXISTENTE que se está
  // completando (no se crea una nueva; se actualiza). '' = persona nueva.
  personaExistenteId: string;
  ci: string;
  /** KAN-497 paso 5: la persona no recuerda su CI -- cuenta como respuesta. */
  ciNoRecuerda: boolean;
  correo: string;
  estadoCivil: string;
  ocupacion: string;
  gradoInstruccion: string;
  // Proceso / evangelismo
  esVisita: boolean; // NC/RE es automático (persona nueva -> NC); solo se marca si es visita/simpatizante
  // Bautismo, categoría de evangelismo, horario de contacto y familia se
  // quitaron del form por decisión del owner (2026-10-01): el bautismo vive
  // solo en el proceso Bautismo; evangelismo no entra en la membresía desde-0.
  motivoLlegadaId: string;
  // Preguntas livianas sobre vínculo con la iglesia
  yaAsisteIglesia: boolean;
  trabajoMinisterio: boolean;
  ministerioCual: string;
  // Discipulado: NIVEL/curso real (discipulado_nivel_enum), no un sí/no
  // (decisión del owner 2026-10-01). '' = no está en discipulado.
  discipuladoNivel: string;
  // Casa de Paz (harness/23, KAN-490): el selector unificado SelectorCasaDePaz
  // produce estos campos. El "modo" se deriva (cdpModoDerivado): invitador real
  // -> INVITADOR; CdP explícita -> LISTA; nada -> ASIGNAR (va a designación).
  invitadorPersonaId: string;   // persona real del sistema ('' si libre o nada)
  invitadorNombre: string;      // nombre mostrado (real o texto libre)
  invitadorEsLibre: boolean;    // true = invitadorNombre es texto libre
  casaDePazId: string;          // CdP elegida/sugerida ('' = sin CdP)
  casaDePazNombre: string;
  // UX 2026-10-02: Familia + Cónyuge (se reusan SeccionFamiliaMembresia y
  // SeccionConyugeMembresia de la membresía extendida). El cónyuge es un
  // familiar más, con tipo_relacion_codigo='CONYUGE'.
  familiares: FamiliarInput[];
}

export const DATOS_MEMBRESIA_NUEVOS_VACIO: DatosMembresiaNuevos = {
  ...DATOS_BASICOS_PERSONA_VACIO,
  personaExistenteId: '',
  ci: '',
  ciNoRecuerda: false,
  correo: '',
  estadoCivil: '',
  ocupacion: '',
  gradoInstruccion: '',
  esVisita: false,
  motivoLlegadaId: '',
  yaAsisteIglesia: false,
  trabajoMinisterio: false,
  ministerioCual: '',
  discipuladoNivel: '',
  invitadorPersonaId: '',
  invitadorNombre: '',
  invitadorEsLibre: false,
  casaDePazId: '',
  casaDePazNombre: '',
  familiares: [],
};

/**
 * ¿Hay contenido real cargado? -- para el autoguardado/restauración (lección
 * KAN-443): NO considerar "contenido real" a los valores por defecto (ej.
 * telefonoPais '+591'), así un formulario recién abierto en blanco no dispara
 * un falso "se restauró tu borrador" ni guarda un borrador vacío.
 */
export function hayContenidoRealMembresia(d: DatosMembresiaNuevos): boolean {
  const textos = [
    d.primerNombre, d.segundoNombre, d.primerApellido, d.segundoApellido,
    d.telefonoNumero, d.sexo, d.fechaNacimiento, d.direccion,
    d.ci, d.correo, d.estadoCivil, d.ocupacion, d.gradoInstruccion,
    d.motivoLlegadaId, d.ministerioCual, d.discipuladoNivel,
    d.invitadorNombre, d.casaDePazNombre,
  ];
  if (textos.some((t) => t.trim() !== '')) return true;
  if ((d.familiares ?? []).length > 0) return true;
  return d.esVisita || d.yaAsisteIglesia || d.trabajoMinisterio || d.sinCelular || d.ciNoRecuerda;
}

/**
 * Campos obligatorios de la Membresía desde 0 (UX 2026-10-02: "todos llenos").
 * Excepciones: segundo nombre/apellido y correo NO son obligatorios; el
 * teléfono deja de serlo si la persona marcó "no tiene celular". Devuelve la
 * lista de etiquetas faltantes (vacía = se puede guardar) para avisar al
 * usuario qué falta en vez de un "faltan datos" genérico.
 */
export function camposObligatoriosFaltantes(d: DatosMembresiaNuevos): string[] {
  const faltan: string[] = [];
  if (d.primerNombre.trim() === '') faltan.push('Primer nombre');
  if (d.primerApellido.trim() === '') faltan.push('Primer apellido');
  if (d.sexo === '') faltan.push('Sexo');
  if (d.fechaNacimiento.trim() === '') faltan.push('Fecha de nacimiento');
  if (!d.sinCelular && d.telefonoNumero.trim() === '') faltan.push('Teléfono');
  if (d.direccion.trim() === '') faltan.push('Dirección');
  if (!d.ciNoRecuerda && d.ci.trim() === '') faltan.push('Número de documento');
  if (d.estadoCivil.trim() === '') faltan.push('Estado civil');
  if (d.gradoInstruccion.trim() === '') faltan.push('Grado de instrucción');
  if (d.motivoLlegadaId.trim() === '') faltan.push('¿Cómo llegó a la iglesia?');
  return faltan;
}

/** Mínimo para poder guardar la membresía real (todos los obligatorios). */
export function membresiaNuevosValida(d: DatosMembresiaNuevos): boolean {
  return camposObligatoriosFaltantes(d).length === 0;
}

/**
 * Porcentaje de completitud de la ficha (0-100), para mostrarlo al precargar
 * una persona existente -- así se ve de un vistazo qué tan completa está y qué
 * campos valdría la pena rellenar. Cuenta los campos "de identidad/membresía"
 * que tienen valor sobre el total considerado.
 */
export function porcentajeCompletadoMembresia(d: DatosMembresiaNuevos): number {
  const campos = [
    d.primerNombre, d.primerApellido, d.sexo, d.fechaNacimiento,
    d.telefonoNumero, d.direccion, d.ci, d.correo,
    d.estadoCivil, d.ocupacion, d.gradoInstruccion, d.discipuladoNivel,
    d.motivoLlegadaId, d.casaDePazId, d.invitadorNombre,
  ];
  const llenos = campos.filter((c) => (c ?? '').toString().trim() !== '').length;
  return Math.round((llenos / campos.length) * 100);
}
