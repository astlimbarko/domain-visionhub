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
- [ ] Falta: reproducir KAN-67 con login limpio, confirmar si le pasa también a Matías y Daniel, y recién ahí decidir el fix
