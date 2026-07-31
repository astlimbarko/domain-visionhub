# Gonzalo — 2026-07-30

- [x] Verifiqué la configuración de SMTP (Brevo) y confirmé envío real funcionando
- [x] Detecté por qué el remitente salía como `...@brevosend.com` en vez del dominio propio (Brevo reescribe si el dominio no está autenticado)
- [x] Autenticé `somoscdv.com` en Brevo (DKIM + DMARC) — remitente ya sale como `acceso@somoscdv.com` sin reescritura
- [x] Corregí `sender_name` en Supabase a "Centro de Vida 4 Anillo" (antes decía "Centro de Vida Santa Cruz 4 Anillo")
- [x] Creé la página "en construcción" (`sitio-construccion/`) con el logo y la ilustración, animaciones, responsive — fix de altura (desbordaba el viewport) y fix del logo (se veía recortado)
- [x] Diagnóstico de login con Google: encontré que el registro público estaba abierto (`enable_signup`/`disable_signup=false`) y que Google ya estaba habilitado en vivo — cualquiera podía crear una cuenta sin invitación
- [x] Implementé las 5 plantillas de correo de Supabase Auth en español (invite, recovery, email_change, password_changed, email_changed) — identidad "Centro de Vida 4 Anillo", sin "VisionHub" en ningún lado. Aplicadas y verificadas en el Supabase real
- [x] Cerré el registro público (`disable_signup = true`) — cierra también el hueco de Google OAuth sin invitación
- [x] Agregué cooldown visual de 30s a los 4 botones que mandan correo (invitación/restablecer) — `useCooldownMap` + `BotonReenvio`
- [x] Corregí el SPF de `somoscdv.com` agregando `include:spf.brevo.com` (los correos estaban cayendo en spam)
- [x] Agregué `app.somoscdv.com` a la Site URL y a la lista de redirects permitidos de Supabase, para que Matías pueda armar el login de Google mañana sin trabarse
- [x] Definí junto con Gonzalo el sistema de bitácora de equipo (`bitacora-equipo/`) y creé `CLAUDE.md` con las reglas del proyecto

## Pendiente

- [ ] Revisar por qué 2 de 3 cuentas de prueba de `credenciales.txt` ya no loguean (¿se borraron o cambió la contraseña?)
- [ ] Construir el módulo de Pastor/Supervisor (recordatorio para el 2026-07-31)
- [ ] Retomar la prueba de invitación real a `niukaoj@gmail.com` cuando exista una cuenta con permiso de invitar en Montero
- [ ] Subir el build real de la app a `app.somoscdv.com` (hoy solo tiene la página "en construcción")
- [ ] Revocar el token de management `sbp_9949...` usado hoy (Supabase → Account → Access Tokens)
- [ ] Abrir PR a `master` con el trabajo de Afirmación (arrastrado de sesiones anteriores)
