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

## Aclaración de jerarquía de roles (owner)

Supervisor de la Visión en Acción > Supervisor de Red (en Acción) > Líder de Red. "Supervisor de Red" (o "Supervisor de Red de la Visión en Acción") sigue sin existir en ningún lado — confirmado ahora también en el enum `rol_sistema_enum` y en la tabla `cargo` completa (antes solo había revisado ramas de GitHub). Matías estaba verificando con el owner al cerrar la sesión.

## Mensaje de Matías sobre su PR #11 — verificado y corregido

- [x] **Encontré y corregí un problema serio**: las migraciones 57 (`notificaciones`) y 58 (`solicitudes_estructura`) de Matías nunca se habían aplicado a la base real, aunque el frontend que las necesita ya estaba mergeado y activo — `fn_asignar_cargo_red`/`fn_asignar_cargo_cdp` no existían, rompiendo asignar Líder/Sublíder/Encargados de Red o CdP en producción (y mi propio "Gestión de Redes", que depende de esa misma función). Ya apliqué ambas, verificadas
- [x] Confirmé 48, 49, 55, 56 ya estaban aplicadas de antes (no eran urgentes)
- [x] Limpié los 2 eventos de prueba que Matías no pudo borrar por permisos ("Reunión de prueba de red" x2, Red Vida Nueva)
- [x] Confirmé el punto 7 de Matías (selección de rol multi-rol): coincide con lo que ya había verificado, funciona, no depende de ninguna migración
- [ ] **Avisar a Matías**: dice `GOOGLE_AUTH_HABILITADO=false` pero el código que subió tiene `= true` — no rompe nada grave, pero confirmar cuál es el estado que realmente quiere

## Multi-rol real para cualquier cuenta (incluido Super Admin)

- [x] Decisión explícita del owner: ninguna cuenta debe estar limitada a un solo rol — si se asigna otro, simplemente tendrá 2. Quité la restricción `ROL_SUPER_ADMIN_NO_OPERATIVO` de `fn_validar_asignacion_rol` (migración 74)
- [x] Coordinado el frontend para que el picker (`SeleccionarRol.tsx`) sea alcanzable en ese caso: `calcularOpcionesRolUI`/`ROL_UI_META` ahora incluyen `SUPER_ADMIN` como opción elegible; `useRolUI`/`useOpcionesRol`/`PrivateLayout` ya no cortan antes de mirar el resto de los roles cuando es Super Admin — un Super Admin sin otros roles sigue exactamente igual que antes (atajo directo a Administración)
- [x] Asigné Líder de Red (Red Svalmar) a `astlimbark@gmail.com` directamente en la base (persona + red_cargo + usuario_rol), a pedido del owner, para probar el picker multi-rol en vivo sin depender del correo OTP (que no estaba llegando)
- [x] `tsc -b --noEmit` limpio, commit hecho, PR #12 mergeado a `master`, local `master` actualizado (fast-forward)
- [ ] **Falta probar en vivo**: el owner tiene que loguearse con `astlimbark@gmail.com` y confirmar que aparece el picker multi-rol (Super Admin / Líder de Red). Nota técnica: como Super Admin ve TODAS las iglesias, `iglesiaActivaId` por defecto puede no ser la iglesia de la Red Svalmar (Centro de Vida 4 Anillo) — si el picker no aparece de entrada, cambiar de iglesia activa al selector de esa iglesia primero (mismo comportamiento que cualquier otro rol, no es un bug nuevo)

## OTP sin llegar (pendiente sin resolver)

- [ ] Los códigos OTP para designar Líder de Red en la Red Svalmar (correo `mattfrs1345@gmail.com`) nunca llegaron a la bandeja de entrada. Revisé `usuario_otp` (códigos se generaban bien, respetando el cooldown de 120s) y los secrets de Brevo en Supabase (presentes, sin cambios) — no pude confirmar la causa raíz (no tuve acceso a logs de Edge Functions). Sospecha más probable: reputación de dominio nuevo / spam, ya mencionado en sesiones anteriores. **No resuelto**, quedó pendiente porque el owner pidió probar el picker multi-rol directamente en la base en su lugar

## Pendiente para la próxima sesión

- [ ] **Confirmar con Matías** qué contestó sobre "Supervisor de Red" (estaba verificando al cerrar esta sesión) — si dice que lo hizo, pedirle la rama/PR exacto antes de construir nada nuevo
- [ ] **Diseño de la pantalla multi-rol** (`SeleccionarRol.tsx`, ya funciona, hecha por Matías el 2026-07-30, confirmado por él mismo): el owner pasó un mockup (`login_multi_rol.jpeg`) con un estilo bien distinto al actual (lista de filas con detalle por rol, no grilla de tarjetas) — evaluar si se rediseña
- [ ] Estética de los paneles de Pastor y del nuevo Departamentos/Gestión de Redes (hoy funcionales, sin pasada de diseño)
- [ ] Invitar por correo para Líder de Afirmación: hoy solo "buscar existente" es básico ahí en cuanto a UI pulida (la función ya está completa y probada)
- [ ] Revisar si conviene revocar el token de Management API de Supabase usado hoy (`sbp_dda6aaf9...`)
