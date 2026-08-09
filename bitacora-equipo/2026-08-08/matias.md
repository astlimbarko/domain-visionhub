# Matías — 2026-08-08

- [x] KAN-117 ("No llega el correo al asignar un liderazgo"): investigué a fondo. No era plantilla faltante en Supabase (como se sospechaba en el ticket) — el aviso por correo (REQ-ASG-7/KAN-89) solo estaba conectado para Líder/Supervisor de Red, nunca para Líder/Sublíder de CdP ni Pastor/Supervisor de la Visión en Acción vía "persona ya registrada".
- [x] Fix: 2 funciones SQL nuevas (`fn_estructura_datos_notificacion_cargo_cdp`/`_principal`) + extendí la Edge Function `notificar-asignacion-cargo` + conecté las llamadas en `PanelCasaDePazEstructura.tsx` y `PanelPrincipalEstructura.tsx`, reusando el mismo patrón SMTP (Brevo) ya verificado en vivo para Red.
- [x] Build (`tsc -b && vite build`) limpio. Commit local `79facd6` en `feature/supervisor-vision-accion` (sin push).
- [x] KAN-117 actualizado en Jira: comentado, pasado a "En revisión" (no "Finalizada" — falta probarlo en vivo), assignee Gonzalo.
- [ ] Falta: verificar en vivo el envío real (asignar Líder de CdP y Pastor/Supervisor a alguien ya registrado, confirmar que llega el correo) antes de pasar KAN-117 a Finalizada.
- [x] Nota: en paralelo hubo otra sesión trabajando en el mismo repo que comiteó directo (`14e2e71` KAN-95 banner de color en panel de CdP, `ba6e759` KAN-73/114/116/128 — rol activo en menú de cuenta, menú de Afirmación, orden del selector de Supervisor de Red, sesión móvil de Super Admin). No es trabajo mío, lo dejo anotado para que quede claro de dónde salen esos commits.
