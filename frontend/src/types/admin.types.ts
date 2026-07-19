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

export interface DashboardSuperAdmin {
  crecimiento: {
    total_personas: number;
    por_mes: { mes: string; nuevas: number }[];
  };
  iglesias: {
    id: string;
    nombre: string;
    ciudad: string;
    activa: boolean;
    iglesia_padre: string | null;
    redes: number;
    cdp: number;
    personas: number;
  }[];
  cuentas: {
    total: number;
    por_rol: { rol: RolSistema; cantidad: number }[];
    sin_persona_vinculada: number;
    nunca_inicio_sesion: number;
  };
  salud_bd: {
    tamano_mb: number;
    tablas_mas_grandes: { tabla: string; mb: number }[];
    rls_cobertura: { con_rls: number; total: number };
    super_admin_con_rol_operativo: number;
  };
}
