# Harness — VisionHub

Especificaciones técnicas para construir VisionHub. Cada área tiene tres documentos:

| Archivo | Contenido |
|---------|-----------|
| `requirements.md` | Qué debe hacer el sistema. Criterios de aceptación en formato EARS (`THE ... SHALL`, `WHEN ... THEN`, `IF ... THEN`, `WHERE ...`). Verificables, sin ambigüedad. |
| `design.md` | Cómo se construye. Tablas, políticas RLS, funciones, endpoints, decisiones y sus razones. |
| `tasks.md` | En qué orden se implementa. Lista accionable, cada tarea referencia los requisitos que cumple. |

---

## Áreas

| # | Área | Contenido |
|---|------|-----------|
| [00](00-fundacion/) | Fundación | Convenciones, UUID, auditoría, soft delete, nomenclatura, SOLID |
| [01](01-tenancy-iglesias/) | Tenancy e iglesias | Iglesia madre/hija, RLS, Supabase Auth, alta en cadena |
| [02](02-persona-parentela/) | Persona y parentela | Nombres, apellido casada, dirección, teléfono, familia, conteo de familias |
| [03](03-estructura/) | Estructura organizacional | Red, casa de paz, cargos, ministerios, membresía |
| [04](04-reporte-cdp/) | Reporte de CdP | Formulario semanal, asistencia por persona, temas y libros |
| [05](05-estados-ssva/) | Estados SSVA | SIM, NC, CRE, RE + motor de criterios configurables |
| [06](06-evangelismo-cdp/) | Evangelismo de CdP | Escala casa de paz |
| [07](07-calendario-eventos/) | Calendario y eventos | Eventos, rangos de fechas, Mega Fiesta |
| [08](08-finanzas-cdp/) | Finanzas de CdP | Ofrendas, diezmos, moneda |
| [09](09-dashboards/) | Dashboards | Líder CdP, sublíder, líder de red, supervisor, pastor |
| [10](10-panel-supervisor/) | Panel del Supervisor | Criterios configurables, catálogos, formularios |
| [11](11-esquema-bd/) | Esquema de BD | DDL completo, RLS, seeds |
| [12](12-pruebas-curl/) | Pruebas con curl | Arnés de verificación contra Supabase |
| [13](13-registro-publico-cdp/) | Registro público por URL | Enlace único por líder de CdP, formulario sin login, modalidad de registro |
| [99](99-modulos-futuros.md) | Módulos futuros | Esbozo de los módulos 2 al 6 |

---

## Alcance

**Entra ahora (Módulo 1):** configuración de iglesias, formulario de CdP web, dashboards de los 5 roles, formulario de membresía, finanzas de CdP, evangelismo de casa de paz, calendario de eventos, panel del Supervisor acotado a casas de paz, registro público de personas por URL de líder de CdP (`nuevos_requisitos.txt`, 2026-07-18).

**No entra ahora:** app móvil, Departamento de Evangelismo (escala red/iglesia/cobertura), Afirmación, Discipulado, Envío, contabilidad general. Ver [99-modulos-futuros.md](99-modulos-futuros.md).

---

## Orden de trabajo

1. Se documenta (esta carpeta).
2. Se revisa el esquema de BD ([11-esquema-bd/](11-esquema-bd/)) y se aprueba.
3. Se crea la cuenta de Supabase y se aplica el esquema.
4. Se verifica todo con curl ([12-pruebas-curl/](12-pruebas-curl/)).
5. Se revisa la IU existente.
6. Se conecta el frontend.

El backend y la base de datos van **primero**. El frontend se conecta después, nunca al revés.

---

## Decisiones tomadas

Cerradas con el owner antes de escribir estas specs. Se listan porque contradicen partes de la documentación previa.

| Tema | Decisión | Contradice |
|------|----------|-----------|
| **Autenticación** | Supabase Auth por email. Sin username, sin hasheo propio, sin bloqueo casero. | `software/modulos.md` pedía username + email y lógica de auth propia. |
| **Backend** | Supabase es el backend completo. No hay servidor propio. | `iu/` referencia un `backend/` de una arquitectura anterior. |
| **Neo4j** | Descartado. La BD es PostgreSQL en Supabase. | `neo4j/` y `VisionHub_Grafo_v2_Final.md` modelan el dominio como grafo. |
| **Asistencia** | El reporte semanal registra **qué personas** asistieron. Los totales menores/mayores se calculan. | `domain_knowledge/casas-de-paz/reporte.md` pedía solo dos números. Con números sueltos, los 4 criterios de CdP son incalculables. |
| **Estados SSVA** | Solo SIM, NC, CRE, RE. DA y DI esperan a Discipulado (Módulo 4). | `estados/estados.md` define los 6 estados como un solo sistema. |
| **NC → CRE** | 2 visitas consecutivas a la CdP. Configurable. | `estados/criterios.md` lo definía como "1 semana sin discipulado", que depende del Módulo 4. |
| **Edad para CRE** | Se mantiene el mínimo de 12 años. Los menores recurrentes permanecen en NC. | — (decisión explícita del owner). Ver riesgo en [05-estados-ssva/design.md](05-estados-ssva/design.md). |
| **RE** | Automático: +3 meses sin asistir y retorna. No depende de Discipulado. | `estados/criterios.md` lo ataba a la transición RE → DA, que sí depende. |
| **Evangelismo** | Escala `casa_de_paz` entra ahora. El Departamento (escalas red, iglesia, cobertura) es Módulo 2. | — (aclaración del owner sobre `modulos.md`). |
| **Calendario** | Entra ahora, porque el frontend ya lo tiene construido. | `modulos.md` no lo listaba en los 9 componentes del Módulo 1. |
| **App móvil** | Después de la web. La web se diseña para que la móvil entre sin rehacer nada. | `modulos.md` la listaba como componente 2 del Módulo 1. |

### Ambigüedades del dominio resueltas

| Ambigüedad | Resolución |
|-----------|-----------|
| **"Supervisor de la Visión en Acción"** vs **"Líder de la Visión en Acción"** | Es el mismo rol. `domain_knowledge/cargos/cargos.md` y `software/bd-modelo.md` lo describen con la misma frase ("mismos privilegios que el pastor pero recibe órdenes directas de él, es su brazo operativo"). Se unifica como **Supervisor de la Visión en Acción**. |
| **"Miembro"** con dos significados | `cargos/cargos.md` dice a la vez que miembro es "quien se bautiza" y "quien asiste por segunda vez consecutiva". Son dos conceptos distintos: **miembro de CdP** (2 visitas, automático) y **miembro de la iglesia** (bautizo, Módulo 3). Se modelan separados. |
| **NC = "Nuevo Convertido"** vs **"Nuevo Creyente"** | `estados/estados.md` dice Convertido; `glosario/glosario.md` dice Creyente. Se adopta **Nuevo Convertido**, que es el uso mayoritario y evita colisión con CRE (Creyente). |
| **Cochabamba: madre real, no dada de alta** | El modelo la soporta desde el día uno vía `iglesia_padre_id` nulo. Santa Cruz y Montero se crean con `iglesia_padre_id = NULL` y se reasignan cuando Cochabamba entre. Sin migración. |

---

## Fuentes

- `domain_knowledge/` — cómo funciona la iglesia sin software. Fuente de verdad del dominio.
- `software/` — cómo debería funcionar el software, según entrevistas.
- `iu/` — especificaciones del frontend ya construido (~80%). **Solo el front**; el `backend/` que menciona está descartado.
- `nuevos_requisitos.txt` — feature nueva de registro público por URL (2026-07-18), cerrada en [13-registro-publico-cdp/](13-registro-publico-cdp/).
- `Skills/solid.md` — principios SOLID aplicados en [00-fundacion/](00-fundacion/).
