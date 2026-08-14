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

## Pendientes descubiertos en KAN-135

- **Q-MR-12 — Personas para cargos CdP.** ¿Líder y Sublíder de Casa de Paz
  pueden buscar/crear personas de toda la iglesia o únicamente ver miembros de
  su CdP? El frontend actual dice “toda la iglesia”, pero el contexto canónico
  es CdP. No cambiar `persona`/`fn_buscar_personas` hasta decisión del owner.

## Cerrado durante KAN-135

- **Q-MR-13 — Aprobaciones de Red.** Resuelta mediante autorización
  transaccional ligada a la solicitud pendiente y coincidencia exacta del
  payload. El Líder aprobador no recibe permisos de Supervisor.
