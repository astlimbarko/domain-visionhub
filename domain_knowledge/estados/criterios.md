# Criterios de Cambio de Estado (SSVA)

## Descripcion

Los estados de una persona cambian conforme evolucionan su participacion y compromiso dentro de la iglesia. Este archivo define las transiciones y sus umbrales.

---

## Variables

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `CLASES_PARA_DI` | 3 | Clases ausentes continuas del discipulado para ser Discipulo Inactivo |
| `SEMANAS_PARA_DI` | 3 | Equivalente a 3 clases en semanas |
| `SEMANAS_NC_PARA_CRE` | 1 | Semanas sin discipulado para que NC pase a CRE |
| `ASISTENCIAS_PARA_DA` | 1 | Basta 1 asistencia al discipulado para ser DA |
| `DIAS_RE_PARA_DA` | 1 | Dias como Reconciliado antes de pasar a DA |
| `MESES_PARA_RE` | 3 | Meses sin aparecer para ser Reconciliado |
| `DIAS_PARA_RE` | 90 | Equivalente a 3 meses en dias |
| `EDAD_MINIMA_CRE` | 12 | Edad minima para ser Creyente (CRE) |

---

## Transiciones entre estados

| Transicion | Criterio | Variable |
|------------|----------|----------|
| **SIM -> NC** | La persona acepta a Jesus por primera vez (ora de fe). | Evento |
| **SIM -> RE** | La persona tenia experiencia previa, estuvo +3 meses fuera y retorna. | `MESES_PARA_RE` |
| **NC -> sigue NC** | Si no asiste al discipulado en la semana siguiente. | `SEMANAS_NC_PARA_CRE` |
| **NC -> CRE** | Despues de 1 semana sin asistir a discipulado. | `SEMANAS_NC_PARA_CRE` |
| **NC/CRE -> DA** | Asiste una vez al discipulado. | `ASISTENCIAS_PARA_DA` |
| **RE -> DA** | RE dura 1 dia; si asiste a discipulado pasa a DA. | `DIAS_RE_PARA_DA` |
| **DA -> DI** | 3 clases ausentes continuas (3 semanas) del discipulado. | `CLASES_PARA_DI` |
| **DI -> DA** | Si retoma la asistencia al discipulado. | `ASISTENCIAS_PARA_DA` |

---

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

---

## Consideraciones

- No existe transicion directa sin pasar por los estados intermedios.
- DI nunca aplica a quien nunca fue DA primero.
- Un evangelizado que no avanza se mantiene en SIM. Ese estado revela que el lider designado debe llamarlo.
- Estado AF eliminado del SSVA.
- Los tiempos son a criterio del operador.
- **Creyente (CRE):** Para asistentes regulares mayores de 12 anos.

---

## Responsables del seguimiento

- El lider cdP debe ver los estados de sus miembros.
- El panel del lider debe mostrar estados y alertas.
- Un DI (discipulo inactivo) debe ser contactado por su lider cdP.

---

## Documentos relacionados

- [Estados](estados.md)
- [Criterios de CdP](../casas-de-paz/criterios.md)
