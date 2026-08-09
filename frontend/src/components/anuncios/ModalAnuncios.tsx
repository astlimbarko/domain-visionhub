// VisionHub -- KAN-101 (T5/T6): modal de anuncio al ingresar a VisionHub.
//
// Componente terminado y funcional, pero A PROPOSITO sin montar en ningun
// lado -- el punto de enganche natural es PrivateLayout.tsx, que esta sesion
// tiene prohibido tocar (KAN-129 en curso en paralelo, ver nota en
// useAnunciosPendientes.ts). Quien pueda tocar ese archivo solo necesita:
//
//   import { ModalAnuncios } from '@/components/anuncios/ModalAnuncios';
//   ...
//   <ModalAnuncios />
//
// No requiere props: resuelve todo (cola, imagen, cierre) via
// useAnunciosPendientes() + useUrlFirmadaAnuncio(). Se auto-oculta (retorna
// null) cuando no hay nada pendiente, asi que es seguro montarlo siempre.
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
          {anuncioActual.mensaje && (
            <DialogPrimitive.Description className="sr-only">{anuncioActual.mensaje}</DialogPrimitive.Description>
          )}

          <div className="overflow-hidden rounded-3xl bg-card shadow-2xl shadow-black/20 ring-1 ring-foreground/10">
            <div
              className="relative w-full bg-muted"
              style={{ aspectRatio: esVertical ? '3 / 4' : '1 / 1' }}
            >
              {cargandoImagen ? (
                <div className="flex h-full w-full items-center justify-center">
                  <Spinner className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : imagenUrl ? (
                <img
                  src={imagenUrl}
                  alt={anuncioActual.titulo}
                  className="h-full w-full object-cover"
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

            {(anuncioActual.titulo || anuncioActual.mensaje) && (
              <div className="space-y-1 p-4">
                <p className="font-heading text-sm font-semibold tracking-tight text-foreground">{anuncioActual.titulo}</p>
                {anuncioActual.mensaje && <p className="text-[13px] text-muted-foreground">{anuncioActual.mensaje}</p>}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
