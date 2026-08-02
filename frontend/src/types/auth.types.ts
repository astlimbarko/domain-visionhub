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
  es_pastor: boolean;
  /** Capacidad ortogonal al rol: asignacion vigente en departamento_cargo (LIDER_DEPARTAMENTO, AFIRMACION). */
  es_lider_afirmacion: boolean;
  /** Capacidades ortogonales al rol: cargo Tipo B de nivel IGLESIA (persona_cargo), acceso global de solo lectura. */
  es_lider_jovenes: boolean;
  es_encargado_matrimonios: boolean;
}

export interface SesionUsuario {
  usuarioId: string;
  personaId: string | null;
  nombreCompleto: string | null;
  iglesias: IglesiaAccesible[];
  iglesiaActivaId: string | null;
  esSuperAdmin: boolean;
}
