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

export interface InvitacionPendiente {
  id: string;
  rol: RolInvitable;
  iglesia_nombre: string;
  destino: string;
  campos_obligatorios: {
    ci: boolean;
    fecha_nacimiento: boolean;
    ocupacion: boolean;
    grado_instruccion: boolean;
  };
}
