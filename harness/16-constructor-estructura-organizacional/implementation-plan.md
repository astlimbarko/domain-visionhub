# 16 — Constructor de Estructura Organizacional — implementation-plan.md

> Plan propuesto y trazable. No ejecutar migraciones ni código de una etapa sin
> aprobación del owner. Cada corte se prueba y demuestra antes de continuar.

## Regla de rama

- Nunca trabajar directamente en `master`.
- Rama recomendada: `feature/estructura-organizacional`.
- Rama activa confirmada: `feature/estructura-organizacional`.

## Regla de costos

- No usar funcionalidades pagadas ni recursos que generen cobros.
- Queda descartada la rama temporal pagada de Supabase.
- Las migraciones se validarán mediante alternativas gratuitas/locales antes de
  cualquier aplicación controlada al proyecto.

## Regla de trazabilidad Jira

- Todo alcance nuevo descubierto durante el desarrollo debe registrarse con
  **título** y **descripción breve**.
- El registro debe vincularse con la épica KAN-52 o con la tarea hija que le
  corresponda antes de considerarlo terminado.
- Deben anotarse rama, estado y commit cuando exista implementación.
- Ningún cambio nuevo se incorporará silenciosamente bajo el nombre de otra
  tarea si modifica su alcance funcional.

### Ampliación detectada — acceso jerárquico desde Super Admin

**Título:** Organizar iglesias y abrir su estructura desde el panel Super Admin.

**Descripción breve:** Agrupar cada iglesia principal con sus hijas y satélites
mediante sangría visual; convertir cada entidad en un botón que abre su propio
organigrama y retirar el acceso genérico del navbar que apuntaba ambiguamente a
una sola iglesia.

**Vinculación propuesta:** seguimiento de KAN-53 dentro de la épica KAN-52.

**Implementación:** `feature/navegacion-iglesias-super-admin`, commit `c4560ff`.

### Ampliación detectada — indicador de dependencia entre iglesias

**Título:** Mostrar relación jerárquica con prefijo visual en Iglesias.

**Descripción breve:** Añadir el carácter `└─` delante de cada iglesia hija o
satélite para comunicar de forma limpia que se encuentra debajo de la entidad
superior. Los caracteres `├──`, `──` y `│` quedan disponibles para futuros
árboles más complejos, pero no se incorporan sin necesidad visual.

**Vinculación propuesta:** seguimiento de KAN-53 dentro de la épica KAN-52.

**Implementación:** `feature/navegacion-iglesias-super-admin`; `d365f83`
incorporó el símbolo y `f51f7db` corrigió el detalle visual para que `└─`
reemplace al punto, sin alterar agrupamiento ni sangría.

### Ampliación detectada — retirar viñeta de iglesias principales

**Título:** Quitar viñeta de iglesias principales.

**Descripción breve:** Eliminar el punto circular inicial de las entidades raíz
para limpiar la jerarquía; `└─` permanece únicamente en hijas y satélites.

**Vinculación propuesta:** seguimiento de KAN-53 dentro de la épica KAN-52.

**Implementación:** `feature/navegacion-iglesias-super-admin`, commit `0281e8a`.

### Ampliación detectada — iconos por tipo de iglesia

**Título:** Identificar visualmente el tipo de iglesia en la lista jerárquica.

**Descripción breve:** Reemplazar el icono genérico final por `Church` para una
iglesia madre, `Building2` para una iglesia hija y `RadioTower` para una iglesia
satélite. La selección se deriva automáticamente de `iglesia_padre_id` y
`tipo`, por lo que también funciona con todas las iglesias nuevas.

**Vinculación propuesta:** seguimiento de KAN-53 dentro de la épica KAN-52.

**Implementación:** `feature/navegacion-iglesias-super-admin`, commit `9ae10f4`.

### Corrección — posición de iconos de iglesia

**Título:** Mover iconos de tipo de iglesia al inicio.

**Descripción breve:** Colocar el icono de madre, hija o satélite antes del
nombre —y después de `└─` cuando exista— para integrarlo en la lectura
jerárquica, retirándolo del extremo derecho.

**Vinculación propuesta:** seguimiento de KAN-53 dentro de la épica KAN-52.

**Implementación:** `feature/navegacion-iglesias-super-admin`, commit `29d8271`.

### Ampliación detectada — navegación y acordeón de iglesias

**Título:** Añadir affordance de navegación y acordeón a grupos de iglesias.

**Descripción breve:** Mostrar cursor de mano sobre cada fila clickeable y un
control independiente para expandir o contraer las hijas/satélites de una
iglesia madre. El control aparece solo cuando existen descendientes y comienza
expandido para conservar visibilidad inicial.

**Vinculación propuesta:** seguimiento de KAN-53 dentro de la épica KAN-52.

**Implementación:** `feature/navegacion-iglesias-super-admin`, commit `2896d58`.

## Fase 0 — Cerrar documentación

- [x] Auditar harness 03 y 15, Jira KAN-52–KAN-63, código y Supabase real.
- [x] Cerrar decisiones funcionales con Gonzalo.
- [x] Crear paquete harness 16.
- [x] Revisar y aprobar formalmente los cinco documentos con Gonzalo.
- [x] Corregir Jira si una tarea contradice estas decisiones.

**Salida:** “Especificación aprobada; se puede implementar KAN-54”.

### Ajuste KAN-53 confirmado

- Implementado de forma aislada en la rama
  `feature/navegacion-iglesias-super-admin` (`c4560ff`); no mezclar ese código
  de presentación con la rama del constructor hasta su integración revisada.
- [x] Agrupar iglesias madre, hijas y satélites en la lista del Super Admin.
- [x] Hacer de cada iglesia un botón que abre su organigrama independiente.
- [x] Retirar el acceso ambiguo del navbar que apuntaba a la primera iglesia.

## Fase 1 — KAN-76: cimientos de base y contrato

Estado de diseño: borrador revisable creado en `migration-draft.sql`; todavía no
es una migración ejecutable ni fue aplicado a Supabase.

1. Crear migración con `estructura_organigrama` y `estructura_nodo_posicion`.
2. Agregar RLS/privilegios/índices y RPC de lectura/guardado/versionado.
3. Agregar `departamento.color` y seed oficial idempotente.
4. Diseñar/crear `estructura_designacion` o ampliar invitaciones tras prueba de compatibilidad.
5. Crear RPC agregadora `fn_estructura_obtener`.
6. Generar tipos TypeScript.

**Pruebas:** RLS cruzada, FK/índices, layout versionado, datos existentes intactos,
advisors sin hallazgos nuevos críticos.

## Fase 2 — KAN-54: lienzo de visualización

1. [x] Instalar `@xyflow/react` con versión fijada y lockfile; compilación Docker
   validada con `@xyflow/react@12.11.2`.
2. [x] Integrar la barra del módulo con el lienzo sin mezclar el panel Super Admin.
3. [x] Implementar tipos de nodo y aristas derivadas.
4. [x] Implementar estado vacío, N redes y N CdP.
5. [x] Implementar pan, zoom/pinch, centrar, búsqueda y resaltado.
6. [x] Implementar layout inicial determinista y cuadrícula.
7. [x] Corregir cabecera para mostrar nombre de iglesia.

**Estado:** primera entrega funcional implementada en
`feature/estructura-organizacional`. Consume en modo lectura las entidades
existentes de Supabase; todavía no permite editar ni persistir posiciones.
Compilación de producción Docker correcta y lint sin errores nuevos.

### Ajuste visual — identidad de la iglesia en cabecera

**Título:** Mostrar la iglesia abierta en lugar de la marca genérica.

**Descripción breve:** La zona izquierda de la cabecera donde originalmente se
mostraba `VisionHub` presenta ahora la palabra **Iglesia** en negrita y el nombre
de la entidad en peso normal. El nombre no se repite debajo del título
`Estructura Organizacional` y se trunca limpiamente cuando el espacio es corto.

**Vinculación:** ajuste visual de KAN-54 dentro de la épica KAN-52.

### Ajuste visual — secciones y color de entidades

**Título:** Diferenciar secciones organizativas de entidades administrables.

**Descripción breve:** `Departamentos` y `Redes de Casas de Paz` se representan
como encabezados de sección, sin apariencia seleccionable ni posibilidad de
asignarles un líder. Departamentos, Redes y Casas de Paz utilizan relleno
completo derivado de su color oficial y texto blanco con contraste reforzado.
El layout reduce espacios horizontales y verticales conservando legibilidad de
conexiones y agrupaciones.

**Vinculación:** ajuste visual de KAN-54/KAN-55 dentro de la épica KAN-52.

**Verificación pendiente:** capturas por iglesia al cierre para revisar estados
con datos reales, colores, contraste, densidad y estados vacíos.

### Ajuste visual — entidades incompletas y colores provisionales

**Título:** Diferenciar entidades sin datos y redes sin color configurado.

**Descripción breve:** Una Red sin nombre ni líder usa fondo gris, texto negro y
la guía `Escribe un nombre · Asigna un líder`. Una Casa de Paz no tiene nombre
propio: usa el nombre de su líder como referencia principal y debajo la dirección
breve del anfitrión o lugar de reunión. Si no tiene líder usa fondo gris, texto
negro y `Asignar líder`; si no tiene dirección muestra `Dirección pendiente` y
puede ofrecer `Añadir dirección`. Las redes cuyo color persistido sea blanco o
vacío reciben una paleta provisional determinista para que sean distinguibles
sin modificar todavía la base de datos.

**Aclaración visual:** el color identificativo pertenece únicamente a la Red.
Durante desarrollo se inventa un fallback para los registros actuales en
`#FFFFFF`; en producción el usuario lo escoge. Las Casas de Paz no poseen color
propio: usan fondo blanco, texto negro y heredan de su Red solamente conexión,
icono y acento lateral. En una Red el gris representa falta de nombre y líder;
en una Casa de Paz representa falta de líder.

**Vinculación:** KAN-54/KAN-58/KAN-59 dentro de la épica KAN-52.

### Entrega visual — fila horizontal de Departamentos

**Título:** Mostrar los cuatro departamentos oficiales en una fila horizontal.

**Descripción breve:** La sección no interactiva `Departamentos` contiene los
cuatro nodos oficiales en una sola fila horizontal. Cada nodo continúa siendo una
entidad independiente y manipulable. El código hexadecimal se lee de
`departamento.color`; `departamento.color_nombre` conserva además su nombre
legible. La paleta institucional centralizada permanece como fallback
defensivo. Si no existe líder se presenta una versión tenue con texto oscuro y `Líder sin
asignar`, mientras que una asignación vigente activa el relleno completo, texto
blanco y el indicador gris/verde de confirmación. El responsable usa su nombre
y, cuando la membresía todavía no aporta uno, su correo como referencia debajo
del Departamento. Futuras entidades del Departamento crecerán verticalmente.

**Alcance de esta entrega:** solo lectura y presentación de datos existentes;
la acción para asignar o cambiar líder permanece en KAN-56/KAN-57.

**Vinculación:** KAN-57 dentro de la épica KAN-52.

**Validación:** migración aditiva aplicada en Supabase con 9 registros válidos,
0 nombres vacíos y 0 códigos hexadecimales inválidos. Build Docker correcto y
lint con cero errores. Pendiente revisión visual autenticada mediante captura
del navegador principal.

### Corrección — Departamento siempre en color sólido

**Título:** Quitar el estado tenue de Departamento sin líder.

**Descripción breve:** La tarjeta de Departamento ya no se atenúa cuando no
tiene líder; usa siempre el color oficial sólido, igual que Afirmación. Solo
cambia el texto (“Líder sin asignar”) y el punto gris/verde de confirmación.
Reemplaza REQ-DEP-4 anterior.

**Vinculación:** KAN-57 dentro de la épica KAN-52.

**Implementación:** `feature/estructura-organizacional`, `NodoEstructura.tsx`.
Build y lint Docker/local correctos tras el cambio.

### Corrección — quitar subtítulo redundante de Departamentos

**Título:** Quitar el texto “4 departamentos oficiales”.

**Descripción breve:** Es obvio para la iglesia y no aporta información; se
retira el subtítulo de la sección `Departamentos`, que ahora solo muestra el
título.

**Vinculación:** KAN-54/KAN-57 dentro de la épica KAN-52.

**Implementación:** `feature/estructura-organizacional`, `layout.ts`.

### Corrección — fondo del lienzo más oscuro que los grupos

**Título:** Diferenciar el fondo del lienzo de los contenedores de sección.

**Descripción breve:** El fondo general (`#eef1f6`) se confundía con el fondo
traslúcido blanco de los grupos Departamentos/Redes. Se oscureció levemente a
`#e3e7ee` para que los grupos se lean como paneles distinguibles sobre el
lienzo.

**Vinculación:** KAN-54 dentro de la épica KAN-52.

**Implementación:** `feature/estructura-organizacional`, `EstructuraOrganizacional.tsx`.

### Backlog visual/funcional derivado de las referencias

- [x] nodos especializados de Pastor y Supervisor con iniciales y correo;
- contenedores no interactivos para Departamentos y Redes/Casas de Paz;
- [x] fila horizontal y estados visuales de Departamentos;
- acción de asignación únicamente para Líder de Afirmación;
- tarjeta completa de Red con Líder y Supervisor de Red;
- tarjeta de Casa de Paz sin nombre propio: líder como referencia principal,
  dirección del anfitrión debajo, sublíderes y contador `+N`;
- botones contextuales `Nueva red`, `+ Casa de Paz` y `Añadir sublíder`;
- paneles de doble vía (base/correo) para cada asignación;
- formularios de creación de Red/Casa de Paz, paleta y vista previa;
- estados gris/verde de confirmación, reenvío/corrección de correo y OTP;
- responsive, pruebas de escala y capturas finales por iglesia.

**Prueba:** estructuras de 0, 1, 20, 100 y 500 nodos; jerarquía correcta; sin
acciones de edición todavía.

## Fase 3 — KAN-75: persistencia y organizar

1. [x] Activar Modo organizar para Super Admin/Supervisor autorizado.
2. [x] Guardar al finalizar drag con debounce de 400 ms y cuadrícula de 16 px.
3. [x] Manejar conflicto de versión sin sobrescritura silenciosa.
4. [x] Implementar “Organizar automáticamente” con confirmación y batch.
5. [ ] Persistir cámara local sin compartirla.

**Estado:** interfaz y RPC `fn_estructura_guardar_posiciones` implementadas
localmente. La UI detecta si los cimientos aún no existen y mantiene desactivado
el modo para no llamar tablas inexistentes. Falta validar/aplicar la migración
mediante una alternativa gratuita/local antes de probar persistencia entre
sesiones; no se utilizará una rama temporal pagada de Supabase.

**Prueba:** Super Admin mueve; Supervisor recarga y ve igual; conflicto simultáneo
no pierde cambios silenciosamente.

## Fase 4 — KAN-55: interacción común

1. [x] Panel lateral/sheet reutilizable.
2. [x] Scrim y elevación del origen seleccionado.
3. [ ] Cierre seguro con formularios sucios (se activa al incorporar formularios).
4. [ ] Tooltips desktop y alternativa táctil.
5. [x] Cierre accesible por botón, fondo y tecla Escape.

**Estado:** shell de consulta contextual terminado y validado en Docker. El
contenido de edición se incorporará por entidad en KAN-56 a KAN-60.

## Fase 5 — KAN-56 y KAN-57: asignaciones base

1. [x] Pastor: doble vía (BD/correo) implementada en `PanelPastorEstructura.tsx`.
   Supervisor y Departamentos todavía sin panel de asignación propio.
2. [x] Leer responsables vigentes y usar nombre o correo como fallback.
3. [x] Cargar Pastor y Supervisor desde `usuario_rol` mediante RPC autorizada.
4. [x] Mostrar siempre los cuatro departamentos y cargar sus líderes existentes.
5. [x] Asignar Pastor con operación atómica (`fn_estructura_asignar_pastor`,
   reemplaza al Pastor anterior en una sola transacción/OTP). Supervisor y
   Departamentos: pendiente.
6. Estado tenue/intenso derivado de líder confirmado. *(Superado: ver ajuste
   2026-08-05 en Fase 2 — Departamento ahora siempre en color sólido.)*

### Entrega — Asignar Pastor (Super Admin)

**Título:** Panel para asignar/cambiar Pastor desde el lienzo.

**Descripción breve:** Nueva RPC `fn_estructura_asignar_pastor(iglesia, persona,
otp)`: reemplaza atómicamente al Pastor vigente (singular, a diferencia de
Supervisor de Red que admite plural), reusa `trg_validar_rol` existente
(Super Admin únicamente) y el switch OTP propio del módulo. Vía correo reusa
la función `invitar-usuario` ya existente (mismo patrón que el panel del
Pastor asignando su Supervisor, `PastorGestion.tsx`) — no se duplicó
infraestructura de invitación. Solo Super Admin ve la acción; Supervisor ve
el nodo de Pastor en modo lectura (REQ-PER-6).

**Vinculación:** KAN-56/KAN-57 dentro de la épica KAN-52.

**Implementación:** `feature/estructura-organizacional`, migración
`20260805194500_estructura_asignar_pastor.sql` (pendiente de aplicar a
Supabase — requiere autenticar la CLI), `PanelPastorEstructura.tsx`.

### Ampliación detectada — identidad por correo sin membresía

**Título:** Mostrar asignaciones sin persona mediante correo.

**Descripción breve:** Cuando una asignación administrativa tiene cuenta/correo
pero todavía no existe una `persona` vinculada, el organigrama muestra el correo
como identidad visible y la leyenda `membresía pendiente`. Cuando existe persona,
prioriza el nombre. La lectura usa `fn_listar_usuarios` para no exponer
directamente `auth.users` y aplica la misma regla a todas las iglesias.

**Vinculación:** KAN-56/KAN-57 dentro de la épica KAN-52.

**Implementación:** `feature/estructura-organizacional`, en el corte de carga de
responsables reales y fallback por correo.

**Prueba:** asignar/cambiar Pastor, Supervisor y Líder de Afirmación; una
iglesia nunca ve personas de otra. Evangelismo, Discipulado y Envío permanecen
visibles, pero sin acción de asignación mientras esos cargos no existan en el
sistema.

## Fase 6 — KAN-58: Redes

1. [x] Distribuir N Redes horizontalmente como entidades hermanas.
2. [x] Mostrar Líder y Supervisor de Red (`SUBLIDER_RED`) dentro de la tarjeta de Red.
3. [x] Apilar verticalmente las Casas de Paz pertenecientes a cada Red.
4. [x] Crear una Red sin responsables mediante RPC transaccional.
5. [ ] Paleta/hex y vista previa implementadas; falta advertir colores ya usados y validar contraste visual con capturas.
6. [x] Asignar Líder y Supervisor de Red desde base de datos o por correo.
7. [ ] Editar nombre/color e historial de cargos implementado; falta corregir/cancelar un correo pendiente equivocado.
8. [x] Auto-colocar una Red nueva conservando las posiciones ya guardadas.

**Estado 2026-08-05:** panel lateral funcional conectado a Supabase. Incluye creación/edición de Red, selección incremental por nombre o correo, designación por correo reutilizando `invitar-lider`, indicador gris/verde, reenvío y OTP exclusivo del constructor. La función `invitar-lider` versión 7 quedó `ACTIVE` con JWT obligatorio. Build y lint Docker correctos; falta la prueba visual autenticada y los casos reales de correo.

**Base de datos:** migraciones `20260805160451_estructura_redes_operaciones` y `20260805170233_estructura_invitacion_supervisor_red` aplicadas. Las RPC validan usuario, permiso por iglesia, destino y OTP; no conceden acceso anónimo.

## Fase 7 — KAN-59 y KAN-60: Casas de Paz

1. Crear CdP mínima dentro de Red mediante RPC transaccional.
2. No solicitar ni mostrar nombre propio para la CdP.
3. Mostrar líder como referencia principal y dirección del anfitrión debajo.
4. Estados `Líder sin asignar`/`Dirección pendiente`, con fondo gris y texto
   negro cuando falte líder.
5. Asignar después líder, anfitrión y dirección.
6. Añadir N sublíderes sin duplicados.
7. Iniciales, contador `+N`, tooltips y detalle.
8. Auto-colocar nueva CdP en su Red.

## Fase 8 — KAN-61: designación por correo

1. [x] Crear la reserva organizacional inmediata para Líder/Supervisor de Red.
2. [x] Integrar SMTP/Auth mediante la Edge Function existente, sin duplicar infraestructura.
3. [ ] Nuevo usuario: validar de extremo a extremo confirmación de lectura, contraseña y membresía.
4. [ ] Usuario existente: notificar el nuevo cargo y confirmar lectura sin intentar crear otra cuenta.
5. [x] Mostrar punto gris para pendiente y verde para cuenta confirmada.
6. [ ] Reenvío implementado; faltan corrección de correo, cancelación e invalidación del enlace anterior.
7. [ ] Confirmar mediante prueba E2E que los permisos operativos no quedan utilizables antes de completar la cuenta.

**Prueba pendiente:** correo nuevo, existente, typo corregido, reenvío, enlace anterior inválido, doble clic idempotente y ningún duplicado.

## Fase 9 — KAN-77: OTP exclusivo del módulo

1. [x] Persistir switch por iglesia, `false` por defecto.
2. [x] Mostrar UI discreta y accesible en el lienzo.
3. [x] Activar sin OTP y exigir OTP para desactivar desde estado activo.
4. [x] Condicionar las RPC del constructor al switch, incluida la designación por correo de Redes.
5. [ ] Completar regresión E2E para confirmar que las reglas OTP de otros módulos permanecen intactas.

**Seguridad verificada:** las RPC nuevas usan `SECURITY DEFINER` con `search_path` fijo, autorización interna por iglesia, `REVOKE` a `PUBLIC/anon` y `GRANT` exclusivo a `authenticated`.

### Corrección — cabecera rota en móvil y tablet

**Título:** Corregir cabecera del lienzo en anchos angostos.

**Descripción breve:** La cabecera dependía de `flex-wrap` implícito y se
partía en 3 filas descoordinadas en celular (buscador flotando entre íconos
sueltos) y colisionaba título/nombre de iglesia en tablet (~768px). Se
reescribió con dos layouts explícitos: fila única desde `lg` (buscador +
acciones + zoom inline) y, debajo de `lg`, buscador de ancho completo más una
barra compacta de íconos. Encontrado y verificado con Playwright en 360/390/
768/1024px, no solo a ojo.

**Vinculación:** KAN-63 dentro de la épica KAN-52.

**Implementación:** `feature/estructura-organizacional`, `EstructuraOrganizacional.tsx`.

**Pendiente relacionado:** a 1024px exacto los botones "Centrar estructura"/
"Modo organizar" todavía truncan/envuelven texto de forma ajustada; queda
para el pase completo de responsividad de esta fase, no bloquea.

## Fase 10 — KAN-63: móvil y escalabilidad

1. Pan/pinch y Modo organizar táctil.
2. Barra compacta sin perder funciones.
3. Paneles full-screen/bottom sheet.
4. Orientación sin pérdida de formulario/cámara.
5. Pruebas Android, iPhone, tablet, Chrome y Safari móvil.
6. Perfil de rendimiento con estructura grande.

## Fase 11 — KAN-62: cierre integral

- pruebas unitarias, integración, RLS y E2E;
- `npm run build` y `npm run lint`;
- advisors Supabase;
- prueba real de correos;
- regresión de login, dashboards, gestión de Redes/CdP y OTP externo;
- demo completa por iglesia madre, hija y satélite;
- actualizar Jira y bitácora;
- PR revisable, nunca merge directo a `master`.

## Matriz de terminación

Una tarea no está terminada solo porque “se ve”. Debe cumplir:

1. criterios de Jira y `requirements.md`;
2. autorización backend y RLS;
3. persistencia tras recargar;
4. desktop y móvil proporcional al alcance;
5. errores recuperables;
6. pruebas y build limpios;
7. documentación/bitácora actualizadas.
