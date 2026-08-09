# 17 — Arquitectura multirol y contexto activo — requirements.md

> Requisitos verificables para impedir que una persona con varios cargos vea interfaces, navegación o datos mezclados. Fuente del diagnóstico: código existente auditado el 2026-08-08.

## Conceptos

- **Rol UI:** tipo de panel (`SUPERVISOR`, `LIDER_RED`, `LIDER_CDP`, etc.).
- **Asignación:** cargo real de una persona sobre una iglesia, departamento, Red o Casa de Paz.
- **Contexto activo:** selección completa que identifica el panel y su alcance. No es sinónimo de Rol UI.

## Requisitos funcionales

**REQ-MR-01 — Contexto completo.** El sistema SHALL representar el contexto activo con una clave estable, Rol UI, `iglesiaId` cuando corresponda y el ID de la entidad de alcance (`redId`, `cdpId` o `departamentoId`) cuando aplique.

**REQ-MR-02 — Asignaciones diferenciadas.** WHEN una persona tenga dos o más asignaciones del mismo Rol UI, THEN el selector SHALL mostrar una opción por asignación, sin colapsarlas en una sola opción genérica.

**REQ-MR-03 — Persistencia validada.** WHEN la persona recargue, abra una URL interna, vuelva atrás o inicie una sesión nueva, THEN el sistema SHALL restaurar el contexto persistido solo si sigue siendo válido según sus roles reales.

**REQ-MR-04 — Invalidación.** IF una asignación, iglesia o entidad ya no está vigente, THEN el sistema SHALL limpiar el contexto dependiente y redirigir al selector o a una alternativa autorizada; SHALL NOT reutilizar el último Rol UI.

**REQ-MR-05 — Cambio de iglesia.** WHEN cambie `iglesiaActivaId`, THEN SHALL invalidar cualquier contexto cuyo alcance pertenezca a otra iglesia antes de renderizar navegación o datos.

**REQ-MR-06 — Navegación aislada.** WHERE existe un contexto activo válido, el sidebar, navbar, título, rutas y acciones SHALL provenir exclusivamente de su configuración. Un cargo adicional SHALL NOT inyectar ítems de navegación.

**REQ-MR-07 — Tema coherente.** WHEN se cambie de contexto, THEN el color de navbar y demás identidad visual SHALL cambiar con el contexto; no podrá quedar estilo residual del contexto anterior.

**REQ-MR-08 — Alcance de datos.** Toda página que opere sobre una Red, CdP o departamento SHALL usar el ID del contexto activo o un selector interno explícitamente permitido. SHALL NOT inferir la entidad mediante el primer elemento disponible de una lista.

**REQ-MR-09 — Rutas.** WHEN se navegue a una ruta protegida, THEN la guarda SHALL comprobar que la ruta pertenece al contexto activo y que la asignación real del usuario le autoriza el alcance solicitado.

**REQ-MR-10 — Super Admin.** El panel de Super Admin SHALL mantener alcance global y una configuración propia. No forma parte de la jerarquía de una iglesia y no se debe convertir en Pastor/Supervisor por selección implícita.

**REQ-MR-11 — Autoridad de backend.** La UI SHALL NOT ser la única barrera de autorización. Las RPC y políticas RLS SHALL verificar usuario, iglesia y entidad de alcance con los datos oficiales.

**REQ-MR-12 — Cambio de contexto.** WHEN el usuario elija otro contexto, THEN la aplicación SHALL actualizar navegación y tema, invalidar caché sensible del contexto anterior y llevarlo a la ruta inicial del nuevo panel.

## Matriz inicial de alcance

| Panel / Rol UI | Alcance obligatorio | Estado de decisión |
|---|---|---|
| Super Admin | Global | Cerrado |
| Pastor | Iglesia | Cerrado |
| Supervisor de la Visión en Acción | Iglesia | Cerrado |
| Líder de departamento | Departamento + iglesia | Cerrado como modelo; revisar UI |
| Líder de Red | Red + iglesia | Cerrado |
| Líder de Casa de Paz | CdP + Red + iglesia | Cerrado |
| Sublíder de Casa de Paz | CdP + Red + iglesia | Cerrado |
| Afirmación | Pendiente: panel propio o capacidad | Requiere decisión |
| Jóvenes | Pendiente: panel propio o capacidad | Requiere decisión |
| Matrimonios | Pendiente: panel propio o capacidad | Requiere decisión |

## Criterios globales de aceptación

- Una persona con Supervisor + Líder de Red ve dos paneles aislados.
- Una persona líder de dos Redes puede elegir cada Red y la recarga conserva la misma Red, nunca la primera de la lista.
- Una persona líder de una CdP y sublíder de otra distingue ambas elecciones.
- Ningún sidebar reúne menús de roles distintos sin una decisión funcional explícita y documentada.
- Los datos de una iglesia, Red o CdP no se filtran hacia otro contexto.
