# Requisitos — Dashboards

## Introducción

Los cinco dashboards del Módulo 1: líder de CdP, sublíder de CdP, líder de red, supervisor y pastor. Cada uno ve lo suyo y nada más.

El contenido de cada pantalla sale de `software/dashboards/`. Este documento define lo que la base tiene que exponer para que esas pantallas existan, y lo que el frontend nunca debe calcular por su cuenta.

## Glosario

- **Dashboard**: Pantalla principal de un rol.
- **KPI**: Número destacado con su comparación contra el período anterior.
- **Alcance**: Conjunto de datos que un rol puede ver. Sale de RLS, no del frontend.
- **Iglesia_Activa**: La Iglesia que el usuario tiene seleccionada cuando tiene acceso a varias.
- **Seccion_Configurable**: Bloque del dashboard que el Supervisor puede activar o desactivar.
- **Alerta**: Aviso de una condición que requiere acción.

## Requisitos

### Requisito 1: Alcance

**Historia:** Como pastor, quiero certeza de que cada rol ve exactamente lo que le toca.

#### Criterios de aceptación

1. THE Sistema SHALL derivar el Alcance de cada Dashboard de RLS, y SHALL NOT depender de filtros del frontend.
2. THE Sistema SHALL restringir el Dashboard del Líder de CdP a las Casas de Paz donde tiene cargo vigente.
3. THE Sistema SHALL restringir el Dashboard del Líder de Red a las Casas de Paz de las Redes donde tiene cargo vigente.
4. THE Sistema SHALL restringir el Dashboard del Supervisor a la Iglesia_Activa.
5. THE Sistema SHALL exponer al Pastor todas sus Iglesias, con selector y vista consolidada.
6. WHERE un Usuario tiene acceso a varias Iglesias, THE Sistema SHALL exigir que toda consulta de Dashboard filtre por la Iglesia_Activa.
7. IF una consulta de Dashboard no filtra por Iglesia_Activa cuando el Usuario tiene varias, THEN THE Sistema SHALL considerar esa consulta inválida.

### Requisito 2: Dashboard del Líder de CdP

**Historia:** Como líder de casa de paz, quiero ver cómo va mi casa y a quién tengo que llamar.

#### Criterios de aceptación

1. THE Sistema SHALL exponer como KPI: miembros activos, asistencia de la última reunión, ofrendas del mes y diezmos del mes.
2. THE Sistema SHALL exponer cada KPI con su valor del período anterior comparable.
3. THE Sistema SHALL exponer la asistencia de las últimas 8 reuniones reportadas.
4. THE Sistema SHALL exponer la lista de Miembro_CdP con: nombre, Estado, semanas desde la última asistencia y estado civil.
5. THE Sistema SHALL exponer los ingresos del mes desglosados por Tipo_Ingreso y Moneda.
6. THE Sistema SHALL exponer los datos de la Casa_De_Paz: Etiqueta_CdP (`fn_etiqueta_cdp`, [03-estructura](../03-estructura/requirements.md#requisito-2-casa-de-paz)), Red, cantidad de miembros y fecha de la última reunión.
7. THE Sistema SHALL contar las últimas 8 reuniones sobre reuniones reportadas, y SHALL NOT usar las últimas 8 semanas del calendario.

### Requisito 3: Dashboard del Sublíder

**Historia:** Como supervisor, quiero controlar qué ve el sublíder de cada casa.

#### Criterios de aceptación

1. THE Sistema SHALL exponer al Sublíder las mismas secciones que al Líder, filtradas por configuración.
2. THE Sistema SHALL definir como visibles por defecto: formulario de reporte, asistencia y lista de miembros.
3. THE Sistema SHALL definir como ocultas por defecto: ofrendas, gráficos e historial.
4. THE Sistema SHALL permitir al Supervisor activar o desactivar cada Seccion_Configurable.
5. THE Sistema SHALL aplicar la configuración en la base de datos, y SHALL NOT ocultar datos solo en el frontend.
6. THE Sistema SHALL impedir al Sublíder editar la lista de miembros.

### Requisito 4: Dashboard del Líder de Red

**Historia:** Como líder de red, quiero comparar mis casas de paz y saber cuál se está cayendo.

#### Criterios de aceptación

1. THE Sistema SHALL exponer como KPI: Casas de Paz activas, miembros totales, asistencia promedio y ofrendas del mes.
2. THE Sistema SHALL exponer la asistencia de la última reunión de cada Casa_De_Paz de la Red.
3. THE Sistema SHALL exponer el ranking de Casas de Paz ordenado por asistencia.
4. THE Sistema SHALL exponer las Casas de Paz sin Reporte de la semana en curso.
5. THE Sistema SHALL exponer los ingresos de la Red desglosados por Casa_De_Paz, Tipo_Ingreso y Moneda.
6. THE Sistema SHALL calcular la asistencia promedio como el promedio de asistentes por reunión reportada en el período, y SHALL NOT dividir por cero cuando no hay reuniones.

### Requisito 5: Dashboard del Supervisor

**Historia:** Como supervisor, quiero ver todo lo de mi iglesia y qué está roto.

#### Criterios de aceptación

1. THE Sistema SHALL exponer como KPI: Redes, Casas de Paz, miembros totales, asistencia general y ofrendas del mes.
2. THE Sistema SHALL exponer, por cada Red: cantidad de Casas de Paz, miembros, asistencia promedio y estado.
3. THE Sistema SHALL exponer los 4 Departamentos con la cantidad de personas activas y su tendencia.
4. THE Sistema SHALL ocultar los Departamentos desactivados de la Iglesia_Activa.
5. THE Sistema SHALL exponer como Alerta: Casas de Paz sin reportar esta semana.
6. THE Sistema SHALL exponer como Alerta: Redes sin Encargado de Departamentos o sin Encargado de Ministerio.
7. THE Sistema SHALL exponer como Alerta: Miembro_CdP que superan `INASISTENCIAS_PARA_INACTIVO`.
8. THE Sistema SHALL exponer como Alerta: Reportes donde Evangelizados_Declarados difiere de Evangelizados_Registrados.
9. THE Sistema SHALL exponer como Alerta: Casas de Paz sin Red vigente.
10. THE Sistema SHALL exponer como Alerta: Iglesias sin Pastor o sin Supervisor asignado.
11. THE Sistema SHALL NOT permitir descartar las Alertas: se resuelven corrigiendo la causa.

### Requisito 6: Dashboard del Pastor

**Historia:** Como pastor, quiero comparar mis iglesias entre sí.

#### Criterios de aceptación

1. THE Sistema SHALL exponer el selector de Iglesias del Pastor.
2. THE Sistema SHALL exponer la vista consolidada de todas sus Iglesias.
3. THE Sistema SHALL exponer como KPI consolidado: cantidad de Iglesias, miembros totales, asistencia general y ofrendas totales.
4. THE Sistema SHALL exponer, por cada Iglesia: nombre, ciudad, miembros, asistencia, cantidad de Redes y estado.
5. THE Sistema SHALL desglosar los ingresos consolidados por Iglesia, Tipo_Ingreso y Moneda.
6. IF las Iglesias del Pastor usan Monedas distintas, THEN THE Sistema SHALL exponer los totales por Moneda separados, y SHALL NOT sumarlos.
7. THE Sistema SHALL permitir descender de una Iglesia a sus Redes y de una Red a sus Casas de Paz.

### Requisito 7: Cálculo

**Historia:** Como arquitecto, quiero que la web y la app móvil muestren el mismo número.

#### Criterios de aceptación

1. THE Sistema SHALL calcular todo KPI en la base de datos.
2. IF un KPI se calcula en el frontend, THEN THE Sistema SHALL considerar ese diseño inválido.
3. THE Sistema SHALL exponer cada Dashboard como una o pocas llamadas, y SHALL NOT requerir una llamada por tarjeta.
4. THE Sistema SHALL devolver todo total monetario acompañado de su Moneda.
5. THE Sistema SHALL devolver `NULL` en lugar de cero cuando un porcentaje no es calculable por división por cero.
6. THE Sistema SHALL responder cada consulta de Dashboard en menos de 2 segundos con los datos del despliegue inicial.

### Requisito 8: Terminología

**Historia:** Como pastor, quiero que "miembros" signifique siempre lo mismo.

#### Criterios de aceptación

1. THE Sistema SHALL distinguir Miembro_CdP de Miembro_Iglesia en todo Dashboard.
2. IF un Dashboard muestra "miembros" sin especificar cuál, THEN THE Sistema SHALL considerar ese diseño inválido.
3. THE Sistema SHALL exponer los conteos de Estado separando menores y mayores de `EDAD_MINIMA_CREYENTE`.
4. THE Sistema SHALL NOT sumar los NC menores con los NC mayores en un solo número.
