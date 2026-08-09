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
| Pastor | Iglesia | Sí | Sí | Temporal: blanco nieve `#FFFAFA` |
| Supervisor de la Visión en Acción | Iglesia | Sí | Sí | Temporal: blanco nieve `#FFFAFA` |
| Líder del Departamento de Afirmación | Departamento + iglesia | Sí | Sí | Temporal: blanco nieve `#FFFAFA` |
| Líder de Red | Red + iglesia | Una opción por Red | Sí | Azul `#4E73B7` |
| Líder de Casa de Paz | CdP + Red + iglesia | Una opción por CdP | Sí | Temporal: blanco nieve `#FFFAFA` |
| Sublíder de Casa de Paz | CdP + Red + iglesia | Una opción por CdP | Sí | Blanco nieve `#FFFAFA` |
| Líder de Jóvenes | Iglesia | Sí | Sí, solo lectura actualmente | Temporal: blanco nieve `#FFFAFA` |
| Encargado de Matrimonios | Iglesia | Sí | Sí, solo lectura actualmente | Temporal: blanco nieve `#FFFAFA` |

`SIN_ROL` no es un panel. Es un estado de acceso sin contexto operativo y no
recibe sidebar, navbar temático ni rutas de otro cargo.

## Colores que no son navbar

- `red.color`: color dinámico elegido por cada Red.
- `ROL_UI_META.color`: color visual actual de chips/tarjetas del selector.
- `NavItem.color`: color del ícono de cada sección del sidebar.
- `departamento.color`: color oficial del departamento.

Estos valores pueden coincidir visualmente, pero no se sustituyen entre sí y
deben tener fuentes de verdad separadas.

## Decisión pendiente antes de KAN-133

Definir la paleta definitiva de navbar para los roles marcados como temporales.
Hasta entonces usan blanco nieve; nunca usarán `red.color` como reemplazo.
