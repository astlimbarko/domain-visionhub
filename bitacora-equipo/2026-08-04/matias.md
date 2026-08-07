# Matías — 2026-08-04

## Rama `feature/supervisor-vision-accion` — funciones del Supervisor de la Visión en Acción

Contexto: varias secciones del menú del Supervisor (`Calendario`, `Finanzas`, `Historial de Reportes`, `Historial de Asistencia`) eran cascarones vacíos — el código solo tenía ramas para Líder de Red o para quien lidera/sublidera una Casa de Paz, y el Supervisor caía siempre en el placeholder "Todavía no tenés una Casa de Paz asignada...". Se armó un plan (2 agentes de exploración en paralelo: uno de calendario/iglesias satélite, otro de reportes/asistencia/finanzas) y se ejecutó en 6 fases.

- [x] **Personas**: el Supervisor ya no ve los registros de evangelismo tipo "Semilla" (persona real sin datos, solo cuenta) mezclados con miembros reales — nuevo parámetro `p_solo_miembros` en `fn_buscar_personas`. Agregada paginación real (`[<] N [>]`, 20 por página) vía `p_pagina`/`p_por_pagina` + `count(*) OVER()`
- [x] **Historial de Reportes**: pasa a ser el mismo "Control de Reportes" que ya tenía el Líder de Red (grilla mensual por CdP, en su fecha de reunión), con selector de Red que recorre TODAS las redes de la iglesia (no solo las propias). `ControlReportesVista` se reusó tal cual, sin cambios — ya era genérica por `redId`
- [x] Sacado `Reportes` (formulario de carga) del menú del Supervisor — no reporta, igual que el Líder de Red
- [x] **Historial de Asistencia**: mismo criterio, selector Red → CdP, reusando el componente de historial que ya usa el Líder/Sublíder de CdP
- [x] **Finanzas**: nueva vista por Red — contabilidad total de la Red + desglose por Casa de Paz (extraje `BloqueFinanciero`/`agruparFinanzasPorCdp` de `DashboardLiderRed.tsx` a un archivo compartido para reusarlo sin duplicar lógica)
- [x] **Calendario — ámbito IGLESIA (nuevo)**: hasta hoy solo existían eventos de CdP y de Red. Se relajó el CHECK de `evento` para permitir un tercer ámbito (ambos `casa_de_paz_id`/`red_id` nulos = evento de toda la iglesia), con cascada automática hacia Red y CdP (mismo patrón que ya usaba Red→CdP). Nuevo componente `CalendarioIglesia.tsx` para Supervisor
- [x] **Calendario — iglesia padre gestiona la de su hija/satélite**: nueva función `fn_es_operativo_en_o_padre_de` (un solo nivel, sin recursividad) — **a propósito no se tocó `fn_mis_iglesias()` ni ninguna otra RLS**, para no darle al padre acceso a personas/reportes/finanzas de la hija, solo a su calendario. Selector "Iglesia: [la mía / hija/satélite]" en la página de Calendario cuando corresponde
- [x] `tsc -b --noEmit`, `oxlint`, `vite build` limpios en cada fase
- [ ] **3 migraciones nuevas sin aplicar** (mismo patrón que el resto de las pendientes del proyecto): `99_buscar_personas_paginado_miembros.sql`, `100_calendario_ambito_iglesia.sql`, `101_calendario_padre_satelite.sql` — hace falta que alguien con acceso a la base las corra a mano antes de que cualquiera de estas 6 fases funcione de verdad
- [ ] Sigo sin poder probar en vivo (mismo bloqueo de credenciales de siempre) — falta verificación real con una cuenta Supervisor (y, para la Fase F, una iglesia con hija/satélite real) antes de mergear
- [ ] Todo esto vive sin commitear en `feature/supervisor-vision-accion` — falta decidir cuándo commitear
- [ ] Pendiente: ticket de Jira (mismo bloqueo de acceso a Jira que el resto del día)

## (Separado, rama `fix/bugs-roles-multirol`, ya commiteada)

Ver commits `6bd20a2` y `5bfe80e`: emoji del selector de roles, bug del Sublíder viendo el dashboard del Líder de CdP, bug del Pastor con drill-down a Red/CdP, "sombreros" sacados del sidebar, fix de iglesia activa por defecto (causa raíz del bug de multi-rol), cards KPI responsive en móvil, y sincronización de roles en tiempo real vía Supabase Realtime.
