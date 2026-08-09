import { useQuery } from '@tanstack/react-query';
import { listarTiposDiscipulado, obtenerMiMembresiaIncompleta } from '@/services/membresia-extendida.service';

// KAN-123: catálogo global, mismo staleTime largo que useCargos (cambia casi nunca).
export function useTiposDiscipulado() {
  return useQuery({
    queryKey: ['membresia-extendida', 'tipos-discipulado'],
    queryFn: listarTiposDiscipulado,
    staleTime: 1000 * 60 * 60,
  });
}

// KAN-126: expone fn_mi_membresia_incompleta (capa de datos). Deliberadamente
// NO se usa todavía desde PrivateLayout.tsx/auth.store.ts -- ambos archivos
// están fuera de alcance en esta sesión (refactor paralelo de sesión/roles,
// KAN-129). Queda disponible para conectar en cuanto ese refactor mergee.
export function useMembresiaIncompletaGeneral(habilitado: boolean) {
  return useQuery({
    queryKey: ['membresia-extendida', 'mi-membresia-incompleta'],
    queryFn: obtenerMiMembresiaIncompleta,
    enabled: habilitado,
  });
}
