# 17 — Arquitectura multirol y contexto activo — open-questions.md

> Estas preguntas bloquean decisiones de arquitectura. No se resuelven por conveniencia de implementación.

## Cerrado por el diagnóstico

- **Q-MR-01 — ¿Un Rol UI basta para la sesión?** No. Una persona puede tener varias asignaciones del mismo tipo; se requiere contexto completo.
- **Q-MR-02 — ¿Se puede mezclar navegación de roles?** No. Cada panel activo tiene navbar, sidebar, rutas y datos aislados.
- **Q-MR-03 — ¿El frontend autoriza?** No. Solo presenta; Supabase/RPC/RLS continúan validando permisos reales.
- **Q-MR-04 — ¿Se requiere una migración ya?** No. Primero se audita si los IDs existentes bastan para validar cada asignación.
- **Q-MR-05 — Afirmación.** Panel independiente con alcance de departamento + iglesia.
- **Q-MR-06 — Jóvenes.** Panel independiente de alcance iglesia; actualmente solo lectura.
- **Q-MR-07 — Matrimonios.** Panel independiente de alcance iglesia; actualmente solo lectura.
- **Q-MR-08 — Selector interno.** Cada asignación de Red o CdP es un `ContextoActivo` separado. No existe selector interno para cambiar de asignación; los selectores de supervisión autorizados dentro del alcance activo permanecen.
- **Q-MR-10 — ¿Los colores de Red definen el navbar?** No. Son dinámicos y pertenecen a la entidad Red.
- **Q-MR-11 — Colores todavía no definidos.** Usan temporalmente blanco nieve `#FFFAFA`; el owner confirmará la paleta definitiva después.

## Pendientes del owner

- **Q-MR-09 — Enlaces directos.** ¿En una fase futura se podrán compartir URLs que incluyan Red/CdP? Propuesta: no es necesario para la primera entrega; cualquier URL futura exige validación de permiso equivalente.

## Regla para nuevas preguntas

Todo cargo nuevo debe responder antes de implementarse: ¿tiene panel propio?, ¿cuál es su alcance?, ¿puede tener múltiples asignaciones?, ¿qué rutas y datos ve?, ¿qué color e identidad visual usa? Sin esas respuestas no se agrega al selector ni al sidebar.

## Cerrado durante KAN-135

- **Q-MR-13 — Aprobaciones de Red.** Resuelta mediante autorización
  transaccional ligada a la solicitud pendiente y coincidencia exacta del
  payload. El Líder aprobador no recibe permisos de Supervisor.
- **Q-MR-12 — Personas para cargos CdP.** Decisión del owner (2026-08-15):
  busca prioritariamente entre los miembros de la propia Casa de Paz; si ahí
  no aparece nadie, cae a toda la iglesia (puede visitar la CdP alguien de
  otra y hay que poder anotarlo igual). No se tocó `persona`/RLS -- la
  visibilidad de toda la iglesia se mantiene a propósito (`pol_persona_select`
  ya scopeaba solo por `iglesia_id`, sin restricción de CdP). Implementado en
  el frontend: `buscarPersonas` (`casas-de-paz.service.ts`) acepta un
  `cdpId` opcional y hace una primera consulta acotada a esa CdP
  (`casa_de_paz_membresia!inner`, `es_principal=true`); si no hay resultados,
  cae a la consulta de toda la iglesia de siempre. Propagado desde
  `BuscadorPersona` → `AsignarCargoDialog` → los 3 lugares donde se asigna
  Líder/Sublíder/Anfitrión de CdP (Constructor, `GestionRedVista.tsx`,
  `GestionEstructuraVista.tsx`) y la autogestión del propio Líder de CdP
  (`GestionSubliderVista.tsx`).
