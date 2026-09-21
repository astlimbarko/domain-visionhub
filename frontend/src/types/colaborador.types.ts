// KAN-405: Colaboradores temporales por código (Afirmación).
// Tipos genéricos por departamento_codigo -- este ticket solo construye el
// caso 'AFIRMACION' pero el modelo de datos no está atado a esa área.

export type ColaboradorEstado = 'ACTIVO' | 'PAUSADO' | 'FINALIZADO';

/** Igual que ColaboradorEstado, pero con 'VENCIDO' calculado en el backend
 * (fecha_fin <= now() sin que el estado real haya cambiado). Solo lo usa
 * el panel del líder (fn_listar_colaboradores) -- fn_mi_colaboracion_activa
 * nunca devuelve una fila vencida (queda directamente afuera). */
export type ColaboradorEstadoCalculado = 'ACTIVO' | 'PAUSADO' | 'VENCIDO' | 'FINALIZADO';

export interface ColaboradorCodigoGenerado {
  id: string;
  iglesia_id: string;
  departamento_codigo: string;
  codigo: string;
  duracion_minutos: number;
  activo: boolean;
  fecha_creacion: string;
  creado_por: string;
}

export interface MiColaboracionActiva {
  id: string;
  iglesia_id: string;
  iglesia_nombre: string;
  departamento_codigo: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: ColaboradorEstado;
}

export interface ColaboradorHistorialItem {
  persona_id: string;
  nombre_completo: string;
  fecha_creacion: string;
}

export interface ColaboradorListado {
  id: string;
  persona_nombre: string;
  usuario_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: ColaboradorEstado;
  estado_calculado: ColaboradorEstadoCalculado;
  codigo: string;
  personas_cargadas: number;
}

export interface ColaboradorAuditoriaItem {
  persona_id: string;
  nombre_completo: string;
  fecha_creacion: string;
  accion: 'ALTA' | 'MODIFICACION';
}

/** KAN-405 seguimiento: shape que devuelve fn_obtener_persona_editar_afirmacion
 * -- mismos campos que DatosPersonaAfirmacion (types/afirmacion.types.ts) +
 * DatosMembresiaExtendida, para precargar RegistrarPersonaAfirmacion en modo
 * edición sin duplicar el tipo entero. Se tipa como Record laxo a propósito
 * (JSONB del backend) -- el componente hace el mapeo campo por campo. */
export type PersonaEditarAfirmacion = Record<string, unknown> & { persona_id: string };
