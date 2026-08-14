import { useMutation, useQuery } from '@tanstack/react-query';
import {
  completarMembresiaGeneral,
  guardarPasoMembresiaGeneral,
  listarTiposDiscipulado,
  obtenerMiMembresiaIncompleta,
} from '@/services/membresia-extendida.service';

// KAN-123: catálogo global, mismo staleTime largo que useCargos (cambia casi nunca).
export function useTiposDiscipulado() {
  return useQuery({
    queryKey: ['membresia-extendida', 'tipos-discipulado'],
    queryFn: listarTiposDiscipulado,
    staleTime: 1000 * 60 * 60,
  });
}

// KAN-126: expone fn_mi_membresia_incompleta bajo demanda -- el enganche
// principal es construirSesionDesdeAuth (sesion.service.ts), llamado una vez
// por login; este hook queda disponible para un futuro botón "revisar de
// nuevo" u otro punto de re-chequeo sin recargar la página.
export function useMembresiaIncompletaGeneral(habilitado: boolean) {
  return useQuery({
    queryKey: ['membresia-extendida', 'mi-membresia-incompleta'],
    queryFn: () => obtenerMiMembresiaIncompleta(),
    enabled: habilitado,
  });
}

// KAN-126: completar Membresía en el caso general (sin invitación asociada).
export function useCompletarMembresiaGeneral() {
  return useMutation({ mutationFn: completarMembresiaGeneral });
}

// KAN-179: guardado progresivo por página.
export function useGuardarPasoMembresiaGeneral() {
  return useMutation({
    mutationFn: ({ paso, datos }: { paso: number; datos: Record<string, unknown> }) =>
      guardarPasoMembresiaGeneral(paso, datos),
  });
}
