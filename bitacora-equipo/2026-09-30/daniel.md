# Daniel — 2026-09-30

- [x] Token de Supabase de Gonzalo vinculado al proyecto "Centro de Vida" (`mkgdeunylrmuogrfmdnq`)
- [x] Detecté que el historial de migraciones del CLI está desincronizado desde el 2026-09-05 (134 migraciones ya aplicadas en la base real pero sin registrar en el ledger) -- confirmado que NO es código faltante (los 82 objetos que crean ya existen). Avisado a Gonzalo, queda pendiente de reparar el registro más adelante (decisión explícita: no tocar eso hoy)
- [x] Apliqué las 4 migraciones nuevas de Evangelista (KAN-427/430/432/434) directo contra la base real, una por una y en transacción, sin tocar el resto del historial
- [x] Encontré y arreglé un bug real durante la prueba: `fn_evangelista_historial_seguimiento` tenía una referencia ambigua a `id` (choca con la columna de salida del `RETURNS TABLE`) -- corregido y verificado
- [x] Probé el flujo completo end-to-end en la iglesia Génesis (nunca en 4 Anillo/Montero) con la cuenta `test@somoscdv.com`: otorgar rol, registrar persona evangelizada de prueba, historial, dashboard (racha/indicadores/serie diaria), registrar y leer seguimiento -- todo funcionando
- [x] Limpié todos los archivos SQL sueltos que usé para probar (no quedó nada fuera de las 4 migraciones + edge function)
- [ ] Falta: todo el frontend (UI v2 base, dashboard, nueva persona, historial, seguimiento, panel de credenciales) -- KAN-428/429/430/431/432/433
- [ ] Falta: deployar el edge function `crear-credencial-evangelista` y probarlo end-to-end (la creación de cuenta real todavía no se probó, solo las funciones SQL de soporte)
- [ ] Falta: Jira (sin integración conectada en esta sesión)
- [ ] Falta: entradas en `/avances`
