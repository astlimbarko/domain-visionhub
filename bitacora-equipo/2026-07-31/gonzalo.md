# Gonzalo — 2026-07-31

- [x] Escribí el spec técnico del área 15 (gestión administrativa: Super-Admin, Pastor, Supervisor) en `harness/15-gestion-administrativa/` — requirements, technical-design, database-impact, implementation-plan (5 paneles), open-questions
- [x] Abrí y fusioné el PR #9 (spec) a `master`
- [x] Panel 0: pie de soporte institucional en el sidebar, hover azul estandarizado (`lib/estilos.ts`), colores de departamento e iglesia satélite documentados en el design system
- [x] Panel 1: reemplacé el PIN estático de Super Admin por un código OTP de 6 dígitos enviado por correo (tabla `usuario_otp`, `fn_generar_otp`/`fn_verificar_otp`, Edge Function `solicitar-otp`, componente `CampoOtp`) — probado en vivo con código real
- [x] Panel 2: gestión completa de Super-Admin — editar/suspender/eliminar iglesias, editar/remover usuarios, alta con doble vía (buscar existente / invitar por correo), landing directo a Administración — probado en vivo
- [x] Agregué `red.color` a la base de datos (solo BD, sin frontend, a pedido explícito)
- [x] Crear iglesia hija/satélite con Pastor asignado en el mismo flujo (adelanto del Panel 4) — probado en vivo, un solo código cuando el Pastor ya tiene cuenta
- [x] Filtré la lista de Usuarios a solo Super Admin/Pastor/Supervisor (Líder de Red/CdP ya no aparecen ahí, se gestionan desde Casas de Paz)
- [x] Encontré y corregí un bug real: al filtrar Usuarios se rompió la búsqueda de "cuenta existente" para el alta — separé `fn_buscar_cuentas` (busca en todas las cuentas) de `fn_listar_usuarios` (solo cargos administrativos)
- [x] Extendí permisos para que el Pastor pueda gestionar a su propio Supervisor (estaba bloqueado sin querer desde que el Pastor dejó de ser "operativo")
- [x] Panel mínimo del Pastor (`/pastor-gestion`, sin sidebar ni dashboard a propósito — solo funcionalidad) para asignar/invitar a su Supervisor de la Visión en Acción — probado en vivo con cuenta de prueba
- [x] Recuperé `CLAUDE.md` y la bitácora de ayer (habían quedado en un stash sin commitear)

## Pendiente para mañana (2026-08-01) — bugs reportados hoy, no corregidos todavía

- [ ] **Diálogo "Crear Iglesia" se cierra al hacer clic afuera aunque tenga contenido cargado** (se pierde el código ya enviado). Debe bloquear el cierre por clic afuera cuando el formulario tiene contenido; solo permitir cerrar así si está vacío.
- [ ] **Revisar coherencia del vencimiento del código OTP** — está declarado en 10 minutos pero pareciera caducar en segundos. Investigar si es un bug real (posible desajuste de zona horaria en `expira_en`) o un problema de percepción/UI.
- [ ] **Quitar el segundo código al invitar Pastor por correo** en el flujo de Crear Iglesia. Un solo código (el del Super-Admin) debe alcanzar; el Pastor no necesita su propio PIN — solo debe aceptar la invitación, que debería caducar en ~3 días (no un segundo OTP).
- [ ] **Quitar la opción "Independiente"** del diálogo Crear Iglesia — toda iglesia es Hija o Satélite, nunca independiente (ya estaba anotado, se repite).
- [ ] **Bug visual: doble scrollbar** al elegir "Hija / satélite" en Crear Iglesia — se siente mal, revisar el `max-height`/overflow del diálogo.
- [ ] **Ponerle estética a los paneles del Pastor y del Supervisor de la Visión en Acción** (hoy están deliberadamente sin sidebar/dashboard, solo funcionales)
- [ ] Posiblemente crear el panel del Supervisor de la Visión en Acción (mismo rol que "Líder de la Visión en Acción" — ya unificados en `harness/README.md`, aclarar el nombre si genera confusión)
- [ ] **Duda abierta sin resolver:** ¿qué debe "crear" el panel mínimo del Supervisor? Líder de Red ya tiene pantalla propia en Casas de Paz, Supervisor de Red (rol nuevo) sigue bloqueado hasta confirmar con Matías, y Departamentos es su propio panel aparte. Recordar esta pregunta al owner mañana.
- [ ] Antes del Panel 5 (Supervisor de Red): confirmar con Matías si ya está trabajando algo ahí (acordado, sigue pendiente).
