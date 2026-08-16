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
//
// Rediseño 2026-08-16 (pedido explicito del owner): mas grande, esquinas
// rectas en vez de redondeadas (para no ocultar detalles cerca del borde),
// sombra/contorno marcado hacia el fondo en vez de una sombra tenue, boton
// de cerrar mas visible/elegante, y z-index por encima de MembresiaObligatoria
// -- ahora se muestra siempre al ingresar, "son anuncios de inicio de
// sesion", por delante del formulario de membresia si tambien aplica.
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
        <DialogOverlay className="z-[60] bg-black/60" />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          onEscapeKeyDown={cerrarAnuncioActual}
          onPointerDownOutside={cerrarAnuncioActual}
          className="fixed top-1/2 left-1/2 z-[60] flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          style={{ maxWidth: esVertical ? '460px' : '580px' }}
        >
          <DialogPrimitive.Title className="sr-only">{anuncioActual.titulo}</DialogPrimitive.Title>

          {/* Sin marco/titulo debajo (pedido explicito 2026-08-16): la
              imagen es el anuncio, se muestra directa sin borde blanco.
              `inline-flex` (no `flex`+w-full) para que el contorno/sombra se
              ajuste al tamaño real ya escalado de la imagen -- con w-full el
              contenedor quedaba con el ancho fijo del modal aunque la
              imagen (acotada por el alto maximo) rindiera mas angosta,
              dejando el bg-muted como franja blanca a los costados. */}
          <div
            className="relative inline-flex max-w-full items-center justify-center overflow-hidden bg-muted shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/10"
            style={{ maxHeight: 'min(78dvh, 720px)' }}
          >
            {cargandoImagen ? (
              <div className="flex h-48 w-48 items-center justify-center">
                <Spinner className="h-6 w-6 text-muted-foreground" />
              </div>
            ) : imagenUrl ? (
              <img
                src={imagenUrl}
                alt={anuncioActual.titulo}
                className="block max-w-full object-contain"
                style={{ maxHeight: 'min(78dvh, 720px)' }}
              />
            ) : null}
          </div>

          {/* X fuera de la imagen, no encima (pedido explicito 2026-08-16). */}
          <DialogPrimitive.Close asChild>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full border border-white/30 bg-black/60 text-white shadow-lg backdrop-blur-sm hover:bg-black/80"
              onClick={cerrarAnuncioActual}
              disabled={cerrando}
              aria-label="Cerrar anuncio"
            >
              <XIcon className="h-5 w-5" />
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
