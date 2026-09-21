import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  editarPersonaAfirmacion,
  extenderColaboradorSesion,
  finalizarColaboradorSesion,
  generarCodigoColaborador,
  listarColaboradores,
  obtenerAuditoriaColaborador,
  obtenerMiColaboracionActiva,
  obtenerMiHistorialColaborador,
  obtenerPersonaEditarAfirmacion,
  pausarColaboradorSesion,
  reanudarColaboradorSesion,
  redimirCodigoColaborador,
  revocarCodigoColaborador,
} from '@/services/colaborador.service';
import type { DatosPersonaAfirmacion } from '@/types/afirmacion.types';

// ─── Vista del propio Colaborador ──────────────────────────────────────────

/** KAN-405: refetch corto -- necesita detectar rápido si el líder lo pausó/
 * finalizó desde su propio panel, sin que el Colaborador tenga que
 * recargar la página a mano. */
export function useMiColaboracionActiva() {
  return useQuery({
    queryKey: ['colaborador', 'mi-colaboracion-activa'],
    queryFn: obtenerMiColaboracionActiva,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
}

export function useRedimirCodigoColaborador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => redimirCodigoColaborador(codigo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador', 'mi-colaboracion-activa'] });
    },
  });
}

export function useMiHistorialColaborador(activo: boolean) {
  return useQuery({
    queryKey: ['colaborador', 'mi-historial'],
    queryFn: obtenerMiHistorialColaborador,
    enabled: activo,
  });
}

// KAN-405 seguimiento: editar una persona ya cargada, desde el propio
// historial del Colaborador/Líder.
export function useObtenerPersonaEditarAfirmacion(personaId: string | undefined) {
  return useQuery({
    queryKey: ['colaborador', 'editar-persona', personaId],
    queryFn: () => obtenerPersonaEditarAfirmacion(personaId as string),
    enabled: !!personaId,
  });
}

export function useEditarPersonaAfirmacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, datos }: { personaId: string; datos: DatosPersonaAfirmacion }) =>
      editarPersonaAfirmacion(personaId, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador', 'mi-historial'] });
    },
  });
}

// ─── Panel de gestión del líder ─────────────────────────────────────────────

export function useColaboradores(iglesiaId: string | undefined, departamentoCodigo: string) {
  return useQuery({
    queryKey: ['colaborador', 'listado', iglesiaId, departamentoCodigo],
    queryFn: () => listarColaboradores(iglesiaId as string, departamentoCodigo),
    enabled: !!iglesiaId,
    refetchInterval: 30_000,
  });
}

function useInvalidarColaboradores(iglesiaId: string | undefined, departamentoCodigo: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['colaborador', 'listado', iglesiaId, departamentoCodigo] });
}

export function useGenerarCodigoColaborador(iglesiaId: string | undefined, departamentoCodigo: string) {
  const invalidar = useInvalidarColaboradores(iglesiaId, departamentoCodigo);
  return useMutation({
    mutationFn: (duracionMinutos: number) => generarCodigoColaborador(iglesiaId as string, departamentoCodigo, duracionMinutos),
    onSuccess: invalidar,
  });
}

export function useRevocarCodigoColaborador(iglesiaId: string | undefined, departamentoCodigo: string) {
  const invalidar = useInvalidarColaboradores(iglesiaId, departamentoCodigo);
  return useMutation({
    mutationFn: (codigoId: string) => revocarCodigoColaborador(codigoId),
    onSuccess: invalidar,
  });
}

export function useAuditoriaColaborador(sesionId: string | undefined) {
  return useQuery({
    queryKey: ['colaborador', 'auditoria', sesionId],
    queryFn: () => obtenerAuditoriaColaborador(sesionId as string),
    enabled: !!sesionId,
  });
}

export function useExtenderColaboradorSesion(iglesiaId: string | undefined, departamentoCodigo: string) {
  const invalidar = useInvalidarColaboradores(iglesiaId, departamentoCodigo);
  return useMutation({
    mutationFn: ({ sesionId, minutos }: { sesionId: string; minutos: number }) => extenderColaboradorSesion(sesionId, minutos),
    onSuccess: invalidar,
  });
}

export function usePausarColaboradorSesion(iglesiaId: string | undefined, departamentoCodigo: string) {
  const invalidar = useInvalidarColaboradores(iglesiaId, departamentoCodigo);
  return useMutation({
    mutationFn: (sesionId: string) => pausarColaboradorSesion(sesionId),
    onSuccess: invalidar,
  });
}

export function useReanudarColaboradorSesion(iglesiaId: string | undefined, departamentoCodigo: string) {
  const invalidar = useInvalidarColaboradores(iglesiaId, departamentoCodigo);
  return useMutation({
    mutationFn: (sesionId: string) => reanudarColaboradorSesion(sesionId),
    onSuccess: invalidar,
  });
}

export function useFinalizarColaboradorSesion(iglesiaId: string | undefined, departamentoCodigo: string) {
  const invalidar = useInvalidarColaboradores(iglesiaId, departamentoCodigo);
  return useMutation({
    mutationFn: (sesionId: string) => finalizarColaboradorSesion(sesionId),
    onSuccess: invalidar,
  });
}
