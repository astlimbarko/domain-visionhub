# Matías — 2026-09-02

- [x] Diagnostiqué 3 bugs reportados por el owner (evangelizados, metas, supervisor de red)
- [x] Metas de evangelismo: RPC `fn_asignar_meta_cdp`/`fn_asignar_meta_red` para reasignar el mismo período sin error de "solapamiento" (baja lógica de la meta vigente + reinsert); migración aplicada en prod y probada con ROLLBACK
- [x] Frontend: `asignarMetaEvangelismo`/`asignarMetaRedEvangelismo` ahora llaman a los RPC
- [x] Evangelizados de líder de CdP no se guardaban: causa raíz = INSERT de persona sin `membresia_completada:false` (default true) + CI obligatorio → trigger rechaza. Fix ya venía en working tree (usa RPC `fn_registrar_evangelizado`); se despliega con este build
- [x] Supervisor de la Red en Acción "no ve reportes": causa real = los reportes eran de reuniones de agosto (cargados tarde) y Control de Reportes abría siempre en el mes actual (septiembre, vacío). Fix: abre en el mes del último reporte de la red (`useUltimaFechaReporteRed` + efecto en `ControlReportesVista`)
- [x] Bug de fondo: nada impedía 2 reportes para la misma CdP+fecha (el índice único de la spec nunca se desplegó). Había 5 grupos duplicados en prod. Migración `20260902010000`: `fn_anular_reporte_cdp` (baja lógica, mismo permiso/ventana que editar), dedup de los 5 grupos (conserva el más completo), e índice único `uq_reporte_cdp_fecha`
- [x] Frontend: botón "Anular reporte" en edición (confirmación inline), aviso de fecha duplicada al crear, `anularReporte`/`obtenerUltimaFechaReporteRed` en servicio + hooks
- [x] Migraciones `20260902000000` (metas) y `20260902010000` (anular/unicidad) aplicadas en prod; duplicado de Lineme resuelto (queda el de 8 asistentes)
- [x] Merge a master + build + deploy SSH de frontend (2 deploys)
- [x] Fichas de persona: "no se podían editar" era el candado de frontend (solo operativos). Decisión del owner: Líder/Supervisor de Red también editan las fichas de personas de SU red. `FichaPersonaSheet.puedeEditar` ahora incluye `redes_lider` cuando la persona pertenece a esa red (RLS ya lo permitía; verificado el UPDATE impersonando líder de red). Deployado
- [ ] Falta: parte VISUAL de las fichas ("que se vea mejor") — no se pudo ver sin la extensión de Chrome conectada; pendiente reproducir/describir
- [ ] Falta: prueba en vivo por un usuario real (supervisor viendo agosto, líder anulando un duplicado, reasignar meta, líder de red editando una ficha) y tickets de Jira cuando habiliten Atlassian
