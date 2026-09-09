/**
 * Compresor reusable de imágenes (KAN-207) -- Web API pura, sin dependencias
 * nuevas. Mismo criterio de salida (JPG, calidad configurable, default 80%)
 * para los 2 casos reales del proyecto, cada uno con su propio modo porque
 * no son la misma operación:
 *
 * - `comprimirImagenExacta` -- recorta+escala a un ancho/alto EXACTO
 *   ("cover", nunca distorsiona). Para avatares 1:1 (KAN-209), donde la
 *   entrada ya viene recortada por el usuario y el destino es siempre
 *   cuadrado 250x250.
 * - `comprimirImagenProporcional` -- achica manteniendo la proporción
 *   original, sin recortar nada, hasta que la ALTURA mida como máximo
 *   `altoMaximo` (el ancho se ajusta solo). Para anuncios, que pueden ser
 *   cuadrados O verticales pero nunca horizontales (rechazados antes de
 *   comprimir) -- un recorte "cover" a un tamaño fijo rompería el caso
 *   vertical.
 *
 * Ambas comparten la decodificación y el dibujado en `<canvas>`, la única
 * diferencia real es cómo se calculan ancho/alto/offset de destino.
 */
const CALIDAD_DEFAULT = 0.8;

/** `createImageBitmap` no soporta SVG y algún navegador viejo -- si falla,
 * cae a `<img>` + `URL.createObjectURL`, igual de válido para decodificar. */
async function decodificarImagen(archivo: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(archivo);
  } catch {
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
        img.src = url;
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function dimensionesDe(imagen: ImageBitmap | HTMLImageElement): { ancho: number; alto: number } {
  // No discriminar por 'width' in imagen -- HTMLImageElement tambien tiene
  // `width` (el de presentacion CSS, no el intrinseco), asi que ese chequeo
  // nunca distingue nada. `naturalWidth` es exclusivo de HTMLImageElement.
  return imagen instanceof HTMLImageElement
    ? { ancho: imagen.naturalWidth, alto: imagen.naturalHeight }
    : { ancho: imagen.width, alto: imagen.height };
}

async function dibujarYComprimir(
  imagen: ImageBitmap | HTMLImageElement,
  anchoDestino: number,
  altoDestino: number,
  dibujar: (ctx: CanvasRenderingContext2D) => void,
  calidad: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = anchoDestino;
  canvas.height = altoDestino;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');
  dibujar(ctx);
  if ('close' in imagen) imagen.close();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el JPG comprimido'))),
      'image/jpeg',
      calidad
    );
  });
}

export interface OpcionesCompresionExacta {
  ancho: number;
  alto: number;
  /** 0-1, default 0.8 (KAN-207/209: "JPG calidad 80%"). */
  calidad?: number;
}

/** Recorta+escala "cover" a un tamaño exacto -- nunca distorsiona el
 * aspecto, recorta el excedente centrado. Pensada para avatares 1:1. */
export async function comprimirImagenExacta(archivo: File | Blob, opciones: OpcionesCompresionExacta): Promise<Blob> {
  const { ancho, alto, calidad = CALIDAD_DEFAULT } = opciones;
  const imagen = await decodificarImagen(archivo);
  const { ancho: anchoOrigen, alto: altoOrigen } = dimensionesDe(imagen);

  const escala = Math.max(ancho / anchoOrigen, alto / altoOrigen);
  const anchoEscalado = anchoOrigen * escala;
  const altoEscalado = altoOrigen * escala;
  const offsetX = (ancho - anchoEscalado) / 2;
  const offsetY = (alto - altoEscalado) / 2;

  return dibujarYComprimir(imagen, ancho, alto, (ctx) => ctx.drawImage(imagen, offsetX, offsetY, anchoEscalado, altoEscalado), calidad);
}

export interface OpcionesCompresionProporcional {
  /** Tope de ALTURA -- el ancho se ajusta solo, en la misma proporción, para
   * no deformar nunca. Si la imagen ya es más chica, no se agranda. Válido
   * porque quien llama a esta función (anuncios) ya rechazó lo horizontal
   * antes de comprimir (ver detectarOrientacionImagen) -- la altura siempre
   * es el lado que hay que acotar. */
  altoMaximo: number;
  calidad?: number;
}

/** Achica manteniendo la proporción original (cuadrada o vertical), sin
 * recortar nada. Pensada para anuncios. */
export async function comprimirImagenProporcional(archivo: File | Blob, opciones: OpcionesCompresionProporcional): Promise<Blob> {
  const { altoMaximo, calidad = CALIDAD_DEFAULT } = opciones;
  const imagen = await decodificarImagen(archivo);
  const { ancho: anchoOrigen, alto: altoOrigen } = dimensionesDe(imagen);

  const escala = Math.min(1, altoMaximo / altoOrigen);
  const anchoDestino = Math.round(anchoOrigen * escala);
  const altoDestino = Math.round(altoOrigen * escala);

  return dibujarYComprimir(imagen, anchoDestino, altoDestino, (ctx) => ctx.drawImage(imagen, 0, 0, anchoDestino, altoDestino), calidad);
}
