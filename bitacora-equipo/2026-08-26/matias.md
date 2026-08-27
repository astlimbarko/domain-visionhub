# Matías — 2026-08-26

- [x] Investigado el botón "Eliminar cuenta" del panel de Super Admin: nunca borraba `auth.users` de verdad (solo soft-delete de persona/usuario_rol/cargos, a propósito desde 2026-08-10) -- borrarlo de verdad choca con columnas de auditoría sin `ON DELETE CASCADE` en decenas de tablas
- [x] KAN-267: sacada la sección "Eliminar cualquier cuenta" de Administracion.tsx (pedido explícito, en vez de arreglarla)
- [x] Vinculada manualmente la cuenta `olvis.neu@gmail.com` (sin Persona, alta previa a medias) como Líder de CdP en Centro de Vida 4 Anillo / Red Yeshua -- KAN-269, verificado en vivo contra la base real
- [x] KAN-268/176: "Restablecer contraseña" ahora también en el Constructor (Líder/Supervisor de Red, Líder/Sublíder/Anfitrión de CdP, Encargado de Departamento) -- antes solo en Usuarios de Administración
- [x] KAN-268: lista de "Usuarios" del Super Admin reordenada -- pestañas por rol (Super Admin/Pastor/Supervisor) + paginado de a 8, en vez de una lista larga mezclada
- [x] `tsc -b`, `oxlint` y `vite build` limpios en los 3 puntos de código
- [x] Mergeado a `master` (rama `feat/kan267-268-269-restablecer-contrasena-y-usuarios`, sin PR por falta de `gh` CLI en esta máquina -- merge local + push directo)
- [x] Desplegado a producción por SSH (build + zip + cPanel, servidor 162.241.61.103) -- verificado en vivo que el bundle nuevo quedó publicado
- [x] KAN-270: encontrado el motivo real de "teléfono/ministerios no guardan" + "No se pudo cargar el resumen" tras el deploy -- producción estaba 19 migraciones atrasada (última aplicada 21/08, código ya asumía hasta 26/08, todo el bloque KAN-252 Membresía ampliada). Aplicadas las 19 a mano contra la base real, incluyendo 2 con drift real (fixes ya aplicados a mano en otra sesión sin quedar registrados) que hubo que parchear puntualmente
- [ ] Falta: probar en vivo en el navegador (Constructor + panel de Usuarios + teléfono/ministerios de Membresía) antes de pasar KAN-267/268/270 a Finalizada; revisar el slug de `casa_paz_url` de olvis.neu cuando complete su membresía con nombre real (quedó con placeholder "Pendiente Pendiente")
