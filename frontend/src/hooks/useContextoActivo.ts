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
    if (!roles) return undefined;
    return construirContextosDisponibles({ esSuperAdmin, iglesia, roles });
  }, [esSuperAdmin, iglesia, iglesiaActivaId, roles]);

  const contextoValido = contextosDisponibles
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

