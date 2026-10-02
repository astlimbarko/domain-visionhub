# Daniel — 2026-09-29

- [x] Leí requirements/technical-design/open-questions de 19-evangelista-personal + las 3 imágenes + bocetoInvitacion + bannerEvangelismo
- [x] Resolví con Daniel las preguntas abiertas #3 (invitación sin cuenta), #6/#7 (tipo de evangelismo obligatorio, sin Semilla), #9 (estadísticas cuentan bajo la CdP del evangelista)
- [x] Rama `feat/kan427-434-evangelista-personal-2026-09-29`
- [x] Migración KAN-427: tabla `persona_evangelista` + `fn_es_evangelista_en`/`fn_puede_otorgar_evangelista`/`fn_otorgar_evangelista`/`fn_revocar_evangelista`
- [x] Migración KAN-434: `fn_evangelista_datos_persona`/`fn_evangelista_vincular_usuario` + edge function `crear-credencial-evangelista`
- [x] Migración KAN-430: `fn_evangelista_registrar_persona`/`fn_evangelista_historial`/`fn_evangelista_dashboard`
- [x] Migración KAN-432: tabla `evangelismo_seguimiento` + `fn_evangelista_registrar_seguimiento`/`fn_evangelista_historial_seguimiento`
- [ ] Falta: aplicar las 4 migraciones contra la base real (sin credenciales de `supabase db push` en esta sesión -- confirmar con Daniel cómo se corre)
- [ ] Falta: todo el frontend (UI v2 base, dashboard, nueva persona, historial, seguimiento, panel de credenciales) -- KAN-428/429/430/431/432/433
- [ ] Falta: Jira (sin integración conectada en esta sesión, avisar antes de cerrar)
- [ ] Falta: entradas en `/avances`
