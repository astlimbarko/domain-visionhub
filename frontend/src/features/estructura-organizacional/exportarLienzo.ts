import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toPng } from 'html-to-image';
import type { DatosNodoEstructura } from './types';

// KAN-100: descargar el lienzo completo (todos los nodos, no solo lo que
// entra en pantalla) como PNG horizontal, para compartir o imprimir fuera
// del sistema. Sigue la receta oficial de React Flow para exportar a imagen
// (getNodesBounds + getViewportForBounds sobre `.react-flow__viewport`) --
// ver https://reactflow.dev/examples/misc/download-image.
const ANCHO_EXPORTACION = 1600;
const ALTO_EXPORTACION = 1000; // proporcion horizontal fija, sin importar cuantas Redes/CdP tenga la iglesia.
const MARGEN = 0.08;
const COLOR_FONDO = '#e3e7ee'; // mismo fondo que el lienzo en pantalla.

function nombreArchivoSeguro(nombreIglesia: string): string {
  const normalizado = nombreIglesia
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const fecha = new Date().toISOString().slice(0, 10);
  return `estructura-organizacional-${normalizado || 'iglesia'}-${fecha}`;
}

/**
 * Descarga el lienzo de Estructura Organizacional como PNG horizontal.
 * `contenedor` es cualquier elemento ancestro de `.react-flow__viewport`
 * (alcanza con el div que envuelve al <ReactFlow>).
 */
export async function descargarLienzoComoPng(
  contenedor: HTMLElement,
  nodes: Node<DatosNodoEstructura>[],
  nombreIglesia: string,
): Promise<void> {
  if (nodes.length === 0) {
    throw new Error('No hay nada para descargar todavía');
  }
  const viewportEl = contenedor.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl) {
    throw new Error('No se pudo preparar el lienzo para descargar');
  }

  const bounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(bounds, ANCHO_EXPORTACION, ALTO_EXPORTACION, 0.1, 2, MARGEN);

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: COLOR_FONDO,
    width: ANCHO_EXPORTACION,
    height: ALTO_EXPORTACION,
    pixelRatio: 2,
    filter: (nodo) => {
      // Excluye la minimapa (si esta visible) y controles propios de
      // React Flow -- solo interesan las tarjetas/lineas del organigrama.
      const clase = nodo instanceof Element ? nodo.className : '';
      const texto = typeof clase === 'string' ? clase : '';
      return !texto.includes('react-flow__minimap') && !texto.includes('react-flow__controls');
    },
    style: {
      width: `${ANCHO_EXPORTACION}px`,
      height: `${ALTO_EXPORTACION}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });

  const enlace = document.createElement('a');
  enlace.setAttribute('download', `${nombreArchivoSeguro(nombreIglesia)}.png`);
  enlace.setAttribute('href', dataUrl);
  enlace.click();
}
