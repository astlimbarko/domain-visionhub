import { calcularEdad } from './edad';
import type { RegistroProcesoAfirmacion } from '@/services/afirmacion.service';

// jsPDF se importa DINÁMICAMENTE dentro del export (no al tope): es una librería
// pesada y, al ser las puertas lazy, cargarla en el módulo engordaba el chunk de
// Altar/Bautismo/RSIL y los hacía lentos al abrir. Así solo se baja al tocar PDF.

// Export de la pestaña "Registro" de las puertas (Altar / Bautismo / RSIL).
// Formato simple = lo que ya muestra la tabla (pedido del owner 2026-10-09).
const COLUMNAS = ['N°', 'Nombre completo', 'Edad', 'Fecha', 'Hora', 'Colaborador', 'Quién lo invitó', 'Red'];

function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-BO');
}
function horaDe(creacion: string): string {
  return new Date(creacion).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}
function fechaLarga(d: Date): string {
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ordenarAlfabetico(r: RegistroProcesoAfirmacion[]): RegistroProcesoAfirmacion[] {
  return [...r].sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
}

function aFila(r: RegistroProcesoAfirmacion, i: number): string[] {
  return [
    String(i + 1),
    r.nombre_completo,
    r.fecha_nacimiento ? String(calcularEdad(r.fecha_nacimiento)) : '—',
    fechaCorta(r.fecha),
    horaDe(r.fecha_creacion),
    r.registrado_por_nombre ?? '—',
    r.invitado_por ?? '—',
    r.red_nombre ?? '—',
  ];
}

function nombreArchivo(proceso: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const limpio = proceso.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Registro_${limpio}_${hoy}`;
}

/** Descarga un Blob con un nombre de archivo explícito (método estándar). */
function descargarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export async function exportarRegistroProcesoPdf(registros: RegistroProcesoAfirmacion[], opciones: { proceso: string }): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  // Landscape: con 8 columnas en vertical quedaba apretado y los nombres largos
  // (ej. "quién lo invitó") se partían demasiado. autoTable igual envuelve el
  // texto y crece el alto de fila si hace falta.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  doc.setFontSize(14);
  doc.text(`Registro de ${opciones.proceso}`, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generado: ${fechaLarga(new Date())} · ${registros.length} personas`, 40, 56);
  autoTable(doc, {
    startY: 70,
    head: [COLUMNAS],
    body: ordenarAlfabetico(registros).map(aFila),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 113, 227] },
    margin: { left: 40, right: 40 },
  });
  descargarArchivo(doc.output('blob'), `${nombreArchivo(opciones.proceso)}.pdf`);
}

export function exportarRegistroProcesoXls(registros: RegistroProcesoAfirmacion[], opciones: { proceso: string }): void {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const th = COLUMNAS.map((c) => `<th style="background:#0071E3;color:#fff;border:1px solid #ccc;padding:4px">${esc(c)}</th>`).join('');
  const filas = ordenarAlfabetico(registros)
    .map((r, i) => `<tr>${aFila(r, i).map((v) => `<td style="border:1px solid #ccc;padding:4px">${esc(v)}</td>`).join('')}</tr>`)
    .join('');
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>` +
    `<h3>Registro de ${esc(opciones.proceso)}</h3>` +
    `<p>Generado: ${esc(fechaLarga(new Date()))} · ${registros.length} personas</p>` +
    `<table border="1"><thead><tr>${th}</tr></thead><tbody>${filas}</tbody></table></body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel' });
  descargarArchivo(blob, `${nombreArchivo(opciones.proceso)}.xls`);
}
