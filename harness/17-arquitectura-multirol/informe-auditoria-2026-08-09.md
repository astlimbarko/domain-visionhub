# Informe de auditoría — Arquitectura multirol — 2026-08-09

## Estado real

El trabajo se realizó en `codex/refactorizacion-multirol`. Se integró el PR #22 de Matías, se mantuvo el aislamiento por `ContextoActivo`, se auditó la seguridad RPC/RLS y se prepararon tres migraciones para KAN-135.

**No se aplicó ninguna migración a Supabase remoto. No se hizo push ni merge a `master`.** Las pruebas de base de datos se hicieron en contenedores temporales PostgreSQL 17, luego eliminados.

KAN-135 sigue en progreso. No debe cerrarse hasta aplicar y probar las migraciones con autorización de Gonzalo, realizar pruebas con cuentas multirol reales y resolver los pendientes descritos abajo.

## Conflictos al integrar el PR #22

Commit de integración: `11dbc9b`. La resolución se puede auditar con `git show --remerge-diff 11dbc9b`.

| Archivo | Resolución aplicada | Observación pendiente |
|---|---|---|
| `frontend/src/components/layout/AppShell.tsx` | Se conservó `panelContexto?.navItems` para impedir sidebars mezclados | El menú móvil del Super Admin quedó oculto; puede contradecir KAN-128 y debe revisarse |
| `frontend/src/pages/Calendario.tsx` | Se conservó el `cdpId` exacto del contexto | Sin fallback a la primera CdP |
| `frontend/src/pages/Evangelismo.tsx` | Se conservó el `cdpId` exacto del contexto | Se retiró el selector interno que podía alterar alcance |
| `frontend/src/pages/Finanzas.tsx` | Se mantuvieron iglesia, rol y CdP desde `ContextoActivo` | Se retiró resolución legacy |
| `frontend/src/pages/HistorialReportes.tsx` | Se preservó la descarga PDF de Matías y el alcance exacto | Se retiró fallback a otra CdP |

## Cambios de base de datos preparados, no aplicados

### `20260809053351_kan_135_hardening_privilegios_y_coherencia.sql`

Commit `6ce1612`.

- Revoca ejecución pública de una función interna de membresía.
- Exige coherencia de iglesia en RPC de notificaciones.
- Comprueba que una Red pertenezca a la iglesia al consultar anuncios.
- Cambia `v_reporte_totales` a `security_invoker`.
- Define permisos explícitos para RPC operativos.

### `20260809054456_kan_135_alcance_exacto_red_cdp.sql`

Commits `70eed3c` y `9c32066`.

- Añade comprobaciones de alcance exacto para Red y Casa de Paz.
- Acota listados, finanzas, calendario, cumpleaños y políticas RLS.
- Conserva acceso a la Red padre para cargos de una CdP, pero bloquea CdP hermanas.
- Mantiene el control financiero más estricto que ya existía.

### `20260809060533_kan_135_aprobaciones_red_transaccionales.sql`

Commit `975dd14`.

- Corrige el flujo donde un Líder de Red autorizado para aprobar una fusión o multiplicación no podía completar la operación.
- Limita la autorización transaccional a la solicitud, iglesia, Red, payload y aprobador exactos.
- Añade bloqueo `FOR UPDATE` y validación estricta del JSONB.
- No convierte ni eleva al usuario a Supervisor.

## Problemas ocurridos y solución

| Problema | Causa | Solución/resultado |
|---|---|---|
| Cinco conflictos Git | PR #22 y KAN-134 tocaron los mismos módulos | Resolución manual y revisión con `--remerge-diff`; queda pendiente revisar AppShell móvil |
| `apply_patch` no podía leer archivos existentes | ACL de Windows del workspace | Se usaron transformadores temporales exactos, se revisaron los diffs y se eliminaron los temporales |
| Texto danado en documentacion | Lectura ANSI de un archivo UTF-8 sin BOM | Se detecto en el diff y se corrigio con escritura UTF-8 explicita |
| Error SQL en `ORDER BY lider_nombre` | Faltaba alias en una subconsulta | Se añadió `AS lider_nombre` y recompiló correctamente |
| Primera prueba de alcance falló | Fixture incompleto: faltaba el cargo real de CdP | Se completó el fixture y la prueba pasó desde una base limpia |
| `supabase start` quedó sin responder | El stack local no arrancó y avisó que faltaba `BREVO_SMTP_PASS` | Se detuvo; no se tocó nube; se validó en PostgreSQL 17 aislado |
| Docker demoró 271,5 segundos | `npm install` tomó 118,6 s y exportar/descomprimir capas cerca de 134 s | La imagen terminó construida correctamente |

## Validaciones ejecutadas

- TypeScript y Vite: aprobados después de integrar PR #22; 3.626 módulos.
- Lint: aprobado con 9 advertencias preexistentes de Fast Refresh.
- Docker Compose compartido: build aprobado.
- PostgreSQL 17: las tres migraciones compilaron desde una base limpia.
- Alcance: Red propia y CdP propia visibles; Red padre visible; CdP hermana bloqueada; Supervisor con alcance total.
- Aprobaciones: fusión y multiplicación válidas; payload manipulado rechazado y solicitud pendiente preservada.

Los fixtures SQL fueron temporales y no quedaron versionados. Esto limita la reproducción automática y conviene corregirlo antes de aplicar en vivo.

`npm install` informó 12 vulnerabilidades de dependencias: 4 moderadas y 8 altas. No se ejecutó `npm audit fix` porque sería un cambio transversal fuera de KAN-135.

## Pendientes obligatorios

1. Auditar la resolución de los cinco conflictos, especialmente el menú móvil del Super Admin/KAN-128.
2. Versionar pruebas SQL reproducibles para las tres migraciones.
3. Resolver Q-MR-12: alcance de Personas para Líder/Sublíder de CdP.
4. Con autorización explícita de Gonzalo, aplicar las tres migraciones a Supabase.
5. Probar en vivo con cuentas multirol e IDs manipulados.
6. Revisar las 12 alertas de dependencias en una tarea separada.

## Commits auditables de hoy

- `11dbc9b` — integrar `master` tras PR #22.
- `6ce1612` — cerrar brechas de privilegios y coherencia.
- `70eed3c` — acotar lectura por Red y CdP.
- `975dd14` — asegurar aprobaciones de Red.
- `9c32066` — validar alcance exacto Red/CdP.
- `944a8be` — registrar validación local.
- `089c879` — validar build Docker compartido.

Este documento no afirma que las migraciones estén activas en producción ni que la épica esté terminada.
