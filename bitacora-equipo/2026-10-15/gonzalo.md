# Gonzalo — 2026-10-15

Rama de trabajo: `feat/afirmacion-export-altar-bautismo-rsil` → MERGEADA a master (PR #152).

## Export + más datos en el Registro de Afirmación
- [x] Botón rojo **"Exportar"** con menú desplegable (PDF / XLS) en la pestaña Registro de las 4 etapas (Altar, Bautismo, RSIL, Membresía). PDF paginado landscape, XLS, orden alfabético, respeta filtro de colaborador/búsqueda.
- [x] 2 columnas nuevas: **"Quién lo invitó"** y **"Red"** (tabla desktop + tarjetas móvil). Nombre del invitador completo.
- [x] Backend: `fn_afirmacion_historial_proceso` devuelve invitado_por (persona_llegada) + red_nombre (CdP principal → red), con subconsultas escalares (sin fanout). Migración 20261015120000, APLICADA a prod.
- [x] Registro de **Membresía** llevado a la misma estructura que las otras puertas (tabla + filtro + export), manteniendo indicador de Bautizo + precarga en "Nuevo".
- [x] perf: jsPDF se importa DINÁMICAMENTE (las puertas lazy abrían lento con jspdf en el chunk). Descarga unificada Blob + <a download>. PDF del Registro en landscape (8 columnas).

## Diagnóstico "descarga sin extensión"
- [x] Reproducido: los archivos SÍ salen con extensión y bien formados (PDF `%PDF-1.3`, XLS con datos). Nombre `Registro_<Proceso>_<fecha>.pdf/.xls`. El síntoma del owner era de su entorno (extensión oculta de Windows o gestor de descargas), no del código.

## Deploy (v1.0.152)
- [x] PR #152 mergeado a master (merge 9f1fdf8). Build OK. ZIP `visionhub-dist-2026-10-15-afirmacion-export.zip` armado y entregado.
- [x] `/avances` (export + columnas) aplicado a prod. Backend invitó/red ya en prod.
- [x] La versión del login se arma sola desde el último PR mergeado → este build muestra **v1.0.152**.
- [ ] Pendiente (owner): **subir el ZIP a cPanel**. Al subirlo se activan EN VIVO el Panel de Eventos (que no estaba desplegado) + el export nuevo.

## Otros
- [x] `yu.txt` (token Supabase) dejado en la raíz a pedido del owner (NO borrar). Ya está gitignored — no se sube.
- [ ] Pendiente (aparte): KAN-500 (bug persona existente Bautismo/Membresía), dedup profundo de ~5 fichas duplicadas.
- [ ] Jira: KAN del export (se registra en esta sesión).
