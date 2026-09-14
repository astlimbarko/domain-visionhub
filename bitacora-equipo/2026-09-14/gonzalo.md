# Gonzalo — 2026-09-14

- [x] KAN-376 seguimiento: extendido el checkbox "asignar contraseña directamente" (Líder/Sublíder CdP) para también crear la Persona real (nombre/apellido/sexo) + el cargo real de una sola vez, sin dejar invitación PENDIENTE -- pedido explícito tras el caso de Felipa (cancelar invitación le hubiera borrado la contraseña sin poder mantenerla con rol asignado)
- [x] Bug real corregido de paso: loop infinito de pantalla parpadeante para cuentas sin Persona ni rol resuelto (contradicción entre el guard de `Dashboard.tsx` y `SeleccionarRol.tsx`)
- [x] Diálogo "Cambiar" (Líder de CdP) ahora permite cancelar una invitación pendiente directamente, no solo cambiar un cargo ya confirmado
- [x] Nueva función `fn_alta_directa_lider_cdp`, 2 migraciones aplicadas a producción (la 2da corrige un bug real de cast de enum sin calificar esquema, `sexo_enum` -> `public.sexo_enum`, necesario porque la función corre con `search_path=''`)
- [x] Verificado en vivo end-to-end con Playwright + confirmado por SQL: Persona y cargo reales creados, invitación queda COMPLETADA de entrada. Cuentas de prueba limpiadas (soft-delete de filas de dominio); 2 cuentas de Auth de prueba quedaron huérfanas e inofensivas, no se pudieron borrar por FK (mismo patrón ya visto antes)
- [x] PR #57 actualizada (commit 5d4071b) y pusheada. Jira KAN-376 comentado, sigue "En revisión"
- [ ] Falta aplicar esto a la cuenta real de Felipa (leonosinagafelipa@gmail.com) antes de cerrar del todo
- [ ] Cola: acortar el texto del checkbox (sigue pendiente de antes)
