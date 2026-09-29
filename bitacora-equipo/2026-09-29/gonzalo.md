# Gonzalo — 2026-09-29

- [x] Pulido visual de Altar (KAN-481): ondas de fondo a ancho completo, logo centrado en desktop, pestañas en una línea en mobile, badge sin aro blanco de más
- [x] Pestaña Datos de Altar: siempre trae lo último (sin caché) + clic en fila para abrir/editar persona + hover
- [x] Bug real: fn_puede_gestionar_afirmacion y fn_registrar_persona_afirmacion sin bypass de Super Admin → "AFIRMACIÓN_SIN_PERMISO". Corregido en producción (2 migraciones)
- [x] Harness 20 creado: RSIL, Fiesta de Bienvenida, Bautismo/Membresía + Colaborar por tarjetas (KAN-482 a 485)
- [x] Harness 21 creado: ampliar formulario de Altar a "membresía paralela", patrón ver/editar, relocalizar "Ocultar de búsquedas" (KAN-488/489) — lo termina Matías
- [x] Pointer en AfirmacionAltar.tsx + nota en CLAUDE.md: avisan de specs pendientes al abrir Afirmación
- [x] Jira: KAN-488/489 creados, KAN-482 a 485 comentados con ruta del spec
- [x] PR #138 mergeado a master (bugfix + pulido + specs)
- [ ] Falta (Matías): implementar harness 21 (form Altar ampliado). Falta 2da captura del final de form_altar.png si hace falta
- [ ] Pendiente: coordinar con Daniel el valor "CDP"/"Semilla" en tipo_evangelismo (harness 21)
- [ ] Sin resolver: parpadeo de tabla de Afirmación al hacer clic en chips (KAN-480, diferido)
- [ ] Pendiente owner: 2 registros de prueba de Altar en producción + duplicado usuario_rol de Marcia
