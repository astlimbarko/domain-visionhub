// VisionHub -- KAN-101 (T5/T6): hook reusable de la cola de anuncios
// pendientes al ingresar a la app. Usado por <ModalAnuncios />
// (src/components/anuncios/ModalAnuncios.tsx), montado en PrivateLayout.tsx.
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cerrarAnuncio, marcarAnuncioMostrado, obtenerAnunciosPendientes } from '@/services/anuncio.service';

const QUERY_KEY = ['anuncios', 'pendientes'] as const;

export function useAnunciosPendientes() {
  const queryClient = useQueryClient();

  const { data: pendientes, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: obtenerAnunciosPendientes,
    // No hace falta polling agresivo: la cola se revisa al entrar y cada vez
    // que se cierra un anuncio (invalidacion explicita). 5 min alcanza para
    // agarrar un anuncio nuevo publicado mientras la sesion sigue abierta.
    refetchInterval: 5 * 60_000,
  });

  const anuncioActual = pendientes?.[0] ?? null;

  const marcarMostradoMutation = useMutation({ mutationFn: marcarAnuncioMostrado });

  // Registra "visto" (T7) apenas el anuncio queda al frente de la cola --
  // una sola vez por anuncio, aunque el componente se vuelva a renderizar.
  const ultimoMostradoId = useRef<string | null>(null);
  useEffect(() => {
    if (anuncioActual && ultimoMostradoId.current !== anuncioActual.id) {
      ultimoMostradoId.current = anuncioActual.id;
      marcarMostradoMutation.mutate(anuncioActual.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anuncioActual?.id]);

  const cerrarMutation = useMutation({
    mutationFn: cerrarAnuncio,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    /** El anuncio a mostrar ahora mismo (uno solo a la vez, T5). null si no hay cola. */
    anuncioActual,
    /** Cuantos quedan en la cola contando el actual (T6). */
    cantidadPendientes: pendientes?.length ?? 0,
    cargando: isLoading,
    /** Cerrar (click en X): marca CERRADO y avanza al siguiente de la cola. */
    cerrarAnuncioActual: () => {
      if (anuncioActual) cerrarMutation.mutate(anuncioActual.id);
    },
    cerrando: cerrarMutation.isPending,
  };
}
