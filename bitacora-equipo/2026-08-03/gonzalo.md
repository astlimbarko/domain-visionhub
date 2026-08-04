# Gonzalo — 2026-08-03

- [x] Auditoría de 33 tickets "En revisión" en Jira contra el código real, movidos a su estado correcto (Finalizada / En curso / En revisión según correspondía)
- [x] Auditoría de rendimiento de la base de datos (KAN-64): hallazgo real de antipatrón N+1 en la vista `v_reporte_totales`
- [x] Fix del N+1 en `v_reporte_totales` aplicado y verificado (rama `fix/vista-reporte-totales-n1`)
- [ ] Falta: revisar/mergear rama `fix/vista-reporte-totales-n1`
- [x] Diagnóstico y fix del bug de logo de carga infinito con sesión vencida/sin red (KAN-65), probado en vivo con Playwright (rama `fix/sesion-cargando-infinito`)
- [ ] Falta: revisar/mergear rama `fix/sesion-cargando-infinito` **y desplegar a producción** (el fix no está aplicado todavía en `app.somoscdv.com`)
- [x] Reorganización completa de datos ficticios/huérfanos: iglesia de prueba "El Edén" creada, Centro de Vida 4 Anillo (iglesia real) quedó completamente vacía, Montero/Guabira reencadenadas como hija/satélite de El Edén (documentado en KAN-66)
- [x] Los 3 desarrolladores (Gonzalo, Matías, Daniel) quedaron con todos los roles del sistema en El Edén para poder probar el panel multi-rol completo
- [x] Corrección de una cuenta equivocada: el perfil y roles de Matías estaban en `mattfrs1345@gmail.com` en vez de su cuenta real `francosalvatierram@gmail.com` — migrado sin perder cargos
- [x] Verificación final de cuentas huérfanas tras la reorganización
- [ ] Falta: decidir qué hacer con `cijanmag@gmail.com` e `info.goforex77@gmail.com` (rol sin perfil vinculado, preexistentes)
- [ ] Falta: decidir si Montero necesita Pastor propio además de El Edén
- [x] Asignado `astlimbark` en Jira en todos los tickets tocados hoy (33 del lote de auditoría + KAN-64, 65, 66)
- [x] Reportado y documentado en Jira (KAN-67) un bug nuevo: al iniciar sesión a veces entra directo al panel de Super Admin en vez de mostrar el selector multi-rol — solo queda anotado con una hipótesis inicial (posible relación con la reorganización de roles de hoy), **no se toca código todavía**
- [ ] Falta: confirmar si KAN-67 le pasa también a Matías y Daniel, y decidir cuál de las 3 soluciones propuestas implementar

## Segunda parte del día — verificación del reporte externo (ChatGPT) + testing en vivo

- [x] Repetidas contra la base real todas las afirmaciones de un reporte de seguridad/rendimiento generado por ChatGPT (plugin de Supabase) — confirmado con evidencia propia en vez de confiar ciegamente
- [x] **Crítico, confirmado con prueba real**: 7 vistas (`v_persona`, `v_casa_de_paz`, `v_red`, `v_iglesia`, `v_persona_cargo_vigente`, `v_reporte_evangelismo`, `v_reporte_totales`) dejaban que cualquier usuario logueado se saltara el RLS "solo mi iglesia" y trajera datos de todas las iglesias — arreglado con `security_invoker = true` en las 7
- [x] 5 índices faltantes agregados en `red_cargo`, `casa_de_paz_cargo` y `casa_de_paz_membresia` (probable causa real de lentitud)
- [x] Revocado `EXECUTE` de `anon` en 187 de 189 funciones administrativas (quedan solo las 2 del formulario público de registro, que sí lo necesitan)
- [x] Verificado en vivo con Playwright (login limpio) que nada se rompió: panel Super Admin, panel Pastor, Historial de Reportes — todo funcionando igual
- [x] KAN-64 actualizado con el detalle completo de esta segunda pasada, sigue en Finalizada
- [x] Corregido un hallazgo propio erróneo: el OTP de correo a 72h NO es un problema — es el tiempo que tiene alguien recién invitado (o recuperando contraseña) para hacer clic y crear su contraseña, tal como se esperaba
- [x] Fix chico de UI: key duplicada "Dashboard" en el menú lateral (warning de consola) — arreglado y verificado, 0 errores (KAN-69)
- [x] Investigado a fondo el combobox de "iglesia activa" que aparece también en el panel de Super Admin — causa raíz encontrada y documentada en KAN-67: la ambigüedad de roles se calcula respecto a `iglesiaActivaId`, que para un Super Admin puede caer en una iglesia donde no tiene ningún otro rol, ocultando el selector multi-rol sin querer
- [x] Probado en vivo el flujo completo de Afirmación: alta de miembro por formulario interno (funciona bien) y por link público (funcionaba, pero el mensaje de confirmación mostraba el nombre de la Casa de Paz vacío)
- [x] Encontrado y arreglado ese bug del link público (KAN-68): usaba una columna vacía a propósito en vez de la función que calcula el nombre visible de la CdP
- [x] Agregada regla nueva a `CLAUDE.md`: todo cambio debe quedar registrado en Jira (crear ticket si no existe), con astlimbark como reporter y assignee siempre
- [ ] Falta: mergear/desplegar la rama `fix/rls-vistas-e-indices-rendimiento` (vistas + índices + permisos anon + los 2 fixes chicos de hoy)
- [ ] Falta: pushear esta rama de bitácora (`docs/bitacora-2026-08-03`)
