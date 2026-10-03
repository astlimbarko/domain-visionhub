# Gonzalo — 2026-10-03

- [x] KAN-469: verificado en vivo que el anuncio cierra instantáneo → Finalizada
- [x] KAN-498: fix estructural — asignar sublíder/anfitrión/encargado EXISTENTE fallaba para Pastor/Super Admin (RLS de INSERT no los incluye). Unificado por RPC fn_asignar_cargo_cdp/red. Migración a prod. Verificado en vivo (damaris). PR #149.
- [x] KAN-499: "Reenviar invitación" solo con invitación real pendiente (cascada invitacionId→tieneCuenta→nada). 4 paneles. PR #149.
- [x] PR #149 creado y mergeado a master (owner lo aceptó por GitHub)
- [x] Consolidación para deploy: mergeadas a master las 2 ramas de Daniel (KAN-497 bautismo + épica Evangelista personal KAN-427-434) + lo nuestro. 1 conflicto en App.tsx resuelto.
- [x] Reconciliación de migración: fn_guardar_membresia_nuevos había perdido Familia/Cónyuge porque una migración de KAN-497 pisó la de familiares (2 devs, misma función). Migración 20261003170000 restaura ambos (familiares + ci_no_recuerda). Aplicada a prod.
- [x] Aplicadas a producción TODAS las migraciones pendientes: KAN-497 (Afirmación) completo + Evangelismo (3 que faltaban). Sanidad verificada: 8 funciones clave OK.
- [x] Build consolidado + ZIP: visionhub-dist-2026-10-03.zip (el owner ya lo subió a cPanel)
- [x] Deploy: frontend subido por el owner; migraciones aplicadas por Claude. Todo en producción.
- [ ] Pendiente a decidir (KAN-499): botón "Dar acceso / Invitar" para personas existentes SIN cuenta (ej. damaris) — hoy quedan sin acción. Workaround: "Invitar por correo".
- [ ] Coordinación: avisar entre devs cuando se toque la misma función SQL (git no detecta el solape semántico).
