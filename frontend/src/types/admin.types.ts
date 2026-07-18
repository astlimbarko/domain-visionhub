import type { RolSistema } from './auth.types';

export interface UsuarioListado {
  usuario_rol_id: string;
  usuario_id: string;
  correo: string;
  rol: RolSistema;
  iglesia_id: string | null;
  iglesia_nombre: string | null;
  persona_id: string | null;
  persona_nombre: string | null;
}

export interface IglesiaAdmin {
  id: string;
  nombre: string;
  ciudad: string;
  activo: boolean;
}

export interface ResultadoInvitacion {
  id: string;
  correo: string;
}
