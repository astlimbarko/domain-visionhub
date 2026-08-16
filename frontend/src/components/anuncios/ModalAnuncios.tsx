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
// sesion", por delante del formulario de membresia si tambien aplica. Zoom
// (rueda del mouse, pellizco tactil, doble clic/toque) via ImagenAnuncioZoom.
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ImageOff, XIcon } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ImagenAnuncioZoom } from '@/components/anuncios/ImagenAnuncioZoom';
import { useAnunciosPendientes } from '@/hooks/useAnunciosPendientes';
import { useUrlFirmadaAnuncio } from '@/hooks/useAnuncios';

const MAX_ALTO_RATIO = 0.78;
const MAX_ALTO_CAP_PX = 720;

export function ModalAnuncios() {
  const { anuncioActual, cerrarAnuncioActual, cerrando } = useAnunciosPendientes();
  // isError (2026-08-16, pedido explicito del owner: "que no estorbe" si el
  // servidor falla) -- sin esto, si la URL firmada fallaba (Storage caido,
  // etc.) el bloque de abajo caia al `: null` silencioso, dejando la X
  // flotando sin ningun contexto. Nunca bloquea el resto de la app (las 3
  // formas de cerrar -- X, Escape, clic afuera -- funcionan igual), pero
  // sin este aviso se veia como un modal roto en vez de "algo fallo".
  const { data: imagenUrl, isLoading: cargandoImagen, isError: fallaImagen } = useUrlFirmadaAnuncio(anuncioActual?.imagen_path);

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
              ImagenAnuncioZoom mide el tamaño real de la imagen y calcula el
              encaje exacto (mismo motivo que antes: object-contain con
              ancho fijo dejaba el bg-muted como franja blanca a los
              costados), y monta el zoom encima. */}
          {cargandoImagen ? (
            <div className="flex h-48 w-48 items-center justify-center overflow-hidden bg-muted shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/10">
              <Spinner className="h-6 w-6 text-muted-foreground" />
            </div>
          ) : fallaImagen || !imagenUrl ? (
            <div className="flex h-48 w-64 max-w-full flex-col items-center justify-center gap-2 overflow-hidden bg-muted p-6 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/10">
              <ImageOff className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No se pudo cargar la imagen</p>
            </div>
          ) : (
            <ImagenAnuncioZoom
              src={imagenUrl}
              alt={anuncioActual.titulo}
              maxWidthCss={esVertical ? 460 : 580}
              maxHeightRatio={MAX_ALTO_RATIO}
              maxHeightCapPx={MAX_ALTO_CAP_PX}
              className="overflow-hidden bg-muted shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/10"
            />
          )}

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
