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

type EstadoImagen =
  | { status: 'cargando' }
  | { status: 'error' }
  | { status: 'listo'; width: number; height: number };

/** Si el servidor/archivo falla algun dia (imagen borrada, Storage caido,
 * red del usuario), `img.onload` nunca dispara -- sin `onerror` el visor se
 * quedaba con el spinner girando para siempre, sin avisar nada (hallazgo
 * real del owner 2026-08-16). Con el estado "error" explicito, el llamador
 * muestra un aviso corto en vez de una espera infinita -- nunca bloquea el
 * resto de la app (el boton de cerrar del modal es independiente de esto,
 * siempre queda disponible), solo evita la confusion de un spinner sin fin. */
function useTamanioNatural(src: string | undefined) {
  const [estado, setEstado] = useState<EstadoImagen>({ status: 'cargando' });

  useEffect(() => {
    setEstado({ status: 'cargando' });
    if (!src) return;
    let vigente = true;
    const img = new Image();
    img.onload = () => {
      if (vigente) setEstado({ status: 'listo', width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      if (vigente) setEstado({ status: 'error' });
    };
    img.src = src;
    return () => {
      vigente = false;
    };
  }, [src]);

  return estado;
}

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
}: {
  src: string;
  alt: string;
  maxWidthCss: number;
  maxHeightRatio: number;
  maxHeightCapPx: number;
  className?: string;
}) {
  const { maxWidth, maxHeight } = useLimitesImagen(maxWidthCss, maxHeightRatio, maxHeightCapPx);
  const estado = useTamanioNatural(src);

  if (estado.status === 'cargando') {
    return (
      <div className={cn('flex h-48 w-48 items-center justify-center', className)}>
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
