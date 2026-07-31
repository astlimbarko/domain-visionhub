export type RolInvitable = 'LIDER_RED' | 'LIDER_CDP' | 'SUBLIDER_CDP';

export interface InvitacionLider {
  id: string;
  correo: string;
  rol: RolInvitable;
  estado: 'PENDIENTE' | 'COMPLETADA';
  red_id: string | null;
  red_nombre: string | null;
  casa_de_paz_id: string | null;
  casa_de_paz_etiqueta: string | null;
  fecha_creacion: string;
  fecha_completada: string | null;
}

/** Invitación a Líder de Departamento (2026-08-01) -- no tiene `rol` (no es
 * un rol_sistema_enum, ver 71_invitar_lider_departamento.sql). */
export interface InvitacionDepartamento {
  id: string;
  correo: string;
  departamento_id: string;
  estado: 'PENDIENTE' | 'COMPLETADA';
  fecha_creacion: string;
}

export interface InvitacionPendiente {
  id: string;
  rol: RolInvitable | null;
  iglesia_nombre: string;
  destino: string;
  departamento_nombre?: string | null;
  campos_obligatorios: {
    ci: boolean;
    fecha_nacimiento: boolean;
    ocupacion: boolean;
    grado_instruccion: boolean;
  };
}
