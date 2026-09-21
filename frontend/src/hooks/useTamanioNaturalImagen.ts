// VisionHub -- extraido de ImagenAnuncioZoom.tsx (KAN-anuncio-parpadeo,
// 2026-09-21) para que ModalAnuncios.tsx pueda precargar la imagen real
// (no solo la URL firmada) SIN forzar la carga eager de
// react-zoom-pan-pinch -- ese vendor solo se necesita cuando el zoom se
// muestra, y esta desde 2026-09-10 detras de un `lazy()` en
// ImagenAnuncioZoom.tsx. Si este hook siguiera viviendo en ese mismo
// archivo, importarlo desde ModalAnuncios (que esta montado siempre en
// PrivateLayout) hubiera vuelto a meter el vendor en el camino critico.
import { useEffect, useState } from 'react';

export type EstadoImagen =
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
export function useTamanioNatural(src: string | undefined) {
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
