# Ramas borradas — 2026-08-13

Todas ya estaban mergeadas a `master` antes de borrarlas (confirmado con
`git branch -r --merged origin/master`). Ningún commit se perdió — siguen
viviendo para siempre dentro del historial de `master`, solo se borró el
nombre corto de la rama. Para volver a ver el trabajo de cualquiera de
estas, buscar el hash de abajo en `git log master` o en GitHub.

- `afirmacion` — f01538a (2026-07-27) — fix: corregir doble resaltado del nav y compactar formularios de Afirmacion
- `docs/bitacora-2026-08-01-cont` — e130893 (2026-08-01) — docs: bitacora 2026-08-01 - rediseno selector multi-rol (2 ramas, sin merge)
- `docs/bitacora-2026-08-01-merge` — 22256fe (2026-08-01) — docs: bitacora 2026-08-01 - ramas del selector multi-rol mergeadas a master
- `docs/bitacora-2026-08-03` — 1166ca9 (2026-08-03) — docs: bitacora 2026-08-03 - fix KAN-67 y renombre de ramas
- `feat/afirmacion-en-selector-multirol` — feec3d8 (2026-08-01) — feat: integrar Lider de Departamento (Afirmacion) al selector multi-rol
- `feat/perfil-base-formularios` — 568c391 (2026-08-02) — feat: Supervisor de la Red en Accion, metas de evangelismo por CdP vs Red, y mejoras de branding
- `feature/estructura-organizacional` — e21ef6f (2026-08-07) — docs(bitacora): actualizar cierre de sesion 2026-08-07 (KAN-52)
- `feature/multirol-compacto` — 6bfc1cf (2026-08-04) — fix: achica encabezado y pie del selector multi-rol (KAN-72)
- `feature/navbar-lider-red` — ef06f27 (2026-08-04) — feat: navbar de ancho completo con buscador (Lider de Red) + footer de soporte compacto
- `feature/navegacion-iglesias-super-admin` — 0a94107 (2026-08-04) — chore: evita duplicar bitacora entre ramas
- `feature/pastor-supervisor-paridad-y-fixes-2026-08-09` — d66e054 (2026-08-09) — docs: bitácora -- 2026-08-09, Matías
- `feature/supervisor-vision-accion` — 6f8f028 (2026-08-09) — Merge branch 'master' of https://github.com/astlimbarko/domain-visionhub into feature/supervisor-vision-accion
- `fix/rls-vistas-e-indices-rendimiento` — c3c22c3 (2026-08-03) — docs: tickets de Jira breves, directo al grano
- `fix/sesion-cargando-infinito` — 60a9965 (2026-08-03) — fix: sesion vencida/corte de red ya no deja el logo de carga eterno
- `fix/vista-reporte-totales-n1` — 545c531 (2026-08-03) — fix: elimina antipatron N+1 en v_reporte_totales (hallazgo auditoria KAN-64)
- `login_+_multirol` — 39a3f8a (2026-08-03) — fix: login lleva directo al selector multirol, oculta selector de iglesia en Super Admin
- `new-feature` — 01eea09 (2026-07-31) — feat: notificaciones, Sublíder de CdP acotado y aprobación de Supervisor
- `new_frontend` — f1e8b72 (2026-07-25) — feat: historial de reportes/asistencia, ajustes de UX y responsividad movil
- `redesign-selector-multirol` — cb8d0fa (2026-08-01) — refactor: normalize multi-role dashboard data (color de red, anfitrion/direccion de CdP)
- `spec-15-gestion-administrativa` — 46a078f (2026-07-30) — docs: spec area 15 - gestion administrativa (Super-Admin, Pastor, Supervisor)
- `superadmin-pastor-supervisor` — 665ef85 (2026-08-03) — fix: filas mas bajas en el selector multi-rol + idioma oficial en CLAUDE.md

Quedan vivas: `master` y `codex/refactorizacion-multirol` (esta última
también ya mergeada, se borra después aparte).
