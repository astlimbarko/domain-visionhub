import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calcularEdad } from './edad';
import type { PersonaBloqueEvento } from '@/types/afirmacion-eventos.types';

// Formato de reporte "planilla" (pedido del owner 2026-10-08): mismas columnas
// que la hoja de registro que usan a mano -- N°, Nombre, Edad, Celular, Quién lo
// trajo, Red, Iglesia. Sin fecha/hora ni líder (eso queda en la vista en
// pantalla). "Quién lo trajo" va con el nombre completo, como en su planilla.
const COLUMNAS = ['N°', 'Nombre completo', 'Edad', 'Celular', 'Quién lo trajo', 'Red', 'Iglesia'];

/** Fecha larga en español: "2026-10-03" → "3 de octubre de 2026". */
function fechaLarga(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Nombre corto de la iglesia para la tabla ("Centro de Vida Montero" → "Montero"). */
export function iglesiaCorta(nombre: string | null): string {
  if (!nombre) return '—';
  return nombre.replace(/^Centro de Vida\s+/i, '').trim() || nombre;
}

/** Orden alfabético por nombre completo (como la planilla a mano). */
function ordenarAlfabetico(personas: PersonaBloqueEvento[]): PersonaBloqueEvento[] {
  return [...personas].sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
}

function aFila(p: PersonaBloqueEvento, i: number): string[] {
  return [
    String(i + 1),
    p.nombre_completo,
    p.fecha_nacimiento ? String(calcularEdad(p.fecha_nacimiento)) : '—',
    p.telefono ?? '—',
    p.invitado_por ?? '—',
    p.red_nombre ?? '—',
    iglesiaCorta(p.iglesia_origen),
  ];
}

/** Nombre de archivo: evento + fecha + bloque, sin caracteres raros. */
function nombreArchivo(evento: string, fechaEvento: string, bloque: string): string {
  const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${limpio(evento)}_${fechaEvento}_${limpio(bloque)}`;
}

export function exportarEventoBloquePdf(
  personas: PersonaBloqueEvento[],
  opciones: { evento: string; fechaEvento: string; bloque: string }
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  doc.setFontSize(14);
  doc.text(`${opciones.evento} — ${fechaLarga(opciones.fechaEvento)}`, 40, 36);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Hoja de ${opciones.bloque} · ${personas.length} personas`, 40, 52);
  autoTable(doc, {
    startY: 64,
    head: [COLUMNAS],
    body: ordenarAlfabetico(personas).map(aFila),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 113, 227] },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${nombreArchivo(opciones.evento, opciones.fechaEvento, opciones.bloque)}.pdf`);
}

/** XLS sin dependencia: tabla HTML servida como application/vnd.ms-excel.
 * Excel la abre como una sola hoja con el nombre del evento arriba. */
export function exportarEventoBloqueXls(
  personas: PersonaBloqueEvento[],
  opciones: { evento: string; fechaEvento: string; bloque: string }
): void {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const encabezado = COLUMNAS.map((c) => `<th style="background:#0071E3;color:#fff;border:1px solid #ccc;padding:4px">${esc(c)}</th>`).join('');
  const filas = ordenarAlfabetico(personas)
    .map((p, i) => `<tr>${aFila(p, i).map((v) => `<td style="border:1px solid #ccc;padding:4px">${esc(v)}</td>`).join('')}</tr>`)
    .join('');
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>` +
    `<h3>${esc(opciones.evento)} — ${esc(fechaLarga(opciones.fechaEvento))}</h3>` +
    `<p>Hoja de ${esc(opciones.bloque)} · ${personas.length} personas</p>` +
    `<table border="1"><thead><tr>${encabezado}</tr></thead><tbody>${filas}</tbody></table></body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo(opciones.evento, opciones.fechaEvento, opciones.bloque)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
