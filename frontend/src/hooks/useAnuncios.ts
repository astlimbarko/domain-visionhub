import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarAnuncio,
  asignarEncargadoAnuncio,
  crearAnuncio,
  eliminarAnuncio,
  eliminarImagenAnuncio,
  listarEncargadosAnuncio,
  obtenerCapacidadAnuncio,
  obtenerMisAnunciosGestion,
  obtenerRolesDisponiblesAnuncio,
  obtenerUrlFirmadaAnuncio,
  publicarAnuncio,
  quitarEncargadoAnuncio,
  subirImagenAnuncio,
  toggleActivoAnuncio,
} from '@/services/anuncio.service';
import type { AlcanceTipoAnuncio, DatosEditarAnuncio, DatosNuevoAnuncio } from '@/types/anuncio.types';

const QUERY_KEY_GESTION = (iglesiaId: string | undefined, redId: string | null | undefined) =>
  ['anuncios', 'gestion', iglesiaId, redId ?? null] as const;

export function useCapacidadAnuncio(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['anuncios', 'capacidad', iglesiaId],
    queryFn: () => obtenerCapacidadAnuncio(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useRolesDisponiblesAnuncio(
  iglesiaId: string | undefined,
  alcanceTipo: AlcanceTipoAnuncio,
  redIds: string[],
  cdpIds: string[]
) {
  const tieneAlcance = alcanceTipo === 'IGLESIA' || (alcanceTipo === 'RED' ? redIds.length > 0 : cdpIds.length > 0);
  return useQuery({
    queryKey: ['anuncios', 'roles-disponibles', iglesiaId, alcanceTipo, redIds, cdpIds],
    queryFn: () => obtenerRolesDisponiblesAnuncio(iglesiaId as string, alcanceTipo, redIds, cdpIds),
    enabled: !!iglesiaId && tieneAlcance,
  });
}

export function useMisAnunciosGestion(iglesiaId: string | undefined, redId?: string | null) {
  return useQuery({
    queryKey: QUERY_KEY_GESTION(iglesiaId, redId),
    queryFn: () => obtenerMisAnunciosGestion(iglesiaId as string, redId ?? null),
    enabled: !!iglesiaId,
  });
}

function useInvalidarGestionAnuncios() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['anuncios', 'gestion'] });
}

export function useSubirImagenAnuncio() {
  return useMutation({
    mutationFn: ({ iglesiaId, archivo }: { iglesiaId: string; archivo: File }) => subirImagenAnuncio(iglesiaId, archivo),
  });
}

export function useCrearAnuncio() {
  const invalidar = useInvalidarGestionAnuncios();
  return useMutation({
    mutationFn: (datos: DatosNuevoAnuncio) => crearAnuncio(datos),
    onSuccess: invalidar,
  });
}

export function useActualizarAnuncio() {
  const invalidar = useInvalidarGestionAnuncios();
  return useMutation({
    mutationFn: (datos: DatosEditarAnuncio) => actualizarAnuncio(datos),
    onSuccess: invalidar,
  });
}

export function useToggleActivoAnuncio() {
  const invalidar = useInvalidarGestionAnuncios();
  return useMutation({
    mutationFn: ({ anuncioId, activo }: { anuncioId: string; activo: boolean }) => toggleActivoAnuncio(anuncioId, activo),
    onSuccess: invalidar,
  });
}

export function useEliminarAnuncio() {
  const invalidar = useInvalidarGestionAnuncios();
  return useMutation({
    // Best-effort: si el borrado del archivo en Storage falla (huerfano), la
    // baja logica del anuncio igual queda hecha -- no se bloquea al usuario
    // por un archivo suelto que no lo perjudica (ver policy de storage select,
    // deja de ser legible una vez que el anuncio no existe/es visible).
    mutationFn: async ({ anuncioId, imagenPath }: { anuncioId: string; imagenPath: string }) => {
      await eliminarAnuncio(anuncioId);
      try {
        await eliminarImagenAnuncio(imagenPath);
      } catch (e) {
        console.warn('No se pudo borrar la imagen del anuncio eliminado', e);
      }
    },
    onSuccess: invalidar,
  });
}

export function useUrlFirmadaAnuncio(imagenPath: string | undefined) {
  return useQuery({
    queryKey: ['anuncios', 'url-firmada', imagenPath],
    queryFn: () => obtenerUrlFirmadaAnuncio(imagenPath as string),
    enabled: !!imagenPath,
    staleTime: 1000 * 60 * 30, // la URL firmada dura 1h; se refresca bastante antes
  });
}

export function usePublicarAnuncio() {
  const invalidar = useInvalidarGestionAnuncios();
  return useMutation({
    mutationFn: ({ anuncioId, fechaPublicacion }: { anuncioId: string; fechaPublicacion?: string | null }) =>
      publicarAnuncio(anuncioId, fechaPublicacion),
    onSuccess: invalidar,
  });
}

export function useEncargadosAnuncio(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['anuncios', 'encargados', iglesiaId],
    queryFn: () => listarEncargadosAnuncio(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

function useInvalidarEncargadosAnuncio() {
  const queryClient = useQueryClient();
  return (iglesiaId: string) => queryClient.invalidateQueries({ queryKey: ['anuncios', 'encargados', iglesiaId] });
}

export function useAsignarEncargadoAnuncio() {
  const invalidar = useInvalidarEncargadosAnuncio();
  return useMutation({
    mutationFn: ({ iglesiaId, personaId, otp }: { iglesiaId: string; personaId: string; otp: string }) =>
      asignarEncargadoAnuncio(iglesiaId, personaId, otp),
    onSuccess: (_data, { iglesiaId }) => invalidar(iglesiaId),
  });
}

export function useQuitarEncargadoAnuncio() {
  const invalidar = useInvalidarEncargadosAnuncio();
  return useMutation({
    mutationFn: ({ iglesiaId, personaId, otp }: { iglesiaId: string; personaId: string; otp: string }) =>
      quitarEncargadoAnuncio(iglesiaId, personaId, otp),
    onSuccess: (_data, { iglesiaId }) => invalidar(iglesiaId),
  });
}
