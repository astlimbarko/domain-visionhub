# Estados de una Persona

## Descripción

La iglesia utiliza un sistema de seguimiento de estados que registra el proceso de crecimiento y participación espiritual de una persona. SSVA (Sistema de Seguimiento en la Vision en la Accion) es una sigla NO OFICIAL, usada solo para documentacion interna.

Los estados describen la situacion espiritual o administrativa de cada persona dentro de la iglesia.

## Estados disponibles

| Estado | Sigla | Descripcion |
|--------|-------|-------------|
| **Evangelizado** | SIM | Persona evangelizada que no avanza. Estado inicial. Si no avanza, se mantiene en SIM y revela que el lider designado debe llamarlo. |
| **Nuevo Convertido** | NC | Persona que acepta a Jesus por primera vez. Para asistentes nuevos. |
| **Creyente** | CRE | Persona que acepto a Jesus. Para asistentes regulares mayores de 12 anos. |
| **Reconciliado** | RE | Persona que estuvo +3 meses fuera y retorna. |
| **Discipulo Activo** | DA | Persona que asiste al discipulado (basta una vez). |
| **Discipulo Inactivo** | DI | Persona que abandono 3 clases continuas (3 semanas) del discipulado. Nunca aplica a quien nunca fue DA primero. |

## Ciclo de vida de los estados

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

### Reglas importantes

- No es posible transicion directa (ej. NC a DI sin pasar por DA).
- Los tiempos son a criterio del operador.
- Estado AF eliminado del SSVA.
- SSVA es sigla NO OFICIAL, solo para documentacion interna.

## Documentos relacionados

- [Evangelizado](evangelizado.md)
- [Nuevo convertido](nuevo-convertido.md)
- [Reconciliado](reconciliado.md)
- [Discipulo activo](discipulo-activo.md)
- [Discipulo inactivo](discipulo-inactivo.md)
- [Criterios de cambio de estado](criterios.md)
