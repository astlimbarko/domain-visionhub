# Matías — 2026-10-04

- [x] Reporte de CdP: el modal "¿es menor?" (KAN-422/435) no se encolaba al precargar un reporte en edición -- quedaba sin resolver y el backend tiraba error genérico sin decir quién
- [x] Dashboard Líder/Sublíder de CdP: 6 gráficos (sexo/edad/compromiso/seguimiento/ministerios/antigüedad) cargaban con lazy()+Suspense sin necesitarlo -- causaba salto de layout visible en celular; pasados a import estático
- [x] Encontrado y corregido: `master` local estaba 437 commits atrás de `origin/master` antes de este fix -- se hizo `git fetch` + `merge --ff-only` antes de tocar nada, para no pisar trabajo de Gonzalo/Daniel
- [x] Deploy a producción por SSH (app.somoscdv.com), verificado por hash de bundle
- [x] Merge local a master + push a origin/master (sin `gh`, mismo flujo de siempre)
- [ ] Migración de /avances (changelog para usuarios) creada pero NO aplicada -- token de la CLI de Supabase expiró (401), hace falta `supabase login` de nuevo
- [ ] Ticket de Jira: sin crear (bloqueado por OAuth de Atlassian pendiente, ver memoria)
