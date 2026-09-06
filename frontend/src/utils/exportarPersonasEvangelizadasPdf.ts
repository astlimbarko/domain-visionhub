import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEPARTAMENTO_META } from './departamentos';

export interface FilaPersonaEvangelizadaPdf {
  nombre_completo: string;
  fecha: string;
  red_nombre: string | null;
  casa_de_paz_etiqueta: string;
  tipo_evangelismo_nombre: string | null;
  telefono_principal: string | null;
}

function nombreArchivoConFecha(): string {
  return `personas-evangelizadas-${new Date().toISOString().slice(0, 10)}.pdf`;
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
export function exportarPersonasEvangelizadasPdf(
  filas: FilaPersonaEvangelizadaPdf[],
  opciones: { iglesiaNombre: string; filtroDescripcion?: string }
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const color = DEPARTAMENTO_META.EVANGELISMO.color;

  function encabezadoYPie() {
    // Franja fina de color institucional -- único toque de color, no un
    // banner completo (pedido explícito: "no tantos colores").
    doc.setFillColor(color);
    doc.rect(0, 0, anchoPagina, 6, 'F');

    doc.setFontSize(15);
    doc.setTextColor(20);
    doc.text('Personas evangelizadas', 40, 34);

    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(opciones.iglesiaNombre, 40, 50);
    const detalle = opciones.filtroDescripcion ? `Filtro: ${opciones.filtroDescripcion}` : 'Todos los registros';
    doc.text(detalle, 40, 62);
    const ahora = new Date();
    const fechaHora = `${ahora.toLocaleDateString('es-BO')} ${ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(`Generado el ${fechaHora}`, anchoPagina - 40, 34, { align: 'right' });
    doc.text(`Total: ${filas.length}`, anchoPagina - 40, 50, { align: 'right' });
  }

  encabezadoYPie();

  autoTable(doc, {
    startY: 78,
    head: [['#', 'Nombre', 'Fecha', 'Red', 'Casa de Paz', 'Tipo', 'Teléfono']],
    body: filas.map((f, i) => [
      String(i + 1),
      f.nombre_completo,
      f.fecha,
      f.red_nombre ?? '—',
      f.casa_de_paz_etiqueta,
      f.tipo_evangelismo_nombre ?? '—',
      f.telefono_principal ?? '—',
    ]),
    theme: 'plain',
    styles: { fontSize: 8.5, textColor: 30, cellPadding: 5, lineColor: [225, 225, 225], lineWidth: 0.5 },
    headStyles: { fillColor: [244, 244, 245], textColor: 40, fontStyle: 'bold', lineWidth: 0.5 },
    alternateRowStyles: { fillColor: [250, 250, 251] },
    columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 55 } },
    margin: { top: 78, left: 40, right: 40 },
    didDrawPage: (data) => {
      // Encabezado se repite en cada página nueva (autoTable ya recorta el
      // primero con margin.top, esto es para la 2da en adelante).
      if (data.pageNumber > 1) encabezadoYPie();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${data.pageNumber}`, anchoPagina / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' });
    },
  });

  doc.save(nombreArchivoConFecha());
}
