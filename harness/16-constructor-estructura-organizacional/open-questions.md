# 16 — Constructor de Estructura Organizacional — open-questions.md

> Registro de decisiones del owner. Las decisiones funcionales bloqueantes se
> cerraron con Gonzalo el 2026-08-04. Lo que permanece abierto está marcado como
> no bloqueante o como decisión futura explícitamente fuera de alcance.

## Decisiones cerradas

- ✅ **Un organigrama por iglesia.** Madre, hija y satélite tienen layouts
  independientes. La madre puede administrar una satélite dentro de su alcance,
  pero abre siempre el organigrama propio de esa iglesia.
- ✅ **Layout canónico compartido.** Super Admin y Supervisor ven y editan las
  mismas posiciones. La cámara/zoom puede ser local por usuario.
- ✅ **Cuadrícula.** Las posiciones se ajustan a una cuadrícula tenue o invisible.
- ✅ **Creación incremental.** El nuevo nodo se auto-ubica sin mover los existentes.
  “Organizar automáticamente” es una acción separada y confirmada.
- ✅ **Escala abierta.** Son válidos cero redes/cero CdP y también N redes con N
  CdP por red.
- ✅ **Orientación horizontal.** Pastor → Supervisor → contenedores Departamentos
  y Redes → entidades hijas.
- ✅ **Roles administradores.** Super Admin y Supervisor de la Visión. El Pastor
  no se implementa hasta definir su comportamiento.
- ✅ **Pastor protegido.** El Supervisor puede verlo, pero no modificarlo; solo
  el Super Admin puede asignarlo o cambiarlo.
- ✅ **Varios Supervisores en base, uno en UI inicial.** No cerrar el modelo por
  una práctica actual que todavía puede cambiar.
- ✅ **Cuatro departamentos permanentes.** Sin líder se ven tenues; con líder,
  intensos. El estado visual no modifica `departamento.activo`.
- ✅ **Entidades sin líder.** Red, CdP y demás entidades pueden existir incompletas.
- ✅ **CdP progresiva.** Líder, anfitrión, dirección y sublíderes pueden añadirse
  después de crearla.
- ✅ **CdP sin nombre propio.** La referencia principal es el nombre del líder y
  debajo se muestra la dirección breve del anfitrión o lugar de reunión. Sin
  líder/dirección se muestran estados pendientes; nunca se solicita nombre de CdP.
- ✅ **Supervisor de Red.** Es el cargo existente `SUBLIDER_RED`; no se crea enum
  ni rol nuevo. Etiqueta UI oficial: “Supervisor de Red”.
- ✅ **Asignación, no invitación voluntaria.** La iglesia designa. El destinatario
  solamente confirma que vio la designación y completa su cuenta.
- ✅ **Estados visibles.** Gris = confirmación pendiente; verde = confirmada. No
  existe rojo/rechazo.
- ✅ **Permisos diferidos.** El lugar organizacional se reserva inmediatamente,
  pero los permisos se habilitan después de confirmar lectura y completar/vincular cuenta.
- ✅ **Reenvío/corrección.** Se puede reenviar, corregir correo o cancelar; los
  enlaces anteriores se invalidan.
- ✅ **Doble vía para todos los cargos.** Buscar persona existente mostrando
  nombre+correo o designar por correo.
- ✅ **OTP local al módulo.** Switch por iglesia, apagado por defecto, operable
  por Super Admin y Supervisor. Activar no pide OTP; desactivar cuando ya está
  activo sí lo exige. No altera otros paneles.
- ✅ **Minimalismo.** Acciones secundarias viven en panel de detalle, no en cada tarjeta.
- ✅ **Móvil.** El lienzo no se comprime; se navega con pan/zoom y usa modo
  organizar para evitar conflicto entre desplazamiento y arrastre de nodos.

## Decisiones técnicas adoptadas en el diseño

- **React Flow (`@xyflow/react`)** como motor de lienzo: aporta nodos controlados,
  pan, zoom/pinch, `fitView`, fondo cuadriculado, selección y nodos personalizados.
- **Layout automático determinista** separado del estado manual. Las conexiones
  las deriva el dominio; el usuario no dibuja relaciones libres.
- **Posiciones normalizadas en Supabase**, no un JSON gigante, con versión
  optimista para impedir sobrescrituras silenciosas.
- **RLS por iglesia** y escritura limitada a Super Admin/Supervisor.
- **RPC específicas del constructor** para respetar el switch OTP sin debilitar
  RPC existentes de otros módulos.

## No bloqueantes antes de implementar

- **OQ-PASTOR** — definir en una futura sesión si el Pastor tendrá acceso de solo
  lectura o alguna capacidad administrativa. Por ahora no se implementa.
- **OQ-LAYOUT-GRANDE** — fijar con pruebas reales el umbral para mostrar MiniMap
  (propuesta: cuando haya más de 20 nodos o a solicitud del usuario).
- **OQ-AUTOGUARDADO** — confirmar en pruebas de usabilidad el debounce de guardado
  de posición (propuesta: guardar 300–500 ms después de finalizar el arrastre,
  nunca durante cada píxel del movimiento).
- ✅ **Nombre de rama cerrado.** Rama activa:
  `feature/estructura-organizacional`.

## Regla de cambio

Una decisión cerrada no se cambia silenciosamente. Cualquier modificación debe
registrar fecha, responsable, razón y documentos/Jira afectados.
