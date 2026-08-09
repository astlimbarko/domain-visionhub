import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarAnuncio,
  crearAnuncio,
  eliminarAnuncio,
  eliminarImagenAnuncio,
  obtenerCapacidadAnuncio,
  obtenerMisAnunciosGestion,
  obtenerRolesDisponiblesAnuncio,
  obtenerUrlFirmadaAnuncio,
  subirImagenAnuncio,
  toggleActivoAnuncio,
} from '@/services/anuncio.service';
import type { DatosEditarAnuncio, DatosNuevoAnuncio } from '@/types/anuncio.types';

const QUERY_KEY_GESTION = (iglesiaId: string | undefined, redId: string | null | undefined) =>
  ['anuncios', 'gestion', iglesiaId, redId ?? null] as const;

export function useCapacidadAnuncio(iglesiaId: string | undefined) {
  return useQuery({
    queryKey: ['anuncios', 'capacidad', iglesiaId],
    queryFn: () => obtenerCapacidadAnuncio(iglesiaId as string),
    enabled: !!iglesiaId,
  });
}

export function useRolesDisponiblesAnuncio(iglesiaId: string | undefined, redId: string | null) {
  return useQuery({
    queryKey: ['anuncios', 'roles-disponibles', iglesiaId, redId],
    queryFn: () => obtenerRolesDisponiblesAnuncio(iglesiaId as string, redId),
    enabled: !!iglesiaId,
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
