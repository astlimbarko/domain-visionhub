export type TipoEvento = {
  id: string;
  nombre: string;
  codigo: string;
  color: string;
};

export type EventoAfirmacion = {
  id: string;
  titulo: string;
  tipo_evento_id: string;
  tipo_nombre: string;
  color: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  es_recurrente: boolean;
  activo: boolean;
  /** Procesos que cubre el evento (ALTAR/RSIL/BAUTISMO/MEMBRESIA_NUEVOS).
   * null = evento viejo sin restricción → aparece en todas las puertas. */
  afirmacion_actividades: string[] | null;
  total_personas: number;
  total_rsil: number;
  total_bautismo: number;
  total_membresia: number;
};

// Colaborador del evento: quién cargó gente (nombre + red + cuántos cargó).
export type ColaboradorEvento = {
  persona_id: string;
  nombre_completo: string;
  red_nombre: string | null;
  cantidad: number;
};

// Persona de un bloque dentro del evento (datos principales para la vista
// rápida y el export).
export type PersonaBloqueEvento = {
  registro_id: string;
  persona_id: string;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  telefono: string | null;
  fecha: string | null;
  fecha_creacion: string;
  invitado_por: string | null;
  red_nombre: string | null;
  lider_cdp: string | null;
  /** Iglesia donde se hizo el registro (madre o satélite) — para saber de dónde es. */
  iglesia_origen: string | null;
};

// Actividades que se tildan al crear un evento. "Bautismo + Membresía" va
// agrupado (pedido del owner 2026-10-08): un solo check activa las 2 puertas.
// `procesos` son los proceso_codigo reales que quedan asociados al evento.
export const ACTIVIDADES_EVENTO = [
  { id: 'ALTAR', label: 'Altar', procesos: ['ALTAR'] },
  { id: 'RSIL', label: 'RSIL', procesos: ['RSIL'] },
  { id: 'BAUTISMO_MEMBRESIA', label: 'Bautismo + Membresía', procesos: ['BAUTISMO', 'MEMBRESIA_NUEVOS'] },
] as const;

export type FilaHistorialProcesoConEvento = {
  id: string;
  persona_id: string;
  nombre_completo: string;
  fecha: string | null;
  fecha_creacion: string;
  registrado_por: string | null;
  registrado_por_nombre: string | null;
};

// const object + type (no `enum`): el proyecto compila con erasableSyntaxOnly,
// que prohíbe enums. Permite usarlo como valor (ProcesoAfirmacionCodigo.ALTAR)
// y como tipo (: ProcesoAfirmacionCodigo), igual que un enum.
export const ProcesoAfirmacionCodigo = {
  ALTAR: 'ALTAR',
  BAUTISMO: 'BAUTISMO',
  RSIL: 'RSIL',
  MEMBRESIA_NUEVOS: 'MEMBRESIA_NUEVOS',
} as const;
export type ProcesoAfirmacionCodigo = (typeof ProcesoAfirmacionCodigo)[keyof typeof ProcesoAfirmacionCodigo];
