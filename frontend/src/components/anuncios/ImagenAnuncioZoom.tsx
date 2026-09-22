// VisionHub -- KAN-101: imagen de anuncio con zoom (rueda del mouse, pellizco
// en tablet/celular, doble clic/toque para alternar). Compartido entre
// ModalAnuncios y la vista ampliada de gestion (Anuncios.tsx) -- pedido
// explicito del owner 2026-08-16.
//
// react-zoom-pan-pinch necesita un visor de tamaño fijo en px (no puede
// "encajar solo" como el <img> con object-contain que usabamos antes) -- por
// eso este componente mide el tamaño natural real de la imagen y calcula el
// encaje (mismo criterio que object-contain: nunca agranda mas alla del
// tamaño real, solo encoge si hace falta) para darle al visor exactamente
// ese ancho/alto. Asi el marco queda ajustado a la imagen sin bordes (mismo
// objetivo del fix anterior a esto), con el zoom montado encima.
import { useEffect, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useTamanioNatural, type EstadoImagen } from '@/hooks/useTamanioNaturalImagen';

/** Limites disponibles para la imagen, en px reales -- replica en JS los
 * mismos limites que ya expresa el CSS del modal contenedor (ancho maximo +
 * margen del viewport, alto maximo con su tope en px), recalculados al
 * rotar/cambiar de tamaño la ventana. Si cambia el CSS del modal, estos
 * numeros tienen que seguir esa misma logica. */
function useLimitesImagen(maxWidthCss: number, maxHeightRatio: number, maxHeightCapPx: number) {
  const calcular = () => ({
    maxWidth: Math.min(maxWidthCss, window.innerWidth - 32),
    maxHeight: Math.min(window.innerHeight * maxHeightRatio, maxHeightCapPx),
  });
  const [limites, setLimites] = useState(calcular);

  useEffect(() => {
    const onResize = () => setLimites(calcular());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxWidthCss, maxHeightRatio, maxHeightCapPx]);

  return limites;
}

export function ImagenAnuncioZoom({
  src,
  alt,
  maxWidthCss,
  maxHeightRatio,
  maxHeightCapPx,
  className,
  estadoPrecargado,
}: {
  src: string;
  alt: string;
  maxWidthCss: number;
  maxHeightRatio: number;
  maxHeightCapPx: number;
  className?: string;
  /** Cuando el llamador ya precargo la imagen (ej. ModalAnuncios, para
   * gatear el momento en que se muestra el fondo oscuro -- ver KAN-anuncio-
   * parpadeo 2026-09-21) pasa aca el resultado ya resuelto en vez de que
   * este componente vuelva a hacer su propio `new Image()` sobre el mismo
   * `src` (misma URL -- el navegador lo serviria de cache, pero es
   * innecesario repetirlo). Si no se pasa, el componente calcula el tamaño
   * el solo (comportamiento original, usado por Anuncios.tsx). */
  estadoPrecargado?: EstadoImagen;
}) {
  const { maxWidth, maxHeight } = useLimitesImagen(maxWidthCss, maxHeightRatio, maxHeightCapPx);
  const estadoCalculado = useTamanioNatural(estadoPrecargado ? undefined : src);
  const estado = estadoPrecargado ?? estadoCalculado;

  if (estado.status === 'cargando') {
    // KAN-402: sin bg-muted/sombra/ring acá a propósito -- ModalAnuncios
    // pasa esas clases pensadas para la imagen ya cargada; heredarlas acá
    // dejaba ver un cuadro gris sólido saltando antes del difuminado real.
    return (
      <div className="flex h-48 w-48 items-center justify-center">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  if (estado.status === 'error') {
    return (
      <div className={cn('flex h-48 w-64 max-w-full flex-col items-center justify-center gap-2 p-6 text-center', className)}>
        <ImageOff className="h-6 w-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">No se pudo cargar la imagen</p>
      </div>
    );
  }

  const escala = Math.min(maxWidth / estado.width, maxHeight / estado.height, 1);
  const width = Math.round(estado.width * escala);
  const height = Math.round(estado.height * escala);

  return (
    <div className={className} style={{ width, height }}>
      <TransformWrapper
        key={`${src}-${width}x${height}`}
        initialScale={1}
        minScale={1}
        maxScale={5}
        centerOnInit
        limitToBounds
        doubleClick={{ mode: 'toggle', step: 2 }}
        wheel={{ step: 0.25 }}
      >
        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
