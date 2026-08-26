# Gonzalo — 2026-08-25

- [x] KAN-252 (teléfono + ministerios, actualización única para membresías ya completadas): implementado Parte A y Parte B completas en rama `kan252`
- [x] Rediseñado el alta por invitación real: la Persona y el cargo ahora se crean al llenar la página 1 del asistente, no recién al final (`fn_aceptar_invitacion_lider`)
- [x] CI, fecha de nacimiento, ocupación, grado de instrucción, estado civil y teléfono ahora obligatorios en todas las iglesias (con "No aplica" donde corresponde)
- [x] "Ninguno"/"Ninguna" obligatorio agregado a Discipulados y Seminario/Universidad; agregado cargo "Líder de Ministerio"
- [x] Banderas de país reales (antes salían como texto "BO"/"AR" en Windows) para el selector de teléfono
- [x] Corregido bug real: 2 modales (membresía + anuncios) abiertos a la vez bloqueaban el cierre del banner
- [x] Antes de cerrar, evalué el riesgo en serio (2 iglesias reales comparten la misma Supabase) y encontré+corregí 3 bugs reales de producción: trigger que bloqueaba el guardado progresivo en todas las iglesias, trigger que bloqueaba "No aplica" en ocupación/grado, y una función sin `search_path` propio que rompía el guardado de ministerios
- [x] Creados KAN-258 (página 7 deformada), KAN-259 (probar en móvil), KAN-260 (encabezado no actualiza el nombre) para retomar
- [x] Todo commiteado (`8ebe7a5`), sin deploy de frontend
