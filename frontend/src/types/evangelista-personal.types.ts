import type { Sexo } from '@/types/persona.types';

/** Solo 1+1/Elite -- Semilla queda excluido a propósito (pedido del owner,
 * 2026-09-29): "sobre Semilla no tenemos mucho conocimiento todavía". */
export interface TipoEvangelismoPersonal {
  id: string;
  codigo: 'UNO_A_UNO' | 'ELITE';
  nombre: string;
}

export interface EvangelistaDashboardDatos {
  registrados: number;
  en_seguimiento: number;
  nuevos_convertidos: number;
  racha_dias: number;
  serie_diaria: { dia: number; cantidad: number }[];
}

export interface EvangelistaHistorialItem {
  id: string;
  persona_id: string;
  nombre_completo: string;
  fecha: string;
  fecha_creacion: string;
  tipo_evangelismo_codigo: string | null;
  cantidad_contactos: number;
}

export type MedioSeguimiento = 'WHATSAPP' | 'LLAMADA' | 'VISITA';

export interface SeguimientoItem {
  id: string;
  fecha_hora: string;
  medio: MedioSeguimiento;
  notas: string | null;
}

/** Datos mínimos para que el panel "Crear credencial" (KAN-434) decida qué
 * pasos del flujo mostrar -- ver fn_evangelista_datos_persona. */
export interface DatosPersonaCredencial {
  nombre_completo: string;
  correo: string | null;
  usuario_id: string | null;
  tiene_cdp: boolean;
}

export interface NuevaPersonaEvangelistaPayload {
  /** Si viene de "¿es esta persona?" (ConfirmarPosibleDuplicadoDialog). */
  persona_id?: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  sexo: Sexo;
  fecha_nacimiento?: string;
  telefono?: string;
  domicilio?: string;
  tipo_evangelismo_id: string;
}
