// KAN-488 (harness/21): datos de la "Membresía desde 0" (para gente nueva
// captada, distinta de la membresía por link). Extiende los campos básicos
// de persona (reusa DatosBasicosPersonaValores para poder pasarlos tal cual a
// DatosBasicosPersonaFields) y agrega los campos del inventario del spec +
// la opción "Asignar" de CdP (harness/23).
import {
  DATOS_BASICOS_PERSONA_VACIO,
  type DatosBasicosPersonaValores,
} from '@/components/personas/DatosBasicosPersonaFields';

export interface DatosMembresiaNuevos extends DatosBasicosPersonaValores {
  // harness/21 Req 1: si está seteado, es una persona EXISTENTE que se está
  // completando (no se crea una nueva; se actualiza). '' = persona nueva.
  personaExistenteId: string;
  ci: string;
  correo: string;
  estadoCivil: string;
  ocupacion: string;
  gradoInstruccion: string;
  // Proceso / evangelismo
  esVisita: boolean; // NC/RE es automático (persona nueva -> NC); solo se marca si es visita/simpatizante
  // Bautismo, categoría de evangelismo, horario de contacto y familia se
  // quitaron del form por decisión del owner (2026-10-01): el bautismo vive
  // solo en el proceso Bautismo; evangelismo no entra en la membresía desde-0.
  comoLlego: string;
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
}

export const DATOS_MEMBRESIA_NUEVOS_VACIO: DatosMembresiaNuevos = {
  ...DATOS_BASICOS_PERSONA_VACIO,
  personaExistenteId: '',
  ci: '',
  correo: '',
  estadoCivil: '',
  ocupacion: '',
  gradoInstruccion: '',
  esVisita: false,
  comoLlego: '',
  yaAsisteIglesia: false,
  trabajoMinisterio: false,
  ministerioCual: '',
  discipuladoNivel: '',
  invitadorPersonaId: '',
  invitadorNombre: '',
  invitadorEsLibre: false,
  casaDePazId: '',
  casaDePazNombre: '',
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
    d.comoLlego, d.ministerioCual, d.discipuladoNivel,
    d.invitadorNombre, d.casaDePazNombre,
  ];
  if (textos.some((t) => t.trim() !== '')) return true;
  return d.esVisita || d.yaAsisteIglesia || d.trabajoMinisterio;
}

/** Mínimo para poder guardar la membresía real (crear la persona). */
export function membresiaNuevosValida(d: DatosMembresiaNuevos): boolean {
  return d.primerNombre.trim() !== '' && d.primerApellido.trim() !== '' && d.sexo !== '';
}
