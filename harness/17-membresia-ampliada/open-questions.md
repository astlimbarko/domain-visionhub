# 17 — Membresía ampliada — open-questions.md

## Preguntas pendientes (bloquean el diseño fino, no la investigación)

- **Q-1 — Catálogo de discipulados, ¿global o por iglesia?** El ticket
  dice "se debe crear en base de datos la tabla/catálogo de tipos de
  discipulado para poder reutilizarla después" (Departamento de
  Discipulado, futuro). ¿Los 6 tipos son iguales para todas las iglesias
  del sistema (catálogo global, como `motivo_llegada`), o cada iglesia
  puede tener los suyos (como `departamento`)? Afecta si `tipo_discipulado`
  lleva `iglesia_id` o no. *Sin recomendación propia — es una decisión de
  cómo va a operar el futuro módulo de Discipulado, no algo que
  corresponda asumir acá.*
- **Q-2 — ¿Se puede repetir un mismo tipo de discipulado?** Ej. alguien
  reprobó "Carácter de Cristo 1" y lo volvió a hacer. *Recomendado: sí,
  permitir varias filas (repetición real en la vida de la iglesia), sin
  índice único.*
- **Q-3 — Seminario y Universidad del Rey Jesús, ¿tablas dedicadas o
  genérica?** Ver technical-design.md §2.3. *Recomendado: tablas
  dedicadas (más simple, ambos son preguntas cerradas del ticket, no una
  lista abierta como discipulados).*
- **Q-4 — Fecha con precisión, ¿`DATE` único o `anio`/`mes`/`dia`
  separados?** La regla explícita del ticket es "no obligar a inventar un
  día o mes que no recuerda". Un `DATE` con `precision_fecha_enum`
  aparte obliga a rellenar día/mes igual para que la columna sea válida
  (ej. "solo año 2020" → ¿se guarda `2020-01-01`?), lo cual es
  información inventada aunque esté marcada como "no exacta". La
  alternativa (`anio SMALLINT`, `mes SMALLINT NULL`, `dia SMALLINT NULL`)
  es más fiel a la regla pero más compleja de ordenar/comparar.
  *Recomendado: `anio/mes/dia` nullable — es la única opción que cumple
  la regla al pie de la letra, pero se marca como recomendación, no
  decisión tomada, porque cambia el patrón repetido en 4 lugares
  (Discipulados, Seminario, Universidad, Bautismo) y conviene que el
  owner lo confirme una sola vez para las 4.*
- **Q-5 — Lista de mentores: ¿qué hace que alguien sea "mentor
  disponible"?** El ticket solo dice "Entrega una lista de mentores
  disponibles" y "opción que no". Sin definir el origen de esa lista no
  se puede diseñar `persona_mentor` con precisión. Opciones: (a) un cargo
  nuevo tipo `MENTOR` en el catálogo `cargo`; (b) cualquier persona de la
  iglesia, buscada por nombre igual que `BuscadorPersona` (sin catálogo,
  el operador escribe cualquier nombre); (c) un catálogo separado que
  alguien arma a mano (¿quién lo mantiene — Afirmación, Discipulado,
  Supervisor?). **Es la pregunta más abierta del cluster** — bloquea
  también si "es mentor" es un concepto departamental (como Líder de
  Afirmación) o simplemente un dato suelto.
- **Q-6 — Familia/Cónyuge dentro del wizard, ¿UX integrada o
  diferida?** Dado que el modelo de datos ya existe
  (`relacion_familiar`/`referencia_familiar`), la pregunta es de UX: ¿se
  busca y vincula al cónyuge/familiar con `BuscadorPersona` dentro de la
  misma página del wizard (requiere que la Persona ya exista en BD en ese
  punto — ver Q-7), o se recolectan los datos y se procesan recién al
  guardar toda la página/formulario? *Recomendado: procesar al guardar la
  página que contiene esos campos (no antes), para no depender de que la
  Persona principal ya tenga id asignado a mitad del formulario.*
- **Q-7 — Persistencia entre páginas de KAN-124: ¿cliente o servidor?**
  Ver technical-design.md §3.2. Cliente (localStorage) es de bajo riesgo
  e implementable ya; servidor (persona en estado `BORRADOR`) cumple el
  requisito al pie de la letra pero abre una superficie nueva
  (¿cómo se referencia el borrador en el flujo público anónimo entre
  requests? ¿cuánto se conservan los abandonados?). *Recomendado:
  arrancar con cliente, evaluar servidor si el owner confirma que le
  importa la persistencia entre dispositivos/sesiones (no solo "no perder
  lo tipeado en este navegador").*
- **Q-8 — KAN-126, ¿qué cuenta como "tiene un rol pero Membresía
  incompleta"?** ¿Todo `usuario_rol` vigente? ¿También
  `departamento_cargo`/`red_cargo`/`casa_de_paz_cargo` sueltos (alguien
  con cargo pero sin fila en `usuario_rol` codificada)? ¿Super Admin
  queda exento explícitamente (por diseño no tiene `persona`, `harness/14-afirmacion`
  ya lo trata como "rol técnico")? Esta pregunta determina el radio de
  impacto real del cambio en `PrivateLayout.tsx` — no se implementa sin
  cerrarla primero, porque afecta el login de usuarios ya existentes en
  producción, no solo un flujo nuevo aislado.

## Suposiciones explícitas

- **S-1** Los 3 flujos de alta existentes (público por URL, invitación,
  Afirmación) siguen siendo atómicos hasta que se confirme Q-7 con la
  opción "servidor" — no se cambia su semántica transaccional en esta
  fase.
- **S-2** El registro público (KAN-125) sigue sin botón `Saltar` (ya
  cumplido) y el flujo de Afirmación sigue sin cambios de permisos en
  este cluster (ver ticket separado KAN-127, ya resuelto).
- **S-3** "Categorías" del formulario paginado (KAN-124) se asume que
  siguen el orden de los 8 grupos de KAN-123 más Identidad/Censo ya
  existentes — no se asumió un agrupamiento distinto sin que el owner lo
  vea primero.

## Por qué no se implementó código de este cluster en esta sesión

Investigamos el flujo completo (ver `requirements.md` §4: bastante ya
existe y no había que rehacerlo) y encontramos que **KAN-123 tiene 5
preguntas de producto sin cerrar (Q-1, Q-2, Q-3, Q-5, Q-8)** que cambian
el modelo de datos, y que **KAN-124/125/126 dependen de esas respuestas**
(la paginación agrupa por las categorías de KAN-123; el registro público
reutiliza el wizard de KAN-124; KAN-126 tiene el mayor radio de impacto
de los cuatro y su alcance depende de Q-8). Construir la UI/DB ahora,
contra un set de campos o un alcance que probablemente cambie con las
respuestas del owner, arriesga trabajo tirado. Se prefirió dejar esta
especificación lista para que la implementación arranque directamente en
cuanto el owner responda, en vez de código a medio camino que haya que
deshacer.
