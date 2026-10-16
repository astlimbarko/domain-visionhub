# Daniel — 2026-10-16

- [x] Gonzalo pasó el token de Supabase CLI (`basura_no_leer/token_supabase.txt`)
- [x] KAN-433: aplicada la migración `20261013100000_evangelista_rol_selector.sql` contra la base real -- `fn_mis_iglesias_detalle()` ya expone `es_evangelista`
- [x] Encontrado antes de aplicar: la función ya tenía una columna `es_lider_envio` sin ninguna migración en el repo (trabajo de otra persona del equipo, Depto. "Envío", aplicado directo en prod) -- se corrigió el archivo para preservarla intacta, no se tocó nada de Envío
- [x] Verificado en vivo en Génesis (cuenta `test@somoscdv.com`): "Mi Evangelismo" aparece en el selector, entra bien al panel (título/color/sin sidebar), y ya NO se puede entrar a `/evangelista` desde otro rol (probado con Líder de CdP -- redirige)
- [x] KAN-433 → Finalizada en Jira
- [ ] Falta: deployar la función `crear-credencial-evangelista` (la hace Gonzalo cuando mergeemos y abramos el PR)
- [ ] Falta: escribir las entradas de `/avances` del módulo completo -- encontrado un problema de alcance antes de escribirlas: `/avances` con alcance `EVANGELISMO` hoy solo lo ven Líder de Depto./Supervisión, NO los Evangelistas comunes (el rol nuevo) -- 3 opciones sobre la mesa (GLOBAL / EVANGELISMO tal cual / alcance nuevo `EVANGELISTA`), **pausado a la espera de que confirme Gonzalo**
- [ ] Falta (después de eso): merge de `master` a la rama + abrir el PR (opción A confirmada: Gonzalo revisa y mergea él, recién ahí hace el deploy)
- Servidor de prueba (`localhost:5174`) apagado al cerrar la sesión
