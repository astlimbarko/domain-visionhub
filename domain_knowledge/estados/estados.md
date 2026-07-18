# Estados de una Persona

## Descripcion

La iglesia utiliza un sistema de seguimiento de estados (SSVA — sigla NO OFICIAL, solo documentacion interna). Los estados describen la situacion espiritual o administrativa de cada persona dentro de la iglesia.

## Estados disponibles

| Estado | Sigla | Descripcion |
|--------|-------|-------------|
| **Evangelizado** | SIM | Persona evangelizada que no avanza. Estado inicial. Si no avanza, se mantiene en SIM y revela que el lider designado debe llamarlo. |
| **Nuevo Convertido** | NC | Persona que acepta a Jesus por primera vez. Para asistentes nuevos. |
| **Creyente** | CRE | Persona que acepto a Jesus. Para asistentes regulares mayores de 12 anos. |
| **Reconciliado** | RE | Persona que estuvo +3 meses fuera y retorna. |
| **Discipulo Activo** | DA | Persona que asiste al discipulado (basta una vez). |
| **Discipulo Inactivo** | DI | Persona que abandono 3 clases continuas (3 semanas) del discipulado. Nunca aplica a quien nunca fue DA primero. |

**Estado eliminado:** AF (Afirmacion) — fue removido del SSVA. Las funciones de AF fueron absorbidas por Envio.

## Ciclo de vida

```
SIM (Evangelizado)
  |
  +-- NC (Nuevo Convertido) -- (si no asiste a discipulado, sigue NC)
  |     |
  |     +-- despues de 1 semana sin discipulado --> CRE (Creyente)
  |           |
  |           +-- si asiste a discipulado --> DA (Discipulo Activo)
  |                 |
  |                 +-- si abandona 3 clases continuas --> DI (Discipulo Inactivo)
  |
  +-- RE (Reconciliado) -- (si asiste a discipulado, 1 dia RE y luego DA)
```

## Evangelizado (SIM)

Estado inicial para toda persona que recibe evangelismo pero aun no toma decision de seguir a Jesus. Aplica a personas de cualquier edad.

**Transiciones posibles:**
- SIM → NC: La persona acepta a Jesus.
- SIM → SIM: La persona no avanza (se mantiene, el lider debe llamarlo).

**Criterios de transicion:** Ver [criterios.md](criterios.md).

---

## Nuevo Convertido (NC)

Persona que acaba de aceptar a Jesus por primera vez. Estado provisional. Aplica a personas de cualquier edad que aceptan a Jesus.

**Transiciones posibles:**
- NC → CRE: Despues de 1 semana sin asistencia a discipulado (solo para mayores de 12 anos).
- NC → DA: Si asiste al menos 1 vez al discipulado (cualquier edad).

**Criterios de transicion:** Ver [criterios.md](criterios.md).

---

## Reconciliado (RE)

Persona que retorno despues de +3 meses de ausencia. Es un estado temporal para seguimiento.

**Transiciones posibles:**
- RE → DA: Si asiste 1 vez al discipulado (se registra 1 dia RE y luego DA).

**Criterios de transicion:** Ver [criterios.md](criterios.md).

---

## Discipulo Activo (DA)

Estado que indica que la persona esta participando en el proceso de discipulado.

**Transiciones posibles:**
- DA → DI: Si la persona abandona 3 clases continuas (3 semanas).

**Criterios de transicion:** Ver [criterios.md](criterios.md).

---

## Discipulo Inactivo (DI)

Estado que indica que la persona dejo de asistir al discipulado.

**Nota:** Nunca aplica a quien nunca fue DA primero. NC que nunca fue a discipulado queda en NC, no pasa a DI.

**Transiciones posibles:**
- DI → RE: Si la persona regresa despues de +3 meses.

**Criterios de transicion:** Ver [criterios.md](criterios.md).

---

## Reglas generales

- No es posible transicion directa entre cualquier par de estados (ej. NC a DI sin pasar por DA).
- Los tiempos son a criterio del operador.
- SSVA es sigla NO OFICIAL, solo para documentacion interna.

## Documentos relacionados

- [Criterios de cambio de estado](criterios.md)
