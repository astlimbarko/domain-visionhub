// KAN-488 (harness/21): datos de la "Membresía desde 0" (para gente nueva
// captada, distinta de la membresía por link). Extiende los campos básicos
// de persona (reusa DatosBasicosPersonaValores para poder pasarlos tal cual a
// DatosBasicosPersonaFields) y agrega los campos del inventario del spec +
// la opción "Asignar" de CdP (harness/23).
import {
  DATOS_BASICOS_PERSONA_VACIO,
  type DatosBasicosPersonaValores,
} from '@/components/personas/DatosBasicosPersonaFields';

export type EsBautizado = '' | 'NO' | 'CATOLICA' | 'EVANGELICA' | 'CENTRO_VIDA';

export interface DatosMembresiaNuevos extends DatosBasicosPersonaValores {
  ci: string;
  correo: string;
  estadoCivil: string;
  ocupacion: string;
  gradoInstruccion: string;
  horarioContacto: string;
  // Familia (cónyuge e hijos) -- v1 en texto simple
  conyugeNombre: string;
  hijos: string;
  // Proceso / evangelismo
  esVisita: boolean; // NC/RE es automático (persona nueva -> NC); solo se marca si es visita/simpatizante
  esBautizado: EsBautizado;
  bautismoIglesiaNombre: string; // "cuál iglesia" cuando el bautismo fue externo
  categoriaEvangelismo: string; // catálogo tipo_evangelismo (1+1 / CDP / Elite)
  comoLlego: string;
  // Preguntas livianas sobre vínculo con la iglesia
  yaAsisteIglesia: boolean;
  trabajoMinisterio: boolean;
  ministerioCual: string;
  enDiscipulado: boolean;
  // CdP / afinidad (harness/23): quién lo invitó (deriva su CdP) o "Asignar"
  // (sin afinidad -> queda pendiente de asignación por el líder de Afirmación).
  invitadorNombre: string;
  asignar: boolean;
}

export const DATOS_MEMBRESIA_NUEVOS_VACIO: DatosMembresiaNuevos = {
  ...DATOS_BASICOS_PERSONA_VACIO,
  ci: '',
  correo: '',
  estadoCivil: '',
  ocupacion: '',
  gradoInstruccion: '',
  horarioContacto: '',
  conyugeNombre: '',
  hijos: '',
  esVisita: false,
  esBautizado: '',
  bautismoIglesiaNombre: '',
  categoriaEvangelismo: '',
  comoLlego: '',
  yaAsisteIglesia: false,
  trabajoMinisterio: false,
  ministerioCual: '',
  enDiscipulado: false,
  invitadorNombre: '',
  asignar: false,
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
    d.ci, d.correo, d.estadoCivil, d.ocupacion, d.gradoInstruccion, d.horarioContacto,
    d.conyugeNombre, d.hijos, d.esBautizado, d.bautismoIglesiaNombre,
    d.categoriaEvangelismo, d.comoLlego, d.ministerioCual, d.invitadorNombre,
  ];
  if (textos.some((t) => t.trim() !== '')) return true;
  return d.esVisita || d.yaAsisteIglesia || d.trabajoMinisterio || d.enDiscipulado || d.asignar;
}

/** Mínimo para poder guardar la membresía real (crear la persona). */
export function membresiaNuevosValida(d: DatosMembresiaNuevos): boolean {
  return d.primerNombre.trim() !== '' && d.primerApellido.trim() !== '' && d.sexo !== '';
}
