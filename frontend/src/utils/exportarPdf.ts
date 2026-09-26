import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

// KAN-50: exporta a PDF cualquier contenedor de dashboard tal cual se ve en
// pantalla en ese momento. Como los datos que se renderizan ya llegan
// escopeados por rol/RLS (mismo fetch que arma la pantalla), capturar el DOM
// visible alcanza para respetar filtros y permisos sin un mecanismo nuevo --
// no hay que "reconstruir" el reporte del lado del cliente.
//
// Reusa `html-to-image` (ya instalado para KAN-100, exportarLienzo.ts) en vez
// de sumar una libreria de captura nueva; `jspdf` solo empaqueta esa imagen
// en un PDF real y descargable, con el tamaño de página ajustado al contenido
// (evita la complejidad de paginar una tabla/gráfico a lo largo de varias
// hojas A4 para un caso de uso de "descargar lo que estoy viendo").
const MARGEN_PX = 24;

/** Nodos marcados así (o con `display:none`/`visibility:hidden`) no salen en el PDF -- botones de acción propios (como este) y cualquier cosa oculta que igual siga en el DOM. */
function elementoExcluido(nodo: HTMLElement): boolean {
  if (nodo.dataset?.pdfExcluir === 'true') return true;
  const estilo = window.getComputedStyle(nodo);
  return estilo.display === 'none' || estilo.visibility === 'hidden';
}

function nombreArchivoConFecha(prefijo: string): string {
  const normalizado = prefijo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const fecha = new Date().toISOString().slice(0, 10);
  return `${normalizado || 'dashboard'}-${fecha}`;
}

/**
 * Descarga `contenedor` (y todo lo que tenga adentro, ya renderizado con sus
 * filtros aplicados) como un PDF de una sola página, dimensionada al
 * contenido real -- funciona igual en desktop y en móvil porque no depende
 * de un layout de impresión fijo, solo del tamaño que el elemento ya tiene
 * en pantalla.
 */
export async function descargarElementoComoPdf(contenedor: HTMLElement, prefijoArchivo: string): Promise<void> {
  const rect = contenedor.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error('No hay nada para descargar todavía');
  }

  const fondo = window.getComputedStyle(document.body).backgroundColor || '#ffffff';

  // JPEG en vez de PNG (bug real, 2026-09-26): un dashboard completo (KPIs +
  // calendario anual con gradientes/muchos círculos de color) comprime muy
  // mal como PNG -- un solo PDF de una página llegaba a pesar 13 MB con
  // pixelRatio 2, fallando o siendo demasiado pesado en dispositivos móviles.
  // JPEG con calidad alta reduce esto en más de 90% sin pérdida visible de
  // legibilidad (no hay transparencia real que perder -- `backgroundColor`
  // ya rellena el fondo antes de rasterizar).
  const dataUrl = await toJpeg(contenedor, {
    backgroundColor: fondo,
    pixelRatio: 2,
    quality: 0.85,
    filter: (nodo) => !(nodo instanceof HTMLElement && elementoExcluido(nodo)),
  });

  const anchoContenido = rect.width;
  const altoContenido = rect.height;
  const anchoPdf = anchoContenido + MARGEN_PX * 2;
  const altoPdf = altoContenido + MARGEN_PX * 2;

  const pdf = new jsPDF({
    orientation: anchoPdf >= altoPdf ? 'landscape' : 'portrait',
    unit: 'px',
    format: [anchoPdf, altoPdf],
  });

  pdf.addImage(dataUrl, 'JPEG', MARGEN_PX, MARGEN_PX, anchoContenido, altoContenido);
  pdf.save(`${nombreArchivoConFecha(prefijoArchivo)}.pdf`);
}
