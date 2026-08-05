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

**REQ-DEP-4** — WHERE un departamento no tenga líder vigente, THE tarjeta SHALL
mostrar color tenue y “Líder sin asignar”. WHERE tenga líder confirmado, SHALL
mostrar el color con intensidad normal.

**REQ-DEP-5** — Asignar un líder SHALL cambiar automáticamente la representación
visual a activa. Este estado visual SHALL derivarse de la asignación vigente y
SHALL NOT cambiar `departamento.activo`.

**REQ-DEP-6** — En la etapa actual, THE sistema SHALL permitir asignar o cambiar
únicamente al Líder de Afirmación por persona existente o por correo. Evangelismo,
Discipulado y Envío SHALL permanecer visibles pero sin acción de asignación hasta
que su funcionalidad exista en el sistema.

**REQ-DEP-7** — THE cuatro Departamentos SHALL distribuirse en una sola fila
horizontal. Los datos del líder y futuras entidades propias de cada Departamento
SHALL crecer verticalmente debajo de su tarjeta.

## 7. Redes y Supervisor de Red

**REQ-RED-1** — THE sistema SHALL permitir crear una Red sin Líder ni Supervisor
de Red.

**REQ-RED-2** — THE creación de Red SHALL aceptar nombre y color hexadecimal
válido, ofrecer paleta y vista previa, y advertir —sin bloquear— colores ya usados.

**REQ-RED-3** — THE texto sobre el color de Red SHALL alcanzar contraste legible
calculado automáticamente.

**REQ-RED-4** — THE sistema SHALL permitir cambiar nombre, color, Líder y
Supervisor de Red conservando el historial de asignaciones.

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

**REQ-ASG-11** — THE sistema SHALL impedir duplicar correo, persona o el mismo
cargo vigente/pending en la misma entidad.

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
