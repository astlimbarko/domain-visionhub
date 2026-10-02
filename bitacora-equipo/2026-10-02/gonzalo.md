# Gonzalo — 2026-10-02

Rama: `feat/membresia-mejoras-ux-2026-10-02`. Trabajo en paralelo con 3 agentes
(Lisa=menú, Lisa-2=teléfono, Copérnico=correo), mergeados a la rama.

- [x] Form de membresía: todos los campos obligatorios con `*` (salvo 2º nombre/apellido y correo)
- [x] Check "No tiene celular" (deshabilita y limpia el número)
- [x] Correo opcional + correo de bienvenida al registrar (reusa notificar-membresia-completada)
- [x] Sección Familia + Cónyuge (persiste en referencia_familiar, RPC nueva)
- [x] Teléfono "Otro país" en los 5 formularios que faltaban (KAN-492)
- [x] Menú Afirmación: sacado Dashboard, submenú anidado "Membresía por enlace", antiguo→"(antiguos)" (KAN-491)
- [x] Portada de Afirmación ("AFIRMACIÓN" + logo de marca + iglesia)
- [x] Renombrado: "Membresía (Nuevos)" → "Formulario de membresía" / menú "Form. de Membresía"
- [x] Bug arreglado: botones flotaban sobre los campos → al final del form (KAN-494)
- [x] Faltaban 3 asteriscos (Ocupación, Grado, ¿Cómo llegó?) → corregidos
- [x] Jira KAN-491 a 495 creados (495 = lentitud Colaboradores, reportado por el owner)
- [x] Migración de /avances agregada (KAN-491/492/493/494)
- [x] Build de producción + merge a master + push
- [x] Jira KAN-491/492/493/494 comentados y movidos a "En revisión"; KAN-495 en "Tareas por hacer"
- [x] Migraciones aplicadas a Supabase: Familia (referencia_familiar), motivo de llegada en precarga, /avances
- [x] ZIP de deploy generado para subir a cPanel: visionhub-dist-2026-10-02.zip (2.57 MB, con .htaccess)
- [ ] Deploy real: lo sube el owner a cPanel (public_html); CI/CD automático en pausa por facturación de GitHub
- [ ] Pendiente: KAN-495 (investigar lentitud al abrir Colaboradores) — sin empezar
- [x] KAN-469 (demora al cerrar anuncio): el fix (cierre optimista) ya estaba en master; verificado en vivo que cierra en 1 frame → movido a Finalizada
