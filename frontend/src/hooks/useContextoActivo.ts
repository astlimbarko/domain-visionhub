import { useEffect, useMemo } from 'react';
import { useMisRoles } from '@/hooks/useDashboard';
import { useAuthStore } from '@/store/auth.store';
import type { ContextoActivo } from '@/types/contexto-activo.types';
import {
  construirContextosDisponibles,
  encontrarContextoValido,
} from '@/utils/contextos-disponibles';

export interface EstadoContextoActivo {
  contextoActivo: ContextoActivo | null;
  contextosDisponibles: ContextoActivo[] | undefined;
  cargando: boolean;
}

export function useContextoActivo(): EstadoContextoActivo {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const contextoPersistido = useAuthStore((s) => s.contextoActivo);
  const setContextoActivo = useAuthStore((s) => s.setContextoActivo);
  const iglesia = iglesias.find((item) => item.id === iglesiaActivaId) ?? null;
  const { data: roles, isLoading } = useMisRoles(iglesiaActivaId ?? undefined);

  const contextosDisponibles = useMemo(() => {
    if (!iglesiaActivaId && esSuperAdmin) {
      return construirContextosDisponibles({
        esSuperAdmin,
        iglesia: null,
        roles: { es_operativo: false, redes_lider: null, cdp_lider: null, cdp_sublider: null },
      });
    }
    // Cuenta sin ninguna iglesia asociada (ej. alta nueva por Google, KAN-138,
    // todavía sin invitación a ninguna iglesia): useMisRoles ni siquiera
    // dispara (enabled: !!iglesiaId), así que `roles` queda undefined para
    // siempre y este hook nunca salía del "cargando" (pantalla de carga
    // eterna, reportado 2026-08-09). Sin iglesia no hay nada que resolver.
    if (!iglesiaActivaId && !esSuperAdmin) return [];
    if (!roles) return undefined;
    return construirContextosDisponibles({ esSuperAdmin, iglesia, roles });
  }, [esSuperAdmin, iglesia, iglesiaActivaId, roles]);

  // KAN-339: el contexto SINTÉTICO de "Visualizar" (Super Admin en modo
  // lectura de un Departamento) nunca va a aparecer en contextosDisponibles
  // -- ese array sale de los roles REALES de la persona
  // (construirContextosDisponibles), y el Super Admin no es de verdad Líder
  // de Departamento. Sin este bypass, el efecto de abajo lo invalida y lo
  // borra apenas se setea (contextoPersistido sin match => setContextoActivo(null)).
  // Gate en esSuperAdmin (viene de la sesión autenticada, no se puede
  // falsear desde el cliente) -- la barrera de seguridad real de todas
  // formas vive en el backend (RPC de escritura sin fn_es_super_admin()).
  const esVisualizacionSuperAdmin =
    esSuperAdmin &&
    contextoPersistido?.rolUI === 'LIDER_DEPARTAMENTO' &&
    contextoPersistido.soloLectura === true;

  const contextoValido = esVisualizacionSuperAdmin
    ? contextoPersistido
    : contextosDisponibles
      ? encontrarContextoValido(contextoPersistido, contextosDisponibles)
      : null;

  useEffect(() => {
    if (!contextosDisponibles) return;

    if (contextoPersistido && !contextoValido) {
      setContextoActivo(null);
      return;
    }

    if (!contextoPersistido && contextosDisponibles.length === 1) {
      setContextoActivo(contextosDisponibles[0]);
    }
  }, [contextoPersistido, contextoValido, contextosDisponibles, setContextoActivo]);

  return {
    contextoActivo: contextoValido ?? (contextosDisponibles?.length === 1 ? contextosDisponibles[0] : null),
    contextosDisponibles,
    cargando: isLoading || contextosDisponibles === undefined,
  };
}

