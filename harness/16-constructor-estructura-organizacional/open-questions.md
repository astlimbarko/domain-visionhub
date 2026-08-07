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
- ✅ **Cuatro departamentos permanentes.** Color oficial sólido siempre, tengan
  o no líder asignado (revisado 2026-08-05, ver REQ-DEP-4). El estado visual no
  modifica `departamento.activo`.
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

## Hallazgos de prueba real del owner (2026-08-05, Redes)

Gonzalo probó en vivo cambiar el Líder de Red de "Red Vida Nueva" (vía
"Desde base de datos") y encontró 3 cosas reales, en cola, no bloqueantes:

- **OQ-NOTIFICAR-ASIGNACION-BD** — al asignar un cargo por vía "Desde base de
  datos" a una persona que YA tiene cuenta, no se envía ningún correo de
  notificación. Esto es una brecha real contra REQ-ASG-7 (notificar el nuevo
  cargo a alguien que ya está registrado) — hoy la vía BD del panel de Red
  solo hace el INSERT, sin ningún aviso. No es un problema de plantilla
  faltante en Supabase (hipótesis del owner); es que esa vía nunca llama a
  ningún envío de correo. Falta implementar.
- **OTP único confirmado por diseño, no es un bug** — el owner esperaba 2
  códigos (uno para quitar, uno para asignar) y no llegó ninguno. Cero es
  correcto hoy porque el switch OTP del módulo está apagado por defecto
  (REQ-OTP-1). Cuando se active, `fn_estructura_asignar_cargo_red` solo va a
  pedir **un** código (la baja del anterior y el alta del nuevo son atómicas
  en la misma RPC) — evita a propósito el patrón de "2 OTP para una sola
  acción" que ya mordió al equipo antes.
- **OQ-CONFIRMAR-CAMBIO-CARGO** — falta un paso de confirmación ("¿Seguro que
  querés quitar a X / asignar a Y?") antes de ejecutar el cambio, tanto al
  asignar como al quitar un cargo. Hoy se aplica al toque de seleccionar en
  la búsqueda. El patrón ya existe en otras pantallas (`ConfirmarCambioDialog`,
  `ConfirmarQuitarDialog` en `components/shared/`) — pero esos dos exigen un
  motivo escrito y atan el OTP a si el actor es Super Admin, no al switch
  `otpRequerido` del módulo (que es el criterio correcto acá) — no encajan
  tal cual. **2026-08-05:** se implementó un modal de confirmación liviano
  propio (sin motivo, OTP atado a `otpRequerido`) para "Cambiar nombre" de
  Red en `PanelRedEstructura.tsx` — sirve de referencia si se decide extender
  el mismo patrón a asignar/quitar cargo acá. **2026-08-06 — resuelto para
  quitar cargo:** `ConfirmarQuitarDialog` (compartido) ahora acepta OTP
  opcional (`otpRequerido`/`otp`/`onOtpChange`, sin romper a quien no lo usa)
  y se aplicó a "Quitar cargo" de Líder/Supervisor de Red y de Líder de
  Departamento (Afirmación) — antes quitaban al instante, sin ningún paso
  intermedio. Rojo/destructivo, verificado en vivo. Casas de Paz YA tenía
  confirmación (dentro de `AsignarCargoDialog`), no necesitó cambios. Sigue
  pendiente: confirmación para "asignar" (no solo quitar) y para cambios de
  color de Red.

**Sobre el registro de auditoría (pregunta directa del owner):** sí existe.
`red_cargo` y las demás tablas de cargos ya guardan `creado_por`/
`actualizado_por`/`fecha_creacion`/`fecha_actualizacion` vía el trigger
`fn_auditoria()` — se usó para confirmar que este cambio lo hizo el propio
owner. Falta una pantalla para consultarlo cómodo (hoy hay que hacerlo por
SQL/API directo); no es prioridad ahora, solo queda anotado.

## Regla de cambio

Una decisión cerrada no se cambia silenciosamente. Cualquier modificación debe
registrar fecha, responsable, razón y documentos/Jira afectados.
