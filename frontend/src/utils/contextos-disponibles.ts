import type { IglesiaAccesible } from '@/types/auth.types';
import type { ContextoActivo } from '@/types/contexto-activo.types';
import type { MisRolesDashboard } from '@/types/dashboard.types';

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
    contextos.push({
      clave: `LIDER_RED:${iglesia.id}:${red.id}`,
      rolUI: 'LIDER_RED',
      alcance: 'RED',
      iglesiaId: iglesia.id,
      redId: red.id,
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

