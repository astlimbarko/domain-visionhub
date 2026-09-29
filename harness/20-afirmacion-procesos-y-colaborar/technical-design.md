# Diseño técnico — Procesos de Afirmación (RSIL/Fiesta/Bautismo) + Colaborar por tarjetas

Investigación real contra el código y el esquema de producción
(2026-09-29), antes de escribir nada. Sin implementación todavía.

## Hallazgo 1: RSIL y Fiesta de Bienvenida son casi gratis -- el backend ya los soporta

La migración de Altar (KAN-481, `20260927140000_kan481_altar_proceso_afirmacion.sql`)
creó la tabla y las funciones **genéricas por `proceso_codigo` a propósito**:

```sql
CREATE TYPE proceso_afirmacion_codigo_enum AS ENUM ('ALTAR', 'RSIL', 'FIESTA_BIENVENIDA');
```

El enum YA incluye `RSIL` y `FIESTA_BIENVENIDA` -- nadie los usa todavía,
pero existen. `fn_afirmacion_registrar_proceso`, `fn_afirmacion_estado_proceso`
y `fn_afirmacion_historial_proceso` ya aceptan cualquiera de los 3 valores
sin cambios. **No hace falta ninguna migración de base de datos para
RSIL/Fiesta** -- KAN-483 y KAN-484 son, del lado de backend, trabajo cero.

Del lado de frontend: `frontend/src/pages/AfirmacionAltar.tsx` es
literalmente la plantilla a clonar. Diferencia real con Altar: RSIL y
Fiesta NO tienen boceto propio (a diferencia de Altar, que sí lo tuvo) --
mismo criterio que ya se usó para la pestaña "Datos" de Altar (sin
boceto, criterio propio del desarrollador). Reusar tal cual el layout de
Altar (Buscar/Nuevo/Datos), cambiando: rótulo ("RSIL"/"Fiesta de
Bienvenida"), ruta, ícono, y el valor fijo de `procesoCodigo` pasado a
`useRegistrarProcesoAfirmacion`/`useHistorialProcesoAfirmacion`.

**Oportunidad de refactor** (no obligatoria, evaluar en el momento): dado
que Altar/RSIL/Fiesta van a ser 3 copias casi idénticas de
`AfirmacionAltar.tsx`, conviene extraer un componente genérico
`ProcesoAfirmacionScreen({ procesoCodigo, titulo, icono, ... })` en vez de
triplicar el archivo -- decisión de implementación, no bloquea el spec.

## Hallazgo 2: Bautismo/Membresía es un caso distinto -- reusa el formulario pesado existente

KAN-482 no encaja en el patrón genérico de Altar/RSIL/Fiesta. El "proceso"
de Bautismo se apoya en el formulario de membresía YA existente
(`frontend/src/components/afirmacion/RegistrarPersonaAfirmacion.tsx`,
usado hoy en `AfirmacionFormulario.tsx` y en `Colaborar.tsx`) -- un
formulario paginado (`FormularioPaginado`) mucho más grande que
`DatosBasicosPersonaFields`: incluye cónyuge, familia, discipulados,
seminario/universidad, ministerios, cargo/rango, y **exige elegir un
Líder de CdP** (`SelectorLiderCdp` + `p_casa_de_paz_cargo_id`) porque
inserta directo en `casa_de_paz_membresia`.

**Diferencia real con Altar/RSIL/Fiesta**: esos 3 NO piden CdP (guardan
en `persona_proceso_afirmacion`, sin relación con membresía de CdP). Un
Colaborador que solo tiene código para "Bautismo/Membresía" va a tener
que elegir Líder de CdP igual que hoy -- ese campo no es opcional a nivel
de RPC (`fn_registrar_persona_afirmacion` lo exige para resolver
`v_iglesia_id`). Si el owner quiere aligerar el formulario para este
caso, es un cambio de requisito nuevo, no algo que este ticket ya pida.

## Hallazgo 3: falta la fecha de bautismo -- campo nuevo real

`persona_detalle` ya tiene `bautizado`, `bautizado_en_nuestra_iglesia`,
`bautismo_anio`, `bautismo_mes`, `bautismo_dia`, `bautismo_precision_fecha`
(confirmado en `fn_obtener_persona_editar_afirmacion`, que ya los
devuelve). **No hace falta columna nueva** -- el formulario de
`RegistrarPersonaAfirmacion.tsx` hoy simplemente no expone esos campos en
el flujo de alta (sí existen para edición/censo). KAN-482 es then: agregar
esos campos (o un subconjunto) al paso de alta cuando el contexto es
"Bautismo", reusando `fn_guardar_membresia_extendida`/
`fn_editar_membresia_extendida` que ya los aceptan.

## Hallazgo 4: la pestaña "Personas registradas" (tarjetas + editar) -- patrón ya resuelto en Altar

KAN-482 pide exactamente lo que ya se construyó para Altar (pestaña
"Datos", agregada hoy mismo 2026-09-29): tarjetas/tabla con lo que el
usuario registró, filtro por colaborador para Afirmación "de verdad", y
clic para abrir la ficha vía `useFichaPersonaStore`/`PersonaNombreLink`
(`frontend/src/store/ficha-persona.store.ts`,
`frontend/src/components/personas/FichaPersonaSheet.tsx`). Mismo patrón,
mismo componente reusable -- no hay que reinventarlo.

**Diferencia con Altar**: Altar usa `fn_afirmacion_historial_proceso`
(tabla genérica). El listado de Bautismo/Membresía tiene que salir de
otra fuente -- probablemente `casa_de_paz_membresia` + `persona`
filtrado por `creado_por`, ya que no pasa por `persona_proceso_afirmacion`.
Falta una función nueva tipo `fn_afirmacion_historial_membresia` (no
existe todavía, confirmado por búsqueda).

## Hallazgo 5: Colaborar hoy es de un solo paso -- confirmado que la pantalla intermedia NO existe

`frontend/src/pages/Colaborar.tsx` (KAN-405), tras canjear el código,
salta DIRECTO a un `<Tabs>` de 2 pestañas ("Cargar persona" con
`RegistrarPersonaAfirmacion`, "Mi historial") -- no hay ninguna pantalla
de selección de tarea. Confirmado en vivo (2026-09-29): no hay tarjetas,
no hay jerarquía `Colaborar → Afirmación → tarea`.

**Gap real de datos**: `colaborador_codigo` (`supabase/migrations/
20260921100000_kan405_colaboradores_temporales.sql`) solo tiene
`departamento_codigo VARCHAR` (ej. `'AFIRMACION'`) -- **no tiene ninguna
columna de granularidad por tarea**. `fn_es_colaborador_activo_en(p_iglesia_id,
p_departamento_codigo)` tampoco distingue tareas. Para cumplir "no asumir
que todo colaborador tiene automáticamente acceso a las cuatro" (texto
literal del ticket KAN-485) hace falta:

- Columna nueva en `colaborador_codigo`, ej. `tareas_autorizadas
  proceso_afirmacion_tarea_enum[]` (o tabla `colaborador_codigo_tarea` si
  se prefiere normalizado), poblada al generar el código.
- Actualizar `GenerarCodigoCard` (`AfirmacionColaboradores.tsx`) para que
  el Líder de Afirmación elija qué tareas autoriza (checkboxes: Altar/
  Bautismo/RSIL/Fiesta) al crear el código -- hoy ese formulario no lo
  pide (ver `open-questions.md`, pregunta sobre compatibilidad con
  códigos ya generados).
- Nueva función `fn_puede_colaborador_en_tarea(p_iglesia_id,
  p_tarea_codigo)` (o extender `fn_es_colaborador_activo_en` con un
  parámetro opcional) que además de `departamento_codigo` verifique que
  la tarea puntual esté en `tareas_autorizadas` de la sesión activa.
  **Debe vivir en el backend** (RPC/RLS), no solo ocultar tarjetas --
  requisito explícito del ticket ("no basta con ocultar en frontend").
- `fn_puede_gestionar_afirmacion` (y las 3 funciones análogas que la
  usan) tendrían que aceptar un parámetro de tarea opcional para
  distinguir "colaborador activo en Afirmación en general" (paneles
  Líder/Afirmación) de "colaborador activo en ESTA tarea puntual" (el
  RPC de registro que efectivamente inserta el dato).

## Hallazgo 6: 2 bugs reales corregidos hoy, relevantes para este paquete

Durante la investigación de un error real reportado por el owner
("No se pudo registrar el Altar" al usar una cuenta Super Admin), se
encontraron y corrigieron 2 funciones de Afirmación que no incluían el
bypass de Super Admin (`fn_es_super_admin()`), a diferencia de TODAS las
demás funciones del módulo (`fn_listar_redes_afirmacion`,
`fn_afirmacion_config_registro_url`, etc.):

- `fn_puede_gestionar_afirmacion` (KAN-481) --
  `20260929150000_fix_altar_permiso_super_admin.sql`.
- `fn_registrar_persona_afirmacion` (el formulario de membresía real,
  usado por KAN-482) -- `20260929150100_fix_registrar_persona_afirmacion_
  super_admin.sql`. Estaba documentado como limitación conocida en un
  comentario de `AfirmacionFormulario.tsx` -- ya corregido y el
  comentario actualizado.

**Relevante para este paquete**: cualquier función NUEVA que se cree para
RSIL/Fiesta/Bautismo/tarea-de-Colaborador debe incluir
`fn_es_super_admin()` en el gate de permiso desde el día uno, siguiendo
el patrón ya establecido en el resto del módulo -- no repetir el mismo
descuido.

**No tocado a propósito** (fuera de este fix): `fn_editar_persona_afirmacion`
y `fn_obtener_persona_editar_afirmacion` (edición propia del Colaborador,
KAN-405) tampoco tienen el bypass, pero ahí la restricción real es
`creado_por = auth.uid()` ("solo edita lo que uno mismo registró") --
agregar Super Admin ahí requeriría además saltarse esa restricción de
autoría, un cambio de comportamiento distinto que no corresponde a este
fix puntual.

## Resumen de esfuerzo por ticket

| Ticket | Backend | Frontend |
|---|---|---|
| KAN-483 RSIL | Ninguno (ya existe) | Clonar `AfirmacionAltar.tsx` |
| KAN-484 Fiesta | Ninguno (ya existe) | Clonar `AfirmacionAltar.tsx` |
| KAN-482 Bautismo | Campo fecha bautismo en el paso de alta + función de historial nueva | Agregar pestaña "Personas registradas" + revisar campos del formulario largo |
| KAN-485 Colaborar | Columna/tabla de tareas autorizadas + función de permiso por tarea | Pantalla intermedia de tarjetas (2 niveles: Afirmación → tarea) |
