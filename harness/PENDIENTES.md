# Pendientes del Owner

**Estado:** esperando respuestas. Fecha: 2026-07-16.

Son 10 preguntas que bloquean el paso a Supabase. Contestá abajo de cada una, en la línea `RESPUESTA:`. No hace falta que sean todas: las que contestes, se aplican; las que no, quedan acá.

Cuando estén listas, decime "ya contesté PENDIENTES" y sigo desde ahí.

**Este archivo se borra cuando todas estén resueltas y aplicadas en las specs.**

---

## 1. ¿"Familia" es hogar o linaje?

**Es la más importante de las 10.** Cambia el número de familias que le vas a reportar al pastor.

El sistema calcula una familia como el grupo de personas conectadas por parentesco directo. Hoy cuentan: cónyuge, hijos y abuelos — según dice `software/bd-modelo.md`.

El problema es el abuelo. Si el abuelo cuenta, tres generaciones colapsan en una sola familia:

```
Abuelo -- Padre -- Hijo     ->  el sistema cuenta 1 familia
```

Pero si el abuelo vive en su casa y el hijo casado en la suya, para la iglesia son dos hogares y el sistema va a reportar uno. El número te va a salir **más bajo** de lo que esperás.

| Opción | Qué pasa |
|--------|----------|
| **A. Hogar (Recomendado)** | Los abuelos NO cuentan. Cada pareja con sus hijos es una familia. El número refleja hogares. |
| **B. Linaje** | Los abuelos SÍ cuentan, como dice el doc actual. El número refleja troncos familiares y es más chico. |

Segunda parte: **¿los hermanos cuentan?** Hoy no. Si el padre está registrado, dos hermanos igual quedan juntos por el camino `hermano → padre → hermano`. Pero si el padre no está en el sistema, dos hermanos aparecen como dos familias separadas.

| Opción | Qué pasa |
|--------|----------|
| **A. No cuentan (Recomendado)** | Sigue el doc. Si el número sale alto, esta es la primera perilla a mover. |
| **B. Sí cuentan** | Dos hermanos solteros sin padres registrados cuentan como una familia. |

Las dos son configurables después desde tu panel, sin tocar código. Esto define el valor de arranque.

**RESPUESTA:**

---

## 2. ¿Un Reconciliado puede volver a ser Creyente?

Quedamos en que RE (Reconciliado) es automático: el que se alejó 3 meses y vuelve.

Pero los docs solo definen una salida de RE: `RE → DA` por asistir al discipulado. Y el discipulado es el Módulo 4, que todavía no existe. **O sea que hoy, quien entra en RE se queda en RE para siempre.**

Propuse: RE → CRE con 2 visitas consecutivas, el mismo criterio que NC → CRE.

| Opción | Qué pasa |
|--------|----------|
| **A. Sí, RE → CRE con 2 visitas (Recomendado)** | El que volvió y se quedó deja de figurar como recién reconciliado. Coherente con NC → CRE. |
| **B. No, RE es terminal hasta el Módulo 4** | El reconciliado queda en RE hasta que llegue Discipulado. Hay que decirlo en el dashboard para que el líder no crea que es un bug. |

**RESPUESTA:**

---

## 3. Los 52 temas de cada libro

Los reportes de casa de paz eligen Libro (1 a 7) y Tema (1 a 52) de "52 Lecciones de Vida". **Los nombres de los temas no están en ningún archivo del proyecto.**

Sin ellos siembro "Libro 3 — Tema 17" y el líder ve eso en el desplegable.

Necesito el índice de los 7 tomos. Si los tenés en PDF, foto o Excel, pasámelo y yo los cargo. Si no los tenés a mano, se puede arrancar con los nombres provisionales y vos los renombrás después desde tu panel — pero es cargar 364 temas a mano.

**RESPUESTA:**

---

## 4. ¿Qué son RMS, AVIVATE, HOMBRES, DEBORAS y MOS?

Son los tipos de evento del calendario. Salen del front que ya está construido, pero **no están explicados en ningún lado** de `domain_knowledge`.

Necesito una línea de cada uno para llenar la descripción del catálogo y sumarlos al glosario:

- **RMS:**
- **AVIVATE:**
- **HOMBRES:**
- **DEBORAS:**
- **MOS:**

**RESPUESTA:**

---

## 5. ¿La viuda conserva el apellido de casada?

En Bolivia, "María López" casada con "Juan Pérez" pasa a ser "María López de Pérez". Al divorciarse vuelve a "María López".

¿Y al enviudar? Los docs no lo dicen. Asumí que **sí lo conserva**, que es el uso que conozco, pero quiero confirmarlo con vos porque afecta cómo se imprime el nombre en documentos.

| Opción | Qué pasa |
|--------|----------|
| **A. Sí conserva (Recomendado)** | La viuda sigue siendo "María López de Pérez". |
| **B. No conserva** | Al enviudar vuelve a "María López García", igual que al divorciarse. |

**RESPUESTA:**

---

## 6. El cruce red × ministerio: ¿qué pasa con los que no tienen casa de paz?

El Encargado General de Ministerios necesita saber cuánta gente de cada red sirve en cada ministerio. El sistema lo calcula derivando la red desde la casa de paz de la persona.

Pero hay gente que sirve en un ministerio y no está en ninguna casa de paz. Hoy esa gente **no aparece** en el reporte.

| Opción | Qué pasa |
|--------|----------|
| **A. Mostrarlos como "Sin red" (Recomendado)** | Aparecen en una fila aparte. El encargado ve el total real y detecta a quién falta ubicar. |
| **B. Dejarlos fuera** | El reporte solo muestra a quienes tienen casa de paz. Los totales por red cierran, pero el total general no. |

**RESPUESTA:**

---

## 7. Los umbrales del semáforo de inactividad

`software/dashboards/lider-cdp.md` dice que "los que no asistieron hace mucho aparecen en amarillo o rojo", pero no dice a partir de cuándo.

Puse 2 semanas para amarillo y 4 para rojo. Es un número que inventé yo.

| Opción | Qué pasa |
|--------|----------|
| **A. 2 y 4 semanas (Recomendado)** | Amarillo al mes de faltar dos veces, rojo al mes. |
| **B. Otros valores** | Decime cuáles. |
| **C. Que sean configurables** | Van a tu panel como dos perillas más. |

**RESPUESTA:**

---

## 8. ¿Quién decide qué parientes cuentan para el conteo de familias?

Problema técnico con consecuencia real. La lista de tipos de parentesco (padre, hijo, abuelo...) es **una sola para todo el sistema**, compartida por las dos iglesias.

Eso significa que si el Supervisor de Montero decide que los abuelos no cuentan, **también cambia el conteo de familias de Santa Cruz**. Una iglesia estaría tocando el número de la otra.

| Opción | Qué pasa |
|--------|----------|
| **A. Que cada iglesia decida lo suyo (Recomendado)** | Un poco más de trabajo ahora. Montero y Santa Cruz cuentan familias como cada una quiera. |
| **B. Que sea una sola decisión para todas** | Más simple. Solo vos (admin técnico) podés cambiarlo, no los supervisores. Con dos iglesias que probablemente quieran lo mismo, alcanza. |

Con dos iglesias no es urgente. Con cinco, sí.

**RESPUESTA:**

---

## 9. El nombre del cargo del Supervisor

Cosmético pero hay que decidirlo antes de escribir el código.

El front ya construido usa `SUPERVISOR_VISION_ACCION`. Mi catálogo de cargos usa `SUPERVISOR_VISION`. Son el mismo rol; hay que elegir uno.

| Opción | Qué pasa |
|--------|----------|
| **A. Usar el del front: `SUPERVISOR_VISION_ACCION` (Recomendado)** | No se toca el front, que ya está al 80%. |
| **B. Usar el mío: `SUPERVISOR_VISION`** | Más corto, pero hay que cambiar el front. |

**RESPUESTA:**

---

## 10. ¿Muevo Neo4j a la basura?

Quedamos en que Neo4j está descartado. No lo moví porque prefiero no tocar archivos tuyos sin preguntarte.

Son: la carpeta `/neo4j` (manual, schema.cypher, seed_catalogs.cypher) y `VisionHub_Grafo_v2_Final.md` en la raíz.

| Opción | Qué pasa |
|--------|----------|
| **A. Moverlos a `/basura_no_leer` (Recomendado)** | Dejan de confundir. El grafo modelaba bien el dominio, pero contradice a Supabase. |
| **B. Dejarlos donde están** | Quedan como referencia. Riesgo: alguien los lee y cree que la BD es un grafo. |
| **C. Borrarlos** | Se van del todo. |

**RESPUESTA:**

---

## Notas

- Las respuestas a **1, 2, 6, 7 y 8** cambian el diseño. Voy a editar las specs correspondientes.
- Las de **3 y 4** son datos que faltan. No bloquean el esquema; bloquean que el sistema sea usable.
- Las de **5, 9 y 10** son chicas y se aplican al toque.
- Ninguna bloquea empezar a escribir el SQL, salvo la **1** y la **8**, que tocan el conteo de familias.

## Qué sigue cuando contestes

1. Aplico las respuestas a las specs afectadas.
2. Reviso el esquema completo con vos (`11-esquema-bd/design.md`, las 40 tablas).
3. Con tu aprobación y la cuenta de Supabase, escribo las migraciones.
4. Verifico todo con curl.
5. Recién ahí miramos la IU.
