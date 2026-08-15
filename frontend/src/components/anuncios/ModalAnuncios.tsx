// VisionHub -- KAN-101 (T5/T6): modal de anuncio al ingresar a VisionHub.
// Montado en PrivateLayout.tsx (2026-08-15, KAN-106/107).
//
// No requiere props: resuelve todo (cola, imagen, cierre) via
// useAnunciosPendientes() + useUrlFirmadaAnuncio(). Se auto-oculta (retorna
// null) cuando no hay nada pendiente, asi que es seguro montarlo siempre.
//
// Imagen sin recortar (KAN-109, T8): anuncios.txt SS7 es explicito -- "la
// imagen nunca debe deformarse ni recortarse, siempre debe mostrarse el
// 100% de la imagen", conceptualmente `object-fit: contain`, escalada hasta
// el maximo posible respetando ancho Y alto disponibles (el que se alcance
// primero manda). Antes usaba `object-cover` + aspect-ratio fijo (1/1 o
// 3/4), que SI recortaba cualquier imagen cuya proporcion real no calzara
// exacto con esos valores -- justo lo que este ticket pedia corregir.
import { Dialog as DialogPrimitive } from 'radix-ui';
import { XIcon } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAnunciosPendientes } from '@/hooks/useAnunciosPendientes';
import { useUrlFirmadaAnuncio } from '@/hooks/useAnuncios';

export function ModalAnuncios() {
  const { anuncioActual, cerrarAnuncioActual, cerrando } = useAnunciosPendientes();
  const { data: imagenUrl, isLoading: cargandoImagen } = useUrlFirmadaAnuncio(anuncioActual?.imagen_path);

  if (!anuncioActual) return null;

  const esVertical = anuncioActual.imagen_orientacion === 'VERTICAL';

  return (
    <Dialog open onOpenChange={(open) => !open && cerrarAnuncioActual()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50" />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          onEscapeKeyDown={cerrarAnuncioActual}
          onPointerDownOutside={cerrarAnuncioActual}
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          style={{ maxWidth: esVertical ? '380px' : '480px' }}
        >
          <DialogPrimitive.Title className="sr-only">{anuncioActual.titulo}</DialogPrimitive.Title>

          <div className="overflow-hidden rounded-3xl bg-card shadow-2xl shadow-black/20 ring-1 ring-foreground/10">
            <div
              className="relative flex w-full items-center justify-center bg-muted"
              style={{ maxHeight: 'min(65dvh, 560px)' }}
            >
              {cargandoImagen ? (
                <div className="flex h-48 w-full items-center justify-center">
                  <Spinner className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : imagenUrl ? (
                <img
                  src={imagenUrl}
                  alt={anuncioActual.titulo}
                  className="w-full object-contain"
                  style={{ maxHeight: 'min(65dvh, 560px)' }}
                />
              ) : null}

              <DialogPrimitive.Close asChild>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="absolute top-3 right-3 rounded-full bg-black/40 text-white shadow-md backdrop-blur-sm hover:bg-black/60"
                  onClick={cerrarAnuncioActual}
                  disabled={cerrando}
                  aria-label="Cerrar anuncio"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>

            {anuncioActual.titulo && (
              <div className="p-4">
                <p className="font-heading text-sm font-semibold tracking-tight text-foreground">{anuncioActual.titulo}</p>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
