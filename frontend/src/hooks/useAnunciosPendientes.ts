// VisionHub -- KAN-101 (T5/T6): hook reusable de la cola de anuncios
// pendientes al ingresar a la app. Usado por <ModalAnuncios />
// (src/components/anuncios/ModalAnuncios.tsx), montado en PrivateLayout.tsx.
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cerrarAnuncio, marcarAnuncioMostrado, obtenerAnunciosPendientes } from '@/services/anuncio.service';
import type { AnuncioPendiente } from '@/types/anuncio.types';

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

  // KAN-469: cierre OPTIMISTA. Antes, cerrarAnuncioActual esperaba el
  // round-trip de cerrarAnuncio (marcar CERRADO) y recién ahí invalidaba y
  // avanzaba -- con el botón deshabilitado mientras tanto, se sentía la
  // demora al cerrar. Ahora sacamos el anuncio de la cola en el acto (el
  // modal avanza al siguiente / se cierra sin esperar) y el "marcar cerrado"
  // corre en segundo plano; si falla, se restaura la cola.
  const cerrarMutation = useMutation({
    mutationFn: cerrarAnuncio,
    onMutate: async (anuncioId: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previo = queryClient.getQueryData<AnuncioPendiente[]>(QUERY_KEY);
      queryClient.setQueryData<AnuncioPendiente[]>(QUERY_KEY, (old) =>
        (old ?? []).filter((a) => a.id !== anuncioId),
      );
      return { previo };
    },
    onError: (_err, _id, context) => {
      if (context?.previo) queryClient.setQueryData(QUERY_KEY, context.previo);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
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
