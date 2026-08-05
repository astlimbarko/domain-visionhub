# 16 — Constructor de Estructura Organizacional — implementation-plan.md

> Plan propuesto y trazable. No ejecutar migraciones ni código de una etapa sin
> aprobación del owner. Cada corte se prueba y demuestra antes de continuar.

## Regla de rama

- Nunca trabajar directamente en `master`.
- Rama recomendada: `feature/estructura-organizacional`.
- Rama activa confirmada: `feature/estructura-organizacional`.

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
- [ ] Corregir Jira si una tarea contradice estas decisiones.

**Salida:** “Especificación aprobada; se puede implementar KAN-54”.

### Ajuste KAN-53 confirmado

- Implementado de forma aislada en la rama
  `feature/navegacion-iglesias-super-admin` (`c4560ff`); no mezclar ese código
  de presentación con la rama del constructor hasta su integración revisada.
- [x] Agrupar iglesias madre, hijas y satélites en la lista del Super Admin.
- [x] Hacer de cada iglesia un botón que abre su organigrama independiente.
- [x] Retirar el acceso ambiguo del navbar que apuntaba a la primera iglesia.

## Fase 1 — Cimientos de base y contrato

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

**Prueba:** estructuras de 0, 1, 20, 100 y 500 nodos; jerarquía correcta; sin
acciones de edición todavía.

## Fase 3 — Persistencia y organizar

1. [x] Activar Modo organizar para Super Admin/Supervisor autorizado.
2. [x] Guardar al finalizar drag con debounce de 400 ms y cuadrícula de 16 px.
3. [x] Manejar conflicto de versión sin sobrescritura silenciosa.
4. [x] Implementar “Organizar automáticamente” con confirmación y batch.
5. [ ] Persistir cámara local sin compartirla.

**Estado:** interfaz y RPC `fn_estructura_guardar_posiciones` implementadas
localmente. La UI detecta si los cimientos aún no existen y mantiene desactivado
el modo para no llamar tablas inexistentes. Falta validar/aplicar la migración
en un entorno Supabase seguro antes de probar persistencia entre sesiones.

**Prueba:** Super Admin mueve; Supervisor recarga y ve igual; conflicto simultáneo
no pierde cambios silenciosamente.

## Fase 4 — KAN-55: interacción común

1. Panel lateral/sheet reutilizable.
2. Scrim y elevación del origen seleccionado.
3. Cierre seguro con formularios sucios.
4. Tooltips desktop y alternativa táctil.
5. Estados accesibles y navegación por teclado.

## Fase 5 — KAN-56 y KAN-57: asignaciones base

1. Extraer doble vía reutilizando `BuscadorPersona`.
2. Mostrar nombre+correo en resultados.
3. Implementar Pastor y slot principal de Supervisor.
4. Implementar cuatro departamentos permanentes y sus colores.
5. Asignar desde base con operaciones atómicas.
6. Estado tenue/intenso derivado de líder confirmado.

**Prueba:** asignar/cambiar Pastor, Supervisor y Líder de Departamento; una
iglesia nunca ve personas de otra.

## Fase 6 — KAN-58: Redes

1. Crear Red sin responsables.
2. Paleta/hex, colores usados, advertencia y contraste.
3. Asignar Líder y Supervisor de Red (`SUBLIDER_RED`).
4. Editar/corregir conservando historial.
5. Auto-colocar nueva Red sin mover las anteriores.

## Fase 7 — KAN-59 y KAN-60: Casas de Paz

1. Crear CdP mínima dentro de Red mediante RPC transaccional.
2. Estados sin líder/sin dirección.
3. Asignar después líder, anfitrión y dirección.
4. Añadir N sublíderes sin duplicados.
5. Iniciales, contador `+N`, tooltips y detalle.
6. Auto-colocar nueva CdP en su Red.

## Fase 8 — KAN-61: designación por correo

1. Implementar reserva organizacional inmediata.
2. Integrar SMTP/Edge Function existente.
3. Nuevo usuario: confirmar lectura, contraseña y completar cuenta.
4. Usuario existente: notificar y confirmar lectura.
5. Punto gris/verde.
6. Reenviar, corregir correo, cancelar e invalidar enlaces.
7. Activar asignación/permisos solamente al confirmar.

**Prueba:** correo nuevo, existente, typo corregido, reenvío, enlace anterior
inválido, doble clic idempotente y ningún duplicado.

## Fase 9 — OTP exclusivo del módulo

1. Persistir switch por iglesia, `false` por defecto.
2. UI discreta en barra con estado accesible.
3. Activar sin OTP; desactivar desde activo con OTP.
4. RPC del constructor condicionadas al switch.
5. Verificar que otros módulos no cambian.

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
