# Gonzalo — 2026-07-31

- [x] Escribí el spec técnico del área 15 (gestión administrativa: Super-Admin, Pastor, Supervisor) en `harness/15-gestion-administrativa/` — requirements, technical-design, database-impact, implementation-plan (5 paneles), open-questions
- [x] Abrí y fusioné el PR #9 (spec) a `master`
- [x] Panel 0: pie de soporte institucional en el sidebar, hover azul estandarizado (`lib/estilos.ts`), colores de departamento e iglesia satélite documentados en el design system
- [x] Panel 1: reemplacé el PIN estático de Super Admin por un código OTP de 6 dígitos enviado por correo (tabla `usuario_otp`, `fn_generar_otp`/`fn_verificar_otp`, Edge Function `solicitar-otp`, componente `CampoOtp`) — probado en vivo con código real
- [x] Panel 2: gestión completa de Super-Admin — editar/suspender/eliminar iglesias, editar/remover usuarios, alta con doble vía (buscar existente / invitar por correo), landing directo a Administración — probado en vivo
- [x] Agregué `red.color` a la base de datos (solo BD, sin frontend, a pedido explícito)
- [x] Crear iglesia hija/satélite con Pastor asignado en el mismo flujo (adelanto del Panel 4) — probado en vivo
- [x] Filtré la lista de Usuarios a solo Super Admin/Pastor/Supervisor (Líder de Red/CdP ya no aparecen ahí, se gestionan desde Casas de Paz)
- [x] Panel mínimo del Pastor (`/pastor-gestion`) para asignar/invitar a su Supervisor de la Visión en Acción
- [x] Recuperé `CLAUDE.md` y la bitácora de ayer (habían quedado en un stash sin commitear)

## Sesión extendida del mismo día (tarde/noche) — bugs reportados y corregidos, todos probados en vivo

- [x] Diálogo "Crear Iglesia" ya no se cierra al clic afuera si tiene contenido cargado (solo cierra si está vacío)
- [x] Quité la opción "Independiente" de Crear Iglesia — toda iglesia es Hija o Satélite
- [x] Corregí el doble scrollbar al elegir "Hija/satélite" en Crear Iglesia
- [x] Un solo código OTP para crear iglesia + invitar Pastor por correo (antes pedía dos) — nueva Edge Function `crear-iglesia`
- [x] Bug real encontrado y corregido: "Agregar usuario" (invitar por correo, cualquier cargo) verificaba el mismo código dos veces — la segunda siempre fallaba con "PIN incorrecto". `invitar-usuario` ahora asigna el cargo ella misma, un solo código
- [x] Bug real encontrado y corregido: Súper Admin nunca pudo asignar Supervisor de la Visión en Acción (el trigger solo lo permitía si quien llamaba ya era Pastor) — quedaba oculto detrás del bug anterior
- [x] Bug real encontrado y corregido: `fn_verificar_otp` solo aceptaba el código más reciente pedido, invalidando códigos anteriores aún vigentes
- [x] Cooldown de reenvío de OTP ajustado a 120s (probado en vivo con el owner, el correo tardaba más que el cooldown anterior)
- [x] HMR de Vite: fix permanente (polling explícito en `vite.config.ts`) — los cambios de archivo ya se reflejan solos, sin reiniciar el servidor. Probado en vivo
- [x] Menú "Departamentos" (Supervisor): ver los 4 departamentos con su color/verbo institucional; asignar/invitar Líder de Afirmación (único funcional hoy, los otros 3 muestran "Próximamente"). Nuevo mecanismo de invitación por correo para Líder de Departamento (`invitacion_lider.departamento_id`, antes no existía ningún camino para esto)
- [x] Menú "Gestión de Redes" (Supervisor): crear/desactivar Redes, designar/cambiar Líder de Red (buscar existente o invitar por correo) — todo con confirmación OTP obligatoria ("es delicado"). Se sacó esa gestión de Casas de Paz para el Supervisor (le queda solo CdP, fusiones y multiplicaciones)
- [x] Panel del Supervisor: saqué "Nombre de la iglesia" (no puede renombrarla) y el interruptor de activar/desactivar departamento (quedan siempre activos)
- [x] Saqué "Ministerios" del menú y las rutas del Supervisor (no existe para este rol)
- [x] Mergeé `master` (con el PR #11 de Matías: notificaciones, Sublíder de CdP acotado, aprobación de estructura por el Líder de Red) a mi rama, sin conflictos pendientes
- [x] Abrí el PR #12 (`gestion-administrativa-3-roles` → `master`) con todo lo de hoy
- [x] Incidente resuelto: al hacer `supabase config push`, el `config.toml` del repo estaba desactualizado respecto a producción y por un momento reabrió el registro público y cambió la URL/remitente de correo — detectado y revertido en el momento, sin ventana real abierta

## Pendiente para la próxima sesión

- [ ] **Confirmar con Matías** si el "Supervisor de Red" que dice haber hecho existe en alguna rama sin subir a GitHub — no está en ningún lado del remoto, hay que pedirle que lo suba para revisarlo
- [ ] **Diseño de la pantalla multi-rol** (`SeleccionarRol.tsx`, ya funciona, hecha por Matías el 2026-07-30): el owner pasó un mockup (`login_multi_rol.jpeg`) con un estilo bien distinto al actual (lista de filas con detalle por rol, no grilla de tarjetas) — evaluar si se rediseña
- [ ] Estética de los paneles de Pastor y del nuevo Departamentos/Gestión de Redes (hoy funcionales, sin pasada de diseño)
- [ ] Invitar por correo para Líder de Afirmación: hoy solo "buscar existente" es básico ahí en cuanto a UI pulida (la función ya está completa y probada)
- [ ] Revisar si conviene revocar el token de Management API de Supabase usado hoy (`sbp_dda6aaf9...`)
