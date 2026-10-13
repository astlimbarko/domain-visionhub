# Daniel — 2026-10-13

- [x] Merge de `master` a `feat/kan427-434-evangelista-personal-2026-09-29` (fast-forward, sin conflictos) -- trajo KAN-497 ya mergeado (PR #150), Panel de Eventos v2, fixes de CdP y buscadores mobile
- [x] KAN-433: "Mi Evangelismo" deja de ser excepción universal/botón aparte y pasa a ser un rol más del selector multirol (mismo patrón que Líder de Jóvenes/Encargado de Matrimonios) -- pedido explícito de Gonzalo. 8 archivos de frontend + 1 migración nueva. `tsc -b` limpio
- [ ] Falta: aplicar la migración `20261013100000_evangelista_rol_selector.sql` (bloqueado por token de Supabase CLI) y probar en vivo en Génesis
- [ ] Falta: commit + push (sin hacer todavía, a la espera de confirmación)
- [ ] Pendiente (fuera de esta sesión): deploy del edge function `crear-credencial-evangelista`, verificación visual contra mockups
