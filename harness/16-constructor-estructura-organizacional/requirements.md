# 16 — Constructor de Estructura Organizacional — requirements.md

> **Fase 1: análisis y especificación.** Este documento define QUÉ debe hacer el
> módulo. No autoriza ni implica migraciones o cambios en Supabase. El estado
> real y los cambios propuestos están separados en `database-impact.md`.
>
> Decisiones cerradas con Gonzalo, owner funcional de esta etapa, el 2026-08-04.

## 1. Objetivo

Construir un organigrama visual, dinámico y compartido para crear, consultar y
mantener la estructura de cada iglesia sin depender de formularios dispersos.
El módulo representa una iglesia a la vez y organiza horizontalmente:

```text
Pastor → Supervisor de la Visión en Acción
             ├── Departamentos
             └── Redes de Casas de Paz → Red → Casas de Paz
```

El organigrama es una herramienta de administración real: las acciones
modifican las entidades y asignaciones oficiales de Supabase. La posición visual
de un nodo no cambia relaciones de negocio; solamente cambia su presentación.

## 2. Alcance de iglesia y tenancy

**REQ-IG-1** — THE sistema SHALL mantener exactamente un organigrama canónico e
independiente por `iglesia_id`.

**REQ-IG-2** — THE sistema SHALL permitir organigramas independientes para
iglesias madre, hijas y satélite.

**REQ-IG-3** — WHERE una iglesia satélite dependa operativamente de su madre,
THE sistema SHALL conservar la satélite como entidad visible y SHALL permitir
abrir su propio organigrama sin mezclar nodos ni posiciones con la madre.

**REQ-IG-4** — WHEN un usuario autorizado administra una hija o satélite desde
la iglesia madre, THE sistema SHALL ejecutar cada operación usando el
`iglesia_id` del organigrama abierto, nunca el de la sesión por suposición.

**REQ-IG-5** — THE cabecera SHALL mostrar el nombre de la iglesia abierta junto
al logotipo; SHALL NOT usar “VisionHub” como sustituto del nombre de la iglesia.

**REQ-IG-6** — En el panel del Super Admin, cada iglesia SHALL ser un botón
accesible que abre directamente su propio organigrama con un clic/toque.

**REQ-IG-7** — THE lista SHALL agrupar cada iglesia principal con sus iglesias
hijas y satélites debajo, aplicando sangría progresiva y una envolvente de borde
blanco fino con esquinas redondeadas. SHALL soportar más de un nivel sin asumir
una cantidad fija de descendientes.

**REQ-IG-8** — THE interfaz SHALL distinguir discretamente “Hija” y “Satélite”
sin convertir la lista en un diagrama complejo.

**REQ-IG-9** — El navbar del Super Admin SHALL NOT mostrar un acceso genérico a
“Estructura Organizacional”, porque sería ambiguo entre varias iglesias. El
punto de entrada oficial SHALL ser el botón de cada iglesia.

## 3. Roles y permisos del módulo

**REQ-PER-1** — THE Super Admin SHALL poder abrir cualquier iglesia, crear o
modificar entidades y asignaciones, mover nodos, reorganizar el lienzo y manejar
el switch OTP del módulo.

**REQ-PER-2** — THE Supervisor de la Visión en Acción SHALL poder administrar
el organigrama de su propia iglesia: entidades, asignaciones, posiciones y
switch OTP.

**REQ-PER-3** — THE módulo SHALL NOT otorgar acceso administrativo al Líder de
Red, Supervisor de Red, Líder de CdP ni Sublíder de CdP.

**REQ-PER-4** — El rol Pastor no tiene todavía comportamiento funcional cerrado
para este módulo. Su acceso SHALL permanecer fuera de la implementación hasta
que exista una definición aprobada; no se inventarán permisos.

**REQ-PER-5** — THE backend SHALL validar iglesia y rol en cada escritura. Ocultar
botones en el frontend SHALL NOT considerarse control de autorización.

**REQ-PER-6** — THE Supervisor de la Visión SHALL poder ver el nodo Pastor de su
iglesia, pero SHALL NOT asignarlo, cambiarlo ni modificarlo. Solo el Super Admin
SHALL poder modificar al Pastor desde este módulo.

**REQ-PER-7** — THE base SHALL permitir varios Supervisores de la Visión
vigentes; WHERE el frontend muestre el organigrama inicial, SHALL presentar un
solo espacio principal de Supervisor sin imponer una restricción irreversible
en la base.

**REQ-PER-8** — WHEN el Supervisor de la Visión abre el lienzo, THE módulo
SHALL mostrar solo su propia rama (Departamentos, Redes, CdP) y permitirle
reposicionarla libremente. SHALL mostrar también su propio nodo y el del
Pastor, pero en modo lectura (sin botones de asignar/cambiar/quitar).

**REQ-PER-9** — WHEN el Líder de Red o Supervisor de Red abren el lienzo, THE
módulo SHALL mostrar y permitir reposicionar solo su propia Red (y sus CdP).
SHALL mostrar el par Líder/Supervisor de esa Red en modo lectura (sin botones
de asignar/cambiar/quitar entre ellos).

> Nota 2026-08-05 (KAN-78): REQ-PER-8 y REQ-PER-9 quedan solo especificadas —
> amplían/corrigen REQ-PER-2 y REQ-PER-3 (antes sin acceso alguno para Líder/
> Supervisor de Red). No se tocó frontend todavía; queda para que Matías lo
> implemente.

## 4. Lienzo dinámico y escalable

**REQ-LI-1** — THE sistema SHALL presentar un lienzo horizontal navegable con
pan, zoom, búsqueda, centrado y selección de nodos.

**REQ-LI-2** — THE sistema SHALL soportar cero redes y cero Casas de Paz como
estado inicial válido, mostrando acciones claras para crear la primera entidad.

**REQ-LI-3** — THE sistema SHALL soportar N redes por iglesia y N Casas de Paz
por red, sin límites artificiales del frontend.

**REQ-LI-4** — WHEN se cree una entidad, THE sistema SHALL ubicar su nodo de
forma automática dentro del grupo y jerarquía correctos sin reorganizar los
nodos que ya fueron acomodados manualmente.

**REQ-LI-5** — THE usuario autorizado SHALL poder mover nodos con mouse o gesto
táctil. Las posiciones SHALL ajustarse a una cuadrícula discreta para conservar
alineación y separación.

**REQ-LI-6** — THE sistema SHALL guardar las posiciones canónicas por iglesia en
Supabase y SHALL compartirlas entre Super Admin y Supervisor.

**REQ-LI-7** — THE posición de cámara (`x`, `y`, `zoom`) MAY persistirse por
usuario/dispositivo, pero SHALL NOT alterar la organización canónica de nodos.

**REQ-LI-8** — THE módulo SHALL incluir “Organizar automáticamente”. WHEN se
confirme esa acción, THE sistema SHALL recalcular el layout completo conservando
la jerarquía, separación entre grupos y ausencia de superposiciones.

**REQ-LI-9** — WHEN dos administradores editen posiciones simultáneamente, THE
sistema SHALL detectar versiones obsoletas y evitar sobrescrituras silenciosas.

**REQ-LI-10** — THE conexiones SHALL ser informativas y no editables por arrastre:
la relación oficial se cambia mediante acciones de negocio con validación.

**REQ-LI-11** — THE nodos SHALL mantener un tamaño mínimo legible; el sistema
SHALL ampliar el espacio navegable en vez de comprimir indefinidamente tarjetas.

**REQ-LI-12** — THE jerarquía principal y las entidades hermanas SHALL crecer
horizontalmente. Los datos y descendientes propios de cada entidad SHALL crecer
verticalmente debajo de su entidad padre.

## 5. Jerarquía y grupos

**REQ-JER-1** — THE Pastor SHALL aparecer como nodo jerárquico inicial aunque no
esté asignado; el estado vacío SHALL decir “Pastor sin asignar”.

**REQ-JER-2** — THE Supervisor de la Visión SHALL aparecer después del Pastor.
Desde él SHALL salir una conexión al contenedor Departamentos y otra al
contenedor Redes de Casas de Paz.

**REQ-JER-3** — THE conexión del Supervisor SHALL apuntar a los contenedores, no
directamente a Evangelismo ni a una red específica.

**REQ-JER-4** — THE contenedor Departamentos SHALL mantenerse separado del
contenedor Redes de Casas de Paz, aun con grandes cantidades de nodos.

**REQ-JER-5** — THE contenedor Redes SHALL mostrar cada Red y, conectadas a ella,
sus Casas de Paz vigentes.

**REQ-JER-6** — THE Redes hermanas SHALL distribuirse de izquierda a derecha.
Debajo de cada Red SHALL aparecer su Supervisor de Red y luego sus Casas de Paz
en una columna vertical independiente, sin mezclar descendientes entre Redes.

## 6. Departamentos

**REQ-DEP-1** — THE sistema SHALL mostrar siempre los cuatro departamentos
oficiales de la iglesia: Evangelismo, Afirmación, Discipulado y Envío.

**REQ-DEP-2** — THE cuatro entidades SHALL existir permanentemente; SHALL NOT
ofrecerse crear un quinto departamento ni eliminar uno de los cuatro.

**REQ-DEP-3** — THE sistema SHALL utilizar los colores oficiales persistidos en
la base. Mientras la base no tenga columna de color, la implementación SHALL NOT
inventar colores definitivos en componentes aislados.

**REQ-DEP-4** — THE tarjeta de Departamento SHALL mostrar siempre el color
oficial sólido, tenga o no líder vigente. WHERE no tenga líder, SHALL mostrar
“Líder sin asignar” sobre ese mismo color sólido; SHALL NOT atenuar el color
por falta de líder.

> Cambio 2026-08-05 (Gonzalo): reemplaza la versión anterior de REQ-DEP-4, que
> pedía color tenue sin líder. El tenue no gustó visualmente; se unificó con el
> tratamiento de Afirmación (color sólido siempre). Ver `implementation-plan.md`
> Fase 2 y Jira KAN-57.

**REQ-DEP-5** — Asignar un líder SHALL cambiar automáticamente la representación
visual a activa. Este estado visual SHALL derivarse de la asignación vigente y
SHALL NOT cambiar `departamento.activo`.

**REQ-DEP-6** — En la etapa actual, THE sistema SHALL permitir asignar o cambiar
únicamente al Líder de Afirmación por persona existente o por correo. Evangelismo,
Discipulado y Envío SHALL permanecer visibles pero sin acción de asignación hasta
que su funcionalidad exista en el sistema.

> Hecho 2026-08-06: hacer clic en un Departamento ya NO abre directo el modal
> de asignar — primero abre un panel lateral (`PanelDepartamentoEstructura.tsx`,
> mismo patrón que Red/CdP), y recién ahí, si el departamento es funcional
> (Afirmación), aparece el botón "Asignar"/"Cambiar" que abre el modal. Para
> los otros 3 departamentos el panel muestra un badge "Próximamente" sin
> botón. Pedido explícito: la barra lateral debe existir siempre porque a
> futuro habrá más opciones ahí que hoy no existen. Verificado en vivo.

**REQ-DEP-7** — THE cuatro Departamentos SHALL distribuirse en una sola fila
horizontal. Los datos del líder y futuras entidades propias de cada Departamento
SHALL crecer verticalmente debajo de su tarjeta.

## 7. Redes y Supervisor de Red

**REQ-RED-1** — THE sistema SHALL permitir crear una Red sin Líder ni Supervisor
de Red.

**REQ-RED-4** — WHEN se edita una Red existente, THE cambio de nombre SHALL
requerir una acción explícita ("Cambiar nombre") y una confirmación en modal
antes de aplicarse. WHERE el switch OTP del módulo esté activo, la confirmación
SHALL exigir código; WHERE esté inactivo, SHALL confirmar sin código pero
SHALL NOT aplicar el cambio sin el paso de confirmación.

> Hecho 2026-08-05: en `PanelRedEstructura.tsx`, el campo "Nombre de la Red" y
> la vista previa coloreada se fusionaron en uno solo (al inicio de la
> tarjeta, con el relleno del color elegido). En modo crear sigue siendo
> editable directo (nada que proteger todavía). En modo editar, ese campo
> pasa a ser de solo lectura + un botón "Cambiar nombre" que abre un modal de
> confirmación (nombre nuevo + OTP si corresponde) antes de guardar —
> reutiliza la misma RPC/mutación de actualizar Red. Verificado en vivo con
> Playwright (cambiar y revertir el nombre de una Red real). Pendiente para
> otra sesión: el owner señaló que puede haber otros lugares del módulo que
> necesiten el mismo patrón de confirmación (ver open-questions.md
> OQ-CONFIRMAR-CAMBIO-CARGO, mismo pedido para asignar/quitar cargo).

**REQ-RED-2** — THE creación de Red SHALL aceptar nombre y color hexadecimal
válido, ofrecer paleta y vista previa, y advertir —sin bloquear— colores ya usados.

> Hecho 2026-08-05: paleta reordenada (colores primarios primero: azul, rojo,
> verde, ámbar, luego cyan, naranja, morado, rosa); el selector "Personalizado"
> pasó de `<input type="color">` con label de texto a un botón circular con
> ícono de paleta, mismo tamaño que las muestras (abre igual el selector nativo
> del SO, que ya cumple el rol de "paleta completa"). Advertencia de color
> repetido: no bloqueante, compara contra `redesExistentes` (excluyendo la Red
> que se está editando), mensaje "Este color ya lo usa la Red «X»...". Verificado
> en vivo con Playwright creando 2 Redes con el mismo color. Ver Jira KAN-58.

> Hecho 2026-08-06: el hexadecimal directo ya se podía escribir haciendo clic
> en el swatch de "Personalizado" (abre el selector nativo del SO, que trae
> su propio campo de hex) — el problema real era que no se notaba que ese
> botón servía para eso, y su posición podía saltar a una segunda fila.
> Versión final: ícono `Pipette` (gotero, estándar de "color personalizado")
> al final de la MISMA fila que las 8 muestras, con `title` nativo al pasar
> el mouse. Fila reducida (7×7, gap más chico) para que entren las 9 en un
> solo renglón sin desbordar ni mostrar scroll horizontal — se quitó también
> `hover:scale-105` de las muestras porque el crecimiento al pasar el mouse
> era justo lo que disparaba la barra de desplazamiento fea. Verificado en
> vivo (`scrollWidth === clientWidth`, incluso en hover).

> Hecho 2026-08-06: "Guardar cambios" (modo editar) estaba habilitado siempre
> que el formulario fuera válido, sin importar si realmente se tocó algo.
> Ahora compara el color actual contra el color con el que se abrió el panel
> y queda deshabilitado si no hay diferencia (el nombre ya no se edita ahí,
> tiene su propio flujo de "Cambiar nombre"). "Crear Red" no cambia — ahí
> siempre hay algo nuevo por definición.

> Hecho 2026-08-05: en `PanelRedEstructura.tsx`, "Asignar/Cambiar" Líder o
> Supervisor de Red y "+ Nueva" Casa de Paz ahora abren un `Dialog` modal
> (mismo primitivo `@/components/ui/dialog` que usa `AsignarCargoDialog` en
> Departamentos/CdP) en vez de expandirse debajo dentro del panel lateral.
> Verificado en vivo con Playwright: buscar y asignar Supervisor de Red
> desde el modal, y abrir/cancelar el modal de nueva Casa de Paz.

> Hecho 2026-08-05: el nombre de la Red ya no incluye la palabra "Red" (ej.
> "Vida Nueva", no "Red Vida Nueva") — se renombraron las 5 Redes existentes
> en la base (`UPDATE red SET nombre = regexp_replace(...)`), el placeholder
> pasó a "Ej. Sion", y la tarjeta del lienzo (`NodoRed`) y la vista previa
> del panel muestran el label fijo `Red: "Vida Nueva"`. Verificado en vivo.

**REQ-RED-3** — THE texto sobre el color de Red SHALL alcanzar contraste legible
calculado automáticamente.

> Fix 2026-08-05: el fondo sólido de Red y Departamento mezclaba el color con
> azul marino oscuro para forzar texto blanco, lo que ensuciaba colores claros
> (ej. amarillo se veía mostaza). Ahora el fondo usa el color real sin mezclar
> y el color de texto (blanco o oscuro) se calcula por luminancia
> (`contraste.ts`). Ver Jira KAN-58.

> Fix 2026-08-06: el cálculo de contraste elegía bien blanco/negro, pero
> varios textos secundarios (etiquetas "Líder de Red"/"Supervisor de Red",
> contador de Casas de Paz, nombre de responsable) aplicaban `opacity`
> reducida encima de ese color, lo que los acerca matemáticamente al fondo y
> baja el contraste real por debajo de 4.5:1 en colores saturados (ej. rosa
> `#db2777`, azul `#2563eb`). Se quitó la opacidad de esos textos en
> `NodoEstructura.tsx` (Departamento y Red) — verificado con un cálculo WCAG
> real sobre los 36 textos visibles en el lienzo, los 36 ahora cumplen ≥4.5:1.

**REQ-RED-4** — THE sistema SHALL permitir cambiar nombre, color, Líder y
Supervisor de Red conservando el historial de asignaciones.

**REQ-RED-7** — WHEN se elimina una Red, THE sistema SHALL marcarla con
`fecha_eliminacion` (nunca borrado físico) y mantenerla visible en el lienzo,
agrisada, durante 1 año antes de desaparecer del panel. THE panel SHALL
ofrecer "Reactivar Red" durante ese período, con confirmación explícita
(OTP si el módulo lo exige, mensaje de advertencia siempre).

> Hecho 2026-08-06: `fn_estructura_eliminar_red` / `fn_estructura_reactivar_red`
> (soft-delete vía `fecha_eliminacion`, permiso `fn_estructura_puede_administrar`,
> OTP opcional vía `fn_estructura_exigir_otp`). Botón "Eliminar Red" en el pie
> del panel (solo si no está eliminada) + vista de solo lectura con banner
> ámbar y botón "Reactivar Red" cuando sí lo está. Confirmación con
> `ConfirmarQuitarDialog` (rojo) en ambos sentidos.
>
> Bug encontrado y corregido en el mismo bloque: la política RLS
> `pol_red_select` filtraba `fecha_eliminacion IS NULL` sin excepción, así
> que una Red eliminada desaparecía del todo en vez de verse agrisada
> (el filtro del lado del cliente en `estructura.service.ts` no alcanza si
> RLS ya la bloquea antes). Corregido en la migración
> `20260806010000_estructura_red_select_periodo_gracia.sql` para permitir
> `fecha_eliminacion >= now() - interval '1 year'`. Verificado en vivo
> (eliminar → agrisado con "Eliminada" → reactivar → vuelve a editable).
>
> Este fix además reveló ~13 Redes de prueba de sesiones anteriores
> (`__...Browser...`, `QA ...`, "Red Prueba Membresia") que quedaron con
> `fecha_eliminacion` puesta pero invisibles por el bug — no eran visibles
> antes de hoy y ahora aparecen agrisadas en "Centro de Vida El Eden" hasta
> que cumplan 1 año o alguien las purgue a mano. Se dejaron intactas
> (no son de este bloque de trabajo y purgarlas implica limpiar referencias
> en `fusion_red`/`multiplicacion_red`/`invitacion_lider`); solo se
> hard-borraron las 2 filas de prueba creadas hoy mismo para esta
> verificación (`Prueba Eliminar`, `Red Prueba Colores A`), sin dependientes.

**REQ-RED-5** — “Supervisor de Red”, “Supervisor de la Red en Acción” y el código
existente `SUBLIDER_RED` SHALL representar el mismo cargo. La etiqueta oficial
de interfaz SHALL ser “Supervisor de Red”.

**REQ-RED-6** — THE Supervisor de Red SHALL conservar la paridad funcional ya
definida con el Líder de Red; este paquete no crea un rol de sistema nuevo.

## 8. Casas de Paz

**REQ-CDP-1** — THE sistema SHALL permitir crear una Casa de Paz dentro de una
Red seleccionada aunque todavía no tenga líder, anfitrión o dirección.

**REQ-CDP-2** — THE Casa de Paz SHALL pertenecer a exactamente una Red vigente y
SHALL heredar su color únicamente como acento visual.

**REQ-CDP-3** — THE formulario inicial SHALL ser minimalista y SHALL NOT exigir
horario, estado, anfitrión, dirección ni sublíderes. Estos datos MAY completarse
después.

**REQ-CDP-4** — THE Casa de Paz SHALL NOT tener nombre propio ni solicitar un
campo de nombre. WHERE exista líder, la tarjeta SHALL usar el nombre del líder
como referencia principal; WHERE no exista, SHALL mostrar “Líder sin asignar”.

**REQ-CDP-5** — Debajo de la referencia principal, WHERE exista la dirección del
anfitrión o lugar de reunión, la tarjeta SHALL mostrar una versión breve; WHERE
no exista, SHALL mostrar “Dirección pendiente” sin bloquear la entidad.

**REQ-CDP-6** — THE sistema SHALL permitir N sublíderes de CdP, uno por operación,
sin duplicados ni permitir que el líder vigente sea también sublíder de la misma CdP.

**REQ-CDP-7** — THE sistema SHALL permitir asignar después anfitrión, dirección,
líder y sublíderes reutilizando los modelos existentes.

**REQ-CDP-8** — WHERE una Casa de Paz todavía no tenga líder, su tarjeta SHALL
usar fondo gris y texto negro con contraste suficiente. Sus acciones SHALL ser
“Asignar líder” y, si corresponde, “Añadir dirección”; SHALL NOT mostrar
“Escribir nombre”.

## 9. Asignación por doble vía

**REQ-ASG-1** — Cada cargo administrable SHALL ofrecer dos opciones: “Desde la
base de datos” y “Por correo electrónico”.

**REQ-ASG-2** — En “Desde la base de datos”, THE sistema SHALL buscar de forma
progresiva por nombre y SHALL mostrar nombre completo y correo. Solo personas
de la iglesia/alcance autorizado podrán seleccionarse.

**REQ-ASG-3** — THE sistema SHALL asignar una persona por operación y SHALL
reutilizar el buscador existente; SHALL NOT crear un buscador paralelo.

**REQ-ASG-4** — En “Por correo”, THE sistema SHALL permitir designar los cargos
funcionales disponibles del constructor: Pastor, Supervisor de la Visión,
Líder de Afirmación, Líder y Supervisor de Red, Líder y Sublíder de CdP y
Anfitrión. Evangelismo, Discipulado y Envío SHALL permanecer sin acción de
asignación mientras esos cargos no existan en el sistema.

**REQ-ASG-5** — La designación es una decisión de la iglesia, no una solicitud
de consentimiento. THE sistema SHALL crear inmediatamente la asignación o
reserva organizacional y SHALL mostrarla con estado “Confirmación pendiente”.

**REQ-ASG-6** — WHERE la persona no tenga cuenta completa, THE correo SHALL
permitir confirmar lectura, establecer contraseña y completar/vincular su registro.

**REQ-ASG-7** — WHERE el correo ya pertenezca a una persona registrada, THE
sistema SHALL notificar el nuevo cargo y ofrecer “Confirmar que vi mi nueva
designación”, sin pedir que acepte o rechace el nombramiento.

**REQ-ASG-8** — Antes de confirmar lectura, THE asignación SHALL verse con un
punto gris y los permisos del cargo SHALL permanecer inactivos. Después de
confirmar y completar la cuenta, SHALL verse un punto verde y habilitar permisos.

**REQ-ASG-9** — THE sistema SHALL NOT usar estado rojo ni flujo “rechazado” para
estas designaciones.

**REQ-ASG-10** — THE administrador SHALL poder reenviar la notificación, corregir
un correo pendiente o cancelar la designación. Corregir/cancelar SHALL invalidar
enlaces anteriores.

> Hecho 2026-08-05 (Líder/Supervisor de Red): `fn_cancelar_invitacion_lider`
> (soft-delete de `invitacion_lider`/`usuario_rol`) + acciones `cancelar`/
> `corregir` en la Edge Function `invitar-lider` (corregir = cancelar +
> re-invitar con el correo nuevo). La cuenta huérfana de `auth.users` no se
> puede borrar (FK desde el soft-delete histórico) — se banea permanentemente
> (`ban_duration`), invalida el enlace igual. Botones "Reenviar/Corregir
> correo/Cancelar designación" en `PanelRedEstructura.tsx`. **3 bugs reales
> de permiso encontrados y corregidos en el camino** (Super Admin no podía
> designar por correo ni cancelar): `fn_puede_invitar_lider`, el trigger
> `fn_validar_asignacion_rol`, y mi propio `fn_cancelar_invitacion_lider` —
> ninguno tenía bypass de Super Admin. Verificado en vivo con Playwright
> (crear → corregir → cancelar, en "Centro de Vida El Eden"). Ver KAN-56/61.

**REQ-ASG-11** — THE sistema SHALL impedir duplicar correo, persona o el mismo
cargo vigente/pending en la misma entidad.

> Verificado 2026-08-06 (item 9, KAN-61): el caso "correo ya existe" ya
> estaba resuelto desde una sesión anterior (2026-08-02, código de
> `invitar-lider`/`invitar-usuario`) — distingue si la cuenta existente ya
> tiene una Persona vinculada (mensaje: buscarla por nombre en vez de
> invitar de nuevo) o si quedó huérfana (mensaje: avisar al equipo técnico,
> un Super Admin debe vincularla a mano). Probado en vivo en Redes con un
> correo real (`astlimbark@gmail.com`, ya con Persona): toast correcto,
> ninguna fila quedó creada. Sin cambios de código — solo verificación.

## 10. OTP exclusivo del constructor

**REQ-OTP-1** — Cada iglesia SHALL tener una configuración independiente
`otp_requerido_estructura`, con valor por defecto `false`.

**REQ-OTP-2** — THE switch SHALL aparecer de forma visible pero discreta en la
barra del lienzo y SHALL indicar claramente “Protección OTP”.

**REQ-OTP-3** — THE Super Admin y el Supervisor de la Visión de la iglesia SHALL
poder activar el switch.

**REQ-OTP-4** — WHEN la protección esté activa, desactivarla SHALL requerir un
OTP válido. Activarla desde estado apagado no requiere OTP.

**REQ-OTP-5** — WHERE el switch esté apagado, solo las acciones ejecutadas desde
este constructor MAY omitir OTP. Los demás paneles y RPC existentes SHALL
conservar sus reglas actuales sin cambios.

**REQ-OTP-6** — WHERE el switch esté encendido, las escrituras sensibles del
constructor SHALL exigir el OTP existente de Supabase.

**REQ-OTP-7** — Todo cambio del switch SHALL quedar auditado con iglesia,
usuario, valor anterior, valor nuevo y fecha.

## 11. Interacción minimalista

**REQ-UI-1** — Las tarjetas SHALL mostrar solamente identidad, responsable,
estado de confirmación y acciones esenciales. Reenviar, corregir y detalles
SHALL vivir en el panel lateral para evitar ruido.

**REQ-UI-2** — Los formularios y detalles SHALL abrir en un panel derecho en
desktop y en pantalla completa o bottom sheet en espacios pequeños.

**REQ-UI-3** — WHEN un panel esté abierto, THE sistema SHALL aplicar scrim al
lienzo, mantener el origen seleccionado sobre el scrim y bloquear interacciones
accidentales con el fondo.

**REQ-UI-4** — THE panel SHALL cerrarse mediante X y Cancelar. Clic fuera MAY
cerrarlo solo cuando no haya datos sin guardar.

**REQ-UI-5** — THE sistema SHALL proporcionar tooltips para iconos, iniciales y
acciones compactas; en táctil SHALL existir alternativa por toque o pulsación.

**REQ-UI-6** — THE búsqueda SHALL encontrar personas y entidades, mostrar su
ruta jerárquica y centrar/resaltar el resultado elegido.

## 12. Móvil, accesibilidad y rendimiento

**REQ-MOB-1** — THE lienzo SHALL soportar pan con un dedo y zoom de pellizco con
dos dedos, sin exigir zoom del navegador.

**REQ-MOB-2** — THE módulo SHALL ofrecer “Modo organizar” en táctil. Fuera de ese
modo, arrastrar un nodo SHALL desplazar el lienzo y no cambiar posiciones.

**REQ-MOB-3** — Los controles táctiles SHALL tener área aproximada mínima de
44×44 px; ningún formulario o acción principal SHALL quedar cortado.

**REQ-MOB-4** — THE cambio de orientación SHALL conservar datos de formularios,
nodo seleccionado y, cuando sea posible, cámara.

**REQ-MOB-5** — THE sistema SHALL ser utilizable con teclado: enfocar nodo,
abrir detalles, mover en modo organizar y accionar controles con Enter/Espacio.

**REQ-MOB-6** — THE selección SHALL usar más que color (borde, sombra y estado
accesible). Todos los controles SHALL tener nombre accesible.

**REQ-REN-1** — THE lienzo SHALL mantener interacción fluida con estructuras
grandes y SHALL evitar renderizar nuevamente todos los nodos por cambios locales.

**REQ-REN-2** — THE sistema SHALL cargar primero estructura resumida y SHALL
cargar detalles extensos solamente al seleccionar un nodo.

## 13. Integridad, auditoría y errores

**REQ-INT-1** — Toda relación organizacional SHALL usar tablas históricas
existentes; mover un nodo SHALL NOT modificar cargos o pertenencias.

**REQ-INT-2** — THE sistema SHALL preservar soft delete y SHALL NOT ejecutar
borrados físicos.

**REQ-INT-3** — Toda nueva tabla expuesta SHALL habilitar RLS y aislar filas por
iglesia; `authenticated` sin predicado de tenancy no es autorización suficiente.

**REQ-INT-4** — Las operaciones compuestas SHALL ser transaccionales. Una falla
no SHALL dejar CdP, cargos, invitaciones o posiciones parcialmente creadas.

**REQ-INT-5** — THE interfaz SHALL traducir errores de negocio a mensajes que
expliquen qué ocurrió y cómo corregirlo, sin exponer SQL ni datos sensibles.

## 14. Trazabilidad Jira

| Jira | Cobertura principal |
|---|---|
| KAN-52 | Épica completa: Constructor visual de estructura organizacional |
| KAN-53 | Acceso y barra superior — ya implementada; corregir nombre de iglesia |
| KAN-54 | REQ-LI, REQ-JER, búsqueda y visualización |
| KAN-55 | REQ-UI: panel, scrim, selección, tooltips |
| KAN-56 | REQ-ASG: componente reutilizable y búsqueda |
| KAN-57 | REQ-JER, REQ-DEP, Supervisor(es) |
| KAN-58 | REQ-RED |
| KAN-59 | REQ-CDP-1 a REQ-CDP-5 y REQ-CDP-8 |
| KAN-60 | REQ-CDP-6 y visualización compacta |
| KAN-61 | REQ-ASG-4 a REQ-ASG-11 |
| KAN-62 | REQ-INT y pruebas integrales, incluyendo capturas por iglesia |
| KAN-63 | REQ-MOB y REQ-REN |
| KAN-75 | REQ-LI-4 a REQ-LI-9: posiciones, cuadrícula y organizar |
| KAN-76 | REQ-PER y contrato seguro de base de datos/RPC/RLS |
| KAN-77 | REQ-OTP: protección exclusiva del constructor |

## 15. Fuera de alcance

- Definir el comportamiento futuro del Pastor dentro del constructor.
- Crear, convertir o administrar iglesias madre/hija/satélite desde este lienzo.
- Cambiar la lógica global de OTP de otros módulos.
- Rediseñar dashboards de Líder de Red, Supervisor de Red, Líder o Sublíder de CdP.
- Crear una app móvil nativa.
- Permitir editar conexiones libremente como si fueran dibujos sin reglas de negocio.
