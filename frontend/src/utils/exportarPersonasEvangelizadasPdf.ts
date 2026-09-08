import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEPARTAMENTO_META } from './departamentos';

/** Mismas 10 columnas y mismo orden que la tabla desktop (KAN-350, pedido
 * explícito del owner, 2026-09-08) -- valores ya formateados por el
 * llamador (`aFilaExportacion` en EvangelismoPersonas.tsx), acá solo se
 * arman en la tabla del PDF. */
export interface FilaPersonaEvangelizadaPdf {
  fecha: string;
  nombre_completo: string;
  sexo: string;
  telefono_principal: string | null;
  tipo_evangelismo_nombre: string | null;
  fecha_nacimiento: string | null;
  edad: number | null;
  evangelizado_por_nombre: string | null;
  red_nombre: string | null;
  casa_de_paz_etiqueta: string;
}

function nombreArchivoConFecha(): string {
  return `departamento-evangelismo-${new Date().toISOString().slice(0, 10)}.pdf`;
}

/** Rasteriza el ícono oficial (SVG, `public/icono-evangelismo.svg`) a PNG en
 * memoria -- jsPDF `addImage` no soporta SVG directo, necesita un formato
 * de bitmap. Si por algún motivo falla (ej. navegador viejo), el PDF sigue
 * generándose sin ícono en vez de romper la descarga entera. */
async function cargarIconoComoPng(): Promise<string | null> {
  try {
    const respuesta = await fetch('/icono-evangelismo.svg');
    const svgTexto = await respuesta.text();
    const url = URL.createObjectURL(new Blob([svgTexto], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar el ícono'));
        img.src = url;
      });
      const tam = 128;
      const canvas = document.createElement('canvas');
      canvas.width = tam;
      canvas.height = tam;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, tam, tam);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

/**
 * KAN-336: a diferencia de `descargarElementoComoPdf` (KAN-50, captura de
 * pantalla tal cual se ve), esto arma un documento real tamaño carta con
 * `jspdf-autotable` -- pedido explícito del owner: "no debe tener los mismos
 * colores que la página, son datos" + tamaño carta + "página bien
 * trabajada". Paginación real (no una sola imagen larga), sobrio: solo una
 * franja fina del color institucional arriba, texto en negro/gris, sin
 * badges de color por fila.
 */
export async function exportarPersonasEvangelizadasPdf(
  filas: FilaPersonaEvangelizadaPdf[],
  opciones: { iglesiaNombre: string; filtroDescripcion?: string }
): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const color = DEPARTAMENTO_META.EVANGELISMO.color;
  const iconoDataUrl = await cargarIconoComoPng();
  // Margen de seguridad 46pt (~0.64") en vez de 40pt -- pedido explícito del
  // owner tras ver el PDF impreso: el contenido quedaba dentro de la zona no
  // imprimible de algunas impresoras. Se usa el mismo valor para el margen
  // de la tabla (`margin.left/right` más abajo) para que todo quede alineado.
  const MARGEN = 46;
  // Si hay ícono, el título arranca despues de la caja del ícono; si no
  // pudo cargar, arranca desde el margen como antes.
  const xTexto = iconoDataUrl ? MARGEN + 28 : MARGEN;

  function encabezadoYPie() {
    // Franja fina de color institucional -- único toque de color, no un
    // banner completo (pedido explícito: "no tantos colores").
    doc.setFillColor(color);
    doc.rect(0, 0, anchoPagina, 6, 'F');

    if (iconoDataUrl) doc.addImage(iconoDataUrl, 'PNG', MARGEN, 16, 22, 22);

    doc.setFontSize(15);
    doc.setTextColor(20);
    doc.text('Departamento de Evangelismo', xTexto, 34);

    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(opciones.iglesiaNombre, xTexto, 50);
    const detalle = opciones.filtroDescripcion ? `Filtro: ${opciones.filtroDescripcion}` : 'Casas de Paz';
    doc.text(detalle, xTexto, 62);
    const ahora = new Date();
    const fechaHora = `${ahora.toLocaleDateString('es-BO')} - ${ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(`Generado el ${fechaHora}`, anchoPagina - MARGEN, 34, { align: 'right' });
    doc.text(`Total: ${filas.length}`, anchoPagina - MARGEN, 50, { align: 'right' });
  }

  encabezadoYPie();

  autoTable(doc, {
    startY: 78,
    head: [['Fecha Evangelizado', 'Nombre', 'Sexo', 'Teléfono', 'Tipo', 'Fecha de nacimiento', 'Edad', 'Evangelizado por', 'Red', 'Casa de Paz']],
    body: filas.map((f) => [
      f.fecha,
      f.nombre_completo,
      f.sexo,
      f.telefono_principal ?? '—',
      f.tipo_evangelismo_nombre ?? '—',
      f.fecha_nacimiento ?? '—',
      f.edad != null ? String(f.edad) : '—',
      f.evangelizado_por_nombre ?? '—',
      f.red_nombre ?? '—',
      f.casa_de_paz_etiqueta,
    ]),
    theme: 'plain',
    styles: { fontSize: 8, textColor: 30, cellPadding: 4, lineColor: [225, 225, 225], lineWidth: 0.5 },
    headStyles: { fillColor: [244, 244, 245], textColor: 40, fontStyle: 'bold', lineWidth: 0.5 },
    alternateRowStyles: { fillColor: [250, 250, 251] },
    columnStyles: {
      0: { cellWidth: 46 },
      1: { cellWidth: 78 },
      2: { cellWidth: 24 },
      5: { cellWidth: 52 },
      6: { cellWidth: 28 },
    },
    margin: { top: 78, left: MARGEN, right: MARGEN, bottom: 50 },
    didDrawPage: (data) => {
      // Encabezado se repite en cada página nueva (autoTable ya recorta el
      // primero con margin.top, esto es para la 2da en adelante).
      if (data.pageNumber > 1) encabezadoYPie();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${data.pageNumber}`, anchoPagina / 2, doc.internal.pageSize.getHeight() - 26, { align: 'center' });
    },
  });

  doc.save(nombreArchivoConFecha());
}
