import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calcularEdad } from './edad';
import type { PersonaBloqueEvento } from '@/types/afirmacion-eventos.types';

/** Nombre abreviado para columnas de persona-referencia (quién invitó, líder
 * de CdP): primer nombre + inicial del segundo token. Pedido del owner
 * (2026-10-08): "solo nombres, y su primer apellido letra inicial". */
function nombreAbreviado(nombre: string | null): string {
  if (!nombre) return '—';
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1][0]}.`;
}

function fechaHora(creacion: string): string {
  const d = new Date(creacion);
  return `${d.toLocaleDateString('es-BO')} ${d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
}

const COLUMNAS = ['#', 'Fecha y hora', 'Nombre completo', 'Edad', 'Teléfono', 'Invitó', 'Red', 'Líder de CdP', 'Iglesia'];

/** Nombre corto de la iglesia para la tabla ("Centro de Vida Montero" → "Montero"). */
export function iglesiaCorta(nombre: string | null): string {
  if (!nombre) return '—';
  return nombre.replace(/^Centro de Vida\s+/i, '').trim() || nombre;
}

function aFila(p: PersonaBloqueEvento, i: number): string[] {
  return [
    String(i + 1),
    fechaHora(p.fecha_creacion),
    p.nombre_completo,
    p.fecha_nacimiento ? String(calcularEdad(p.fecha_nacimiento)) : '—',
    p.telefono ?? '—',
    nombreAbreviado(p.invitado_por),
    p.red_nombre ?? '—',
    nombreAbreviado(p.lider_cdp),
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
  doc.text(opciones.evento, 40, 36);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${opciones.bloque} · ${opciones.fechaEvento} · ${personas.length} personas`, 40, 52);
  autoTable(doc, {
    startY: 64,
    head: [COLUMNAS],
    body: personas.map(aFila),
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
  const filas = personas
    .map((p, i) => `<tr>${aFila(p, i).map((v) => `<td style="border:1px solid #ccc;padding:4px">${esc(v)}</td>`).join('')}</tr>`)
    .join('');
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>` +
    `<h3>${esc(opciones.evento)}</h3>` +
    `<p>${esc(opciones.bloque)} · ${esc(opciones.fechaEvento)} · ${personas.length} personas</p>` +
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
