# Criterios de Movimiento de Personas

## Proposito

Definir los umbrales y reglas que gobiernan los cambios de estado y movimiento de personas dentro de las casas de paz.

---

## Variables

### Asistencia y Membresia

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `VISITAS_PARA_MIEMBRO` | 2 | Una persona se considera miembro a partir de su 2da visita consecutiva |
| `VISITAS_PARA_MIGRAR` | 8 | Si asiste 8 veces consecutivas a otra CdP, se asume que se ha cambiado |
| `INASISTENCIAS_PARA_INACTIVO` | 12 | Despues de ~12 inasistencias consecutivas se considera inactivo |
| `REGLA_INACTIVO_OFICIAL` | No | Esta regla NO es oficial, es solo practica para documentacion |

### Reconciliacion

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `MESES_PARA_RECONCILIADO` | 3 | Persona que estuvo 3 meses (90 dias) fuera y retorna |
| `DIAS_PARA_RECONCILIADO` | 90 | Equivalente a 3 meses en dias |

### Discipulado (SSVA)

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `CLASES_PARA_INACTIVO` | 3 | 3 clases ausentes continuas del discipulado = Discipulo Inactivo |
| `SEMANAS_PARA_INACTIVO` | 3 | Equivalente a 3 clases en semanas |
| `SEMANAS_NC_PARA_CREYENTE` | 1 | Despues de 1 semana sin discipulado, NC pasa a CRE |
| `ASISTENCIAS_PARA_DA` | 1 | Basta 1 asistencia al discipulado para ser Discipulo Activo |
| `DIAS_RE_PARA_DA` | 1 | Reconciliado dura 1 dia, luego pasa a DA si asiste a discipulado |
| `EDAD_MINIMA_CREYENTE` | 12 | CRE es para asistentes regulares mayores de 12 anos |

---

## Reglas de Movimiento

### Nivel Casa de Paz

```
Visita (1ra vez)
  |
  +-- 2da visita consecutiva --> Miembro
  |
  +-- 8 visitas consecutivas a OTRA CdP --> Migracion automatica
  |
  +-- ~12 inasistencias consecutivas --> Inactivo (NO oficial)
  |
  +-- Bautizo --> Miembro formal de la iglesia
```

### Nivel SSVA (Discipulado)

```
Evangelizado (SIM)
  |
  +-- Acepta Jesus --> Nuevo Convertido (NC)
  |     |
  |     +-- No asiste a discipulado 1 semana --> Creyente (CRE)
  |           |
  |           +-- Asiste a discipulado --> Discipulo Activo (DA)
  |                 |
  |                 +-- 3 clases ausentes continuas --> Discipulo Inactivo (DI)
  |                 |
  |                 +-- Retoma asistencia --> DA
  |
  +-- Estuvo +3 meses fuera y retorna --> Reconciliado (RE)
        |
        +-- 1 dia como RE, luego asiste a discipulado --> DA
```

---

## Notas Importantes

1. **Inactividad en CdP (~12 inasistencias):** No es una regla oficial. No existe un numero oficial definido. Es solo una practica para documentacion.

2. **Migracion entre CdP (8 visitas):** Es una suposicion del sistema. La migracion formal se realiza entre lideres de casas de paz.

3. **Bautizo:** Marca la membresia formal de la iglesia. No depende de un numero de visitas.

4. **Estado AF:** Fue eliminado del SSVA. No existe estado intermedio entre CRE y DA.

5. **DI nunca aplica a quien nunca fue DA:** Solo puede ser Discipulo Inactivo quien previamente fue Discipulo Activo.

6. **No existe transicion directa:** No es posible pasar de NC a DI sin pasar por DA primero.

---

## Criterios por Contexto

### Cuando un miembro visita otra CdP

- Puede asistir libremente a cualquier CdP.
- Si asiste **8 veces consecutivas** a la misma CdP diferente, se asume que se ha cambiado.
- La **migracion formal** se coordina entre el lider de la CdP actual y el lider de la nueva CdP.

### Cuando un miembro deja de asistir

- **1-2 semanas:** No se considera inactividad.
- **~12 semanas (~3 meses):** Se considera inactividad en la CdP (criterio no oficial).
- **+3 meses (90 dias):** Si retorna, se considera Reconciliado (no nuevo convertido).

### Cuando un miembro retorna

- Si estuvo **menos de 3 meses** fuera: simplemente retoma su estado anterior.
- Si estuvo **3 meses o mas** fuera: se marca como Reconciliado (RE).
- Si desea **bautizarse de nuevo**, no se le impide.
