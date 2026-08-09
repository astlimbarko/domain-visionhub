# 17 — Arquitectura multirol y contexto activo — implementation-plan.md

## Fase 0 — Cierre funcional (KAN-130)

- [x] Confirmar la matriz de `requirements.md` con el owner.
- [x] Resolver Afirmación, Jóvenes y Matrimonios como paneles independientes.
- [x] Definir ejemplos reales de usuarios para la matriz de pruebas.

No se cambia código hasta cerrar esta fase.

## Fase 1 — Modelo y validación de contexto (KAN-131)

- [x] Crear `ContextoActivo` y un adaptador desde `useMisRoles`.
- [x] Extender `auth.store.ts` para persistirlo y limpiarlo al cambiar iglesia o cerrar sesión.
- [x] Reemplazar la resolución de `useRolUI` por la derivación del contexto.
- [x] Añadir validación ante recarga e invalidación de contexto obsoleto.

## Fase 2 — Selector y rutas (KAN-132)

- [x] Unificar selector y validación sobre contextos por asignación real.
- [x] Hacer que `SeleccionarRol.tsx` guarde el contexto completo.
- [x] Adaptar `PrivateLayout.tsx` y guards para validar contexto + ruta.
- [x] Eliminar dependencia funcional de `location.state` para conservar alcance.

## Fase 3 — Shell visual aislado (KAN-133)

- [x] Crear catálogo de paneles por contexto.
- [x] Migrar `AppShell.tsx` al catálogo.
- [x] Retirar agregados de nav de capacidades ajenas.
- [x] Centralizar colores de navbar, títulos y rutas iniciales.

## Fase 4 — Módulos y consultas (KAN-134)

- [x] Migrar Dashboard primero: no usar `vistaPorDefectoParaRol` basada en índice.
- [x] Migrar Calendario, Evangelismo y Visitas.
- [x] Migrar Personas, Gestión de Red/CdP, Reportes e Historiales.
- [x] Revisar query keys, caché y selectores internos.

## Fase 5 — Seguridad, pruebas y documentación (KAN-135)

- [ ] Auditar RPC/RLS por iglesia, Red, CdP y departamento.
- [ ] Decidir y documentar cualquier migración necesaria por evidencia.
- [ ] Ejecutar pruebas de tipos, lint, build Docker y pruebas manuales.
- [ ] Actualizar este harness con decisiones y resultados reales.

## Matriz mínima de pruebas

| Caso | Resultado esperado |
|---|---|
| Un rol único | Entra directamente a su panel correcto |
| Supervisor + Líder de Red | Dos opciones; cada panel tiene nav y color propios |
| Líder de dos Redes | Dos opciones con Red distinta; recarga conserva la elegida |
| Líder CdP + Sublíder en otra | Opciones diferenciadas por CdP y cargo |
| Cambio de iglesia | Contexto anterior se invalida |
| URL directa sin contexto | Redirección segura al selector |
| URL/ID manipulado | RPC/RLS niega acceso fuera del alcance |
| Cambio de contexto | No muestra caché ni menú del panel anterior |

## Terminación

La épica no se considera terminada hasta que la matriz de pruebas pase en vivo con cuentas de prueba multirol, las rutas directas sean seguras y el usuario verifique visualmente que no hay sidebars ni colores mezclados.

### Avance real de KAN-135

- [x] Auditar en lectura RPC, ACL y RLS de iglesia, Red, CdP y departamento.
- [x] Preparar migraciones trazables según la evidencia encontrada.
- [x] Corregir y probar localmente las aprobaciones de Red (Q-MR-13).
- [ ] Compilar y aplicar las migraciones pendientes con aprobación del owner.
- [ ] Ejecutar pruebas de IDs manipulados con cuentas multirol reales.
- [ ] Resolver Q-MR-12 antes de cerrar la épica.
