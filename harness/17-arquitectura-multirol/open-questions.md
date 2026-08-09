# 17 — Arquitectura multirol y contexto activo — open-questions.md

> Estas preguntas bloquean decisiones de arquitectura. No se resuelven por conveniencia de implementación.

## Cerrado por el diagnóstico

- **Q-MR-01 — ¿Un Rol UI basta para la sesión?** No. Una persona puede tener varias asignaciones del mismo tipo; se requiere contexto completo.
- **Q-MR-02 — ¿Se puede mezclar navegación de roles?** No. Cada panel activo tiene navbar, sidebar, rutas y datos aislados.
- **Q-MR-03 — ¿El frontend autoriza?** No. Solo presenta; Supabase/RPC/RLS continúan validando permisos reales.
- **Q-MR-04 — ¿Se requiere una migración ya?** No. Primero se audita si los IDs existentes bastan para validar cada asignación.

## Pendientes del owner

- **Q-MR-05 — Afirmación.** ¿Es un panel/rol independiente con selector, navbar y sidebar propios, o una capacidad dentro de otro panel? La propuesta técnica es panel independiente si posee navegación propia.
- **Q-MR-06 — Jóvenes.** ¿Es panel/rol independiente o capacidad sin panel?
- **Q-MR-07 — Matrimonios.** ¿Es panel/rol independiente o capacidad sin panel?
- **Q-MR-08 — Selector interno.** Cuando un Líder de Red tiene varias Redes, ¿el panel debe mostrar exclusivamente la Red elegida o permitir un selector interno para ver las otras Redes que lidera? Propuesta: contexto aislado por Red; selector interno solo en pantallas cuyo requisito lo justifique.
- **Q-MR-09 — Enlaces directos.** ¿En una fase futura se podrán compartir URLs que incluyan Red/CdP? Propuesta: no es necesario para la primera entrega; cualquier URL futura exige validación de permiso equivalente.

## Regla para nuevas preguntas

Todo cargo nuevo debe responder antes de implementarse: ¿tiene panel propio?, ¿cuál es su alcance?, ¿puede tener múltiples asignaciones?, ¿qué rutas y datos ve?, ¿qué color e identidad visual usa? Sin esas respuestas no se agrega al selector ni al sidebar.
