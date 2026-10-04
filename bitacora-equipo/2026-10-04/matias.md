# Matías — 2026-10-04

- [x] Reporte de CdP: el modal "¿es menor?" (KAN-422/435) no se encolaba al precargar un reporte en edición -- quedaba sin resolver y el backend tiraba error genérico sin decir quién
- [x] Dashboard Líder/Sublíder de CdP: 6 gráficos (sexo/edad/compromiso/seguimiento/ministerios/antigüedad) cargaban con lazy()+Suspense sin necesitarlo -- causaba salto de layout visible en celular; pasados a import estático
- [x] Encontrado y corregido: `master` local estaba 437 commits atrás de `origin/master` antes de este fix -- se hizo `git fetch` + `merge --ff-only` antes de tocar nada, para no pisar trabajo de Gonzalo/Daniel
- [x] Deploy a producción por SSH (app.somoscdv.com), verificado por hash de bundle
- [x] Merge local a master + push a origin/master (sin `gh`, mismo flujo de siempre)
- [x] Migración de /avances aplicada en producción (owner pasó token nuevo de Supabase) + marcada en el historial de migraciones
- [x] Encontrado (sin arreglar, fuera de alcance): el historial de migraciones está desincronizado en masa desde el 05-sep -- casi todo lo del último mes y medio no está registrado en `schema_migrations`, aunque sí esté aplicado. Anotado en memoria para no usar `--include-all` a ciegas
- [x] Fix: buscadores desplegables (Reportes CdP + otros 5) perdían el tap de selección en celular con el teclado abierto -- cambiado onBlur+setTimeout por "cerrar al tocar afuera" y onMouseDown por onClick; deployado, migración de /avances aplicada
- [ ] Ticket de Jira: sin crear (bloqueado por OAuth de Atlassian pendiente, ver memoria)
