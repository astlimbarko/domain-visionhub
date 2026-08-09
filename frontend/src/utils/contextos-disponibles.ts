import type { IglesiaAccesible } from '@/types/auth.types';
import type { ContextoActivo } from '@/types/contexto-activo.types';
import type { MisRolesDashboard, Vista } from '@/types/dashboard.types';
import { ROUTES } from '@/utils/constants';

interface FuentesContextos {
  esSuperAdmin: boolean;
  iglesia: IglesiaAccesible | null;
  roles: MisRolesDashboard;
}

export function construirContextosDisponibles({
  esSuperAdmin,
  iglesia,
  roles,
}: FuentesContextos): ContextoActivo[] {
  const contextos: ContextoActivo[] = [];

  if (esSuperAdmin) {
    contextos.push({ clave: 'SUPER_ADMIN', rolUI: 'SUPER_ADMIN', alcance: 'GLOBAL' });
  }

  if (!iglesia) return contextos;

  if (iglesia.es_pastor) {
    contextos.push({
      clave: `PASTOR:${iglesia.id}`,
      rolUI: 'PASTOR',
      alcance: 'IGLESIA',
      iglesiaId: iglesia.id,
    });
  }

  if (iglesia.es_operativo) {
    contextos.push({
      clave: `SUPERVISOR:${iglesia.id}`,
      rolUI: 'SUPERVISOR',
      alcance: 'IGLESIA',
      iglesiaId: iglesia.id,
    });
  }

  for (const red of roles.redes_lider ?? []) {
    const cargoRed = red.es_sublider ? 'SUPERVISOR' : 'LIDER';
    contextos.push({
      clave: `${cargoRed === 'SUPERVISOR' ? 'SUPERVISOR_RED' : 'LIDER_RED'}:${iglesia.id}:${red.id}`,
      rolUI: 'LIDER_RED',
      alcance: 'RED',
      iglesiaId: iglesia.id,
      redId: red.id,
      cargoRed,
    });
  }

  for (const cdp of roles.cdp_lider ?? []) {
    contextos.push({
      clave: `LIDER_CDP:${iglesia.id}:${cdp.id}`,
      rolUI: 'LIDER_CDP',
      alcance: 'CDP',
      iglesiaId: iglesia.id,
      redId: cdp.red_id,
      cdpId: cdp.id,
    });
  }

  for (const cdp of roles.cdp_sublider ?? []) {
    contextos.push({
      clave: `SUBLIDER_CDP:${iglesia.id}:${cdp.id}`,
      rolUI: 'SUBLIDER_CDP',
      alcance: 'CDP',
      iglesiaId: iglesia.id,
      redId: cdp.red_id,
      cdpId: cdp.id,
    });
  }

  if (iglesia.es_lider_afirmacion) {
    contextos.push({
      clave: `LIDER_DEPARTAMENTO:${iglesia.id}:AFIRMACION`,
      rolUI: 'LIDER_DEPARTAMENTO',
      alcance: 'DEPARTAMENTO',
      iglesiaId: iglesia.id,
      departamentoId: null,
      departamentoCodigo: 'AFIRMACION',
    });
  }

  if (iglesia.es_lider_jovenes) {
    contextos.push({
      clave: `LIDER_JOVENES:${iglesia.id}`,
      rolUI: 'LIDER_JOVENES',
      alcance: 'IGLESIA',
      iglesiaId: iglesia.id,
    });
  }

  if (iglesia.es_encargado_matrimonios) {
    contextos.push({
      clave: `ENCARGADO_MATRIMONIOS:${iglesia.id}`,
      rolUI: 'ENCARGADO_MATRIMONIOS',
      alcance: 'IGLESIA',
      iglesiaId: iglesia.id,
    });
  }

  return contextos;
}

export function encontrarContextoValido(
  contexto: ContextoActivo | null,
  disponibles: ContextoActivo[],
): ContextoActivo | null {
  if (!contexto) return null;
  return disponibles.find(
    (disponible) =>
      disponible.clave === contexto.clave &&
      disponible.rolUI === contexto.rolUI &&
      disponible.alcance === contexto.alcance,
  ) ?? null;
}

export function rutaInicialParaContexto(contexto: ContextoActivo): string {
  if (contexto.rolUI === 'SUPER_ADMIN') return ROUTES.ADMINISTRACION;
  if (contexto.rolUI === 'SUBLIDER_CDP') return ROUTES.CASAS_DE_PAZ;
  if (contexto.rolUI === 'LIDER_DEPARTAMENTO') return ROUTES.AFIRMACION;
  if (contexto.rolUI === 'LIDER_JOVENES') return ROUTES.JOVENES;
  if (contexto.rolUI === 'ENCARGADO_MATRIMONIOS') return ROUTES.MATRIMONIOS;
  return ROUTES.DASHBOARD;
}

export function vistaInicialParaContexto(contexto: ContextoActivo): Vista | null {
  if (contexto.rolUI === 'PASTOR') return { tipo: 'pastor' };
  if (contexto.rolUI === 'SUPERVISOR') {
    return { tipo: 'supervisor', iglesiaId: contexto.iglesiaId };
  }
  if (contexto.alcance === 'RED') {
    return { tipo: 'red', redId: contexto.redId };
  }
  if (contexto.alcance === 'CDP') {
    return {
      tipo: 'cdp',
      cdpId: contexto.cdpId,
      esSublider: contexto.rolUI === 'SUBLIDER_CDP',
    };
  }
  return null;
}

