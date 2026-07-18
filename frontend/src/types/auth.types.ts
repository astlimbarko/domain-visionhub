// Espejo de rol_sistema_enum (harness/11-esquema-bd/sql/01_enums.sql).
export type RolSistema =
  | 'SUPER_ADMIN'
  | 'PASTOR'
  | 'SUPERVISOR_VISION_ACCION'
  | 'LIDER_RED'
  | 'LIDER_CDP'
  | 'SUBLIDER_CDP';

export interface IglesiaAccesible {
  id: string;
  nombre: string;
  ciudad: string;
  es_operativo: boolean;
}

export interface SesionUsuario {
  usuarioId: string;
  personaId: string | null;
  nombreCompleto: string | null;
  iglesias: IglesiaAccesible[];
  iglesiaActivaId: string | null;
  esSuperAdmin: boolean;
}
