# 17 — Matriz funcional de roles y alcances

> Fuente de verdad funcional para KAN-130. Esta matriz separa panel, alcance,
> navegación y color fijo de navbar. Los colores dinámicos de entidades no se
> usan como colores del panel.

## Reglas cerradas

1. Cada cargo con pantalla o navegación propia es un contexto independiente.
2. El usuario utiliza un solo contexto a la vez, aunque conserve todos sus permisos reales.
3. Ningún cargo adicional inyecta opciones en el sidebar del contexto activo.
4. El contexto identifica Rol UI, iglesia y entidad de alcance cuando corresponde.
5. El color del navbar es fijo por Rol UI y se define en el catálogo central.
6. El color de una Red es dinámico, vive en Supabase y solo identifica esa Red.
7. Crear, editar o desactivar una Red no modifica la configuración visual de los roles.
8. Un rol futuro debe declarar alcance, selector, navegación, ruta inicial y tema antes de incorporarse.

## Matriz

| Contexto | Alcance | Selector multirol | Panel independiente | Navbar actual comprobado |
|---|---|---:|---:|---|
| Super Admin | Global | Sí | Sí | Oscuro `#0A0E1A` |
| Pastor | Iglesia | Sí | Sí | Propuesto `#7A2948` |
| Supervisor de la Visión en Acción | Iglesia | Sí | Sí | Propuesto `#0F766E` |
| Líder del Departamento de Afirmación | Departamento + iglesia | Sí | Sí | Propuesto `#0071E3` |
| Líder de Red | Red + iglesia | Una opción por Red | Sí | Azul `#4E73B7` |
| Supervisor de Red | Red + iglesia | Una opción por Red | Comparte funciones con Líder de Red, identidad visual propia | Propuesto `#5B4BB7` |
| Líder de Casa de Paz | CdP + Red + iglesia | Una opción por CdP | Sí | Propuesto `#B45309` |
| Sublíder de Casa de Paz | CdP + Red + iglesia | Una opción por CdP | Sí | Blanco nieve `#FFFAFA` |
| Líder de Jóvenes | Iglesia | Sí | Sí, solo lectura actualmente | Temporal: blanco nieve `#FFFAFA` |
| Encargado de Matrimonios | Iglesia | Sí | Sí, solo lectura actualmente | Temporal: blanco nieve `#FFFAFA` |
| Encargado de Calendario (futuro) | Iglesia | Sí | Sí; calendario, eventos y banner de entrada | Propuesto `#6D28D9` |

`SIN_ROL` no es un panel. Es un estado de acceso sin contexto operativo y no
recibe sidebar, navbar temático ni rutas de otro cargo.

## Colores que no son navbar

- `red.color`: color dinámico elegido por cada Red.
- `ROL_UI_META.color`: color visual actual de chips/tarjetas del selector.
- `NavItem.color`: color del ícono de cada sección del sidebar.
- `departamento.color`: color oficial del departamento.

Estos valores pueden coincidir visualmente, pero no se sustituyen entre sí y
deben tener fuentes de verdad separadas.

## Paleta provisional para KAN-133

Los colores marcados como `Propuesto` se centralizarán en un único catálogo y
quedarán pendientes de revisión visual del owner al finalizar KAN-133. Cambiar
un color fijo debe requerir modificar una sola entrada. Los roles aún marcados
como temporales conservan blanco nieve; nunca usan `red.color` como reemplazo.
