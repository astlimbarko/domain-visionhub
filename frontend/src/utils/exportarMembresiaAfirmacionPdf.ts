import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEPARTAMENTO_META } from './departamentos';

/** Mismas columnas que la tabla desktop de Membresía (vista reducida --
 * KAN-358 seguimiento, 2026-09-11). Valores ya formateados por el llamador
 * (`aFilaExportacion` en AfirmacionPersonas.tsx). Horizontal (landscape,
 * no carta vertical como Evangelismo) -- pedido explícito del owner: con
 * 15 columnas no entra parado. */
export interface FilaMembresiaPdf {
  numero: number;
  nombre_completo: string;
  sexo: string;
  edad: string;
  ci: string;
  red_nombre: string;
  casa_de_paz_etiqueta: string;
  estado_sigla: string;
  telefono_principal: string;
  via_registro: string;
  membresia: string;
  estado_civil: string;
  rango_miembro: string;
  bautizado: string;
  cargo_cdp: string;
  cargo_red: string;
  // Vista ampliada (2026-09-11) -- resto del censo, solo se usan si
  // opciones.vistaAmpliada es true.
  fecha_nacimiento: string;
  discipulados: string;
  seminario: string;
  universidad_rey_jesus: string;
  bautismo_detalle: string;
  mentor: string;
  conyuge: string;
  familiares: string;
  ministerios: string;
  efesio: string;
  cargos_censo: string;
}

function nombreArchivoConFecha(): string {
  return `membresia-afirmacion-${new Date().toISOString().slice(0, 10)}.pdf`;
}

async function cargarIconoComoPng(): Promise<string | null> {
  try {
    const respuesta = await fetch('/icono-afirmacion.svg');
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

/** Mismo criterio de diseño que exportarPersonasEvangelizadasPdf.ts (KAN-336):
 * documento real con jspdf-autotable, franja fina del color institucional,
 * sobrio, sin badges de color por fila. Landscape en vez de carta vertical
 * -- 16 columnas no entran paradas sin quedar ilegibles. */
export async function exportarMembresiaAfirmacionPdf(
  filas: FilaMembresiaPdf[],
  opciones: { iglesiaNombre: string; filtroDescripcion?: string; vistaAmpliada?: boolean }
): Promise<void> {
  const ampliada = opciones.vistaAmpliada ?? false;
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const color = DEPARTAMENTO_META.AFIRMACION.color;
  const iconoDataUrl = await cargarIconoComoPng();
  const MARGEN = 40;
  const xTexto = iconoDataUrl ? MARGEN + 28 : MARGEN;

  function encabezadoYPie() {
    doc.setFillColor(color);
    doc.rect(0, 0, anchoPagina, 6, 'F');

    if (iconoDataUrl) doc.addImage(iconoDataUrl, 'PNG', MARGEN, 16, 22, 22);

    doc.setFontSize(15);
    doc.setTextColor(20);
    doc.text('Membresía -- Afirmación', xTexto, 34);

    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(opciones.iglesiaNombre, xTexto, 50);
    const detalle = opciones.filtroDescripcion ? `Filtro: ${opciones.filtroDescripcion}` : 'Toda la iglesia';
    doc.text(detalle, xTexto, 62);
    const ahora = new Date();
    const fechaHora = `${ahora.toLocaleDateString('es-BO')} - ${ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(`Generado el ${fechaHora}`, anchoPagina - MARGEN, 34, { align: 'right' });
    doc.text(`Total: ${filas.length}`, anchoPagina - MARGEN, 50, { align: 'right' });
  }

  encabezadoYPie();

  const encabezadosAmpliada = [
    'Nacimiento', 'Discipulados', 'Seminario', 'Universidad Rey Jesús', 'Bautismo (detalle)', 'Mentor',
    'Cónyuge', 'Familiares', 'Ministerios', 'Efesio', 'Cargos (censo)',
  ];

  autoTable(doc, {
    startY: 78,
    head: [[
      '#', 'Nombre', 'Sexo', 'Edad', 'CI', 'Red', 'Casa de Paz', 'Estado', 'Teléfono', 'Vía', 'Membresía',
      'Estado civil', 'Rango', 'Bautizado', 'Cargo CdP', 'Cargo Red',
      ...(ampliada ? encabezadosAmpliada : []),
    ]],
    body: filas.map((f) => [
      String(f.numero),
      f.nombre_completo,
      f.sexo,
      f.edad,
      f.ci,
      f.red_nombre,
      f.casa_de_paz_etiqueta,
      f.estado_sigla,
      f.telefono_principal,
      f.via_registro,
      f.membresia,
      f.estado_civil,
      f.rango_miembro,
      f.bautizado,
      f.cargo_cdp,
      f.cargo_red,
      ...(ampliada
        ? [f.fecha_nacimiento, f.discipulados, f.seminario, f.universidad_rey_jesus, f.bautismo_detalle, f.mentor, f.conyuge, f.familiares, f.ministerios, f.efesio, f.cargos_censo]
        : []),
    ]),
    theme: 'plain',
    styles: { fontSize: ampliada ? 6 : 7, textColor: 30, cellPadding: ampliada ? 2 : 3, lineColor: [225, 225, 225], lineWidth: 0.5 },
    headStyles: { fillColor: [244, 244, 245], textColor: 40, fontStyle: 'bold', lineWidth: 0.5, halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 24 },
      13: { cellWidth: 40 },
    },
    margin: { top: 78, left: MARGEN, right: MARGEN, bottom: 50 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index % 2 === 1) {
        data.cell.styles.fillColor = [250, 250, 251];
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) encabezadoYPie();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${data.pageNumber}`, anchoPagina / 2, doc.internal.pageSize.getHeight() - 26, { align: 'center' });
    },
  });

  doc.save(nombreArchivoConFecha());
}
