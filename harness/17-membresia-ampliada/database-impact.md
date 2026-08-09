# 17 — Membresía ampliada — database-impact.md

> Fase 1. **Nada de esto está aplicado.** Inventario de solo lectura +
> cambios propuestos, mismo formato que `harness/14-afirmacion/database-impact.md`.

## 1. Inventario exacto de objetos actuales relacionados

| Objeto | Definición | Rol en este cluster |
|---|---|---|
| `persona`, `persona_detalle` | `08_estructura.sql`, `02-persona-parentela` | Identidad + censo, base de los 3 flujos actuales. |
| `relacion_familiar`, `referencia_familiar`, `tipo_relacion` | `02-persona-parentela` | Cubre Cónyuge (KAN-123 §6) y Familia (§7) sin tabla nueva. |
| `ministerio_persona` | ya sembrado, usado en Ministerios | Cubre KAN-123 §8 sin tabla nueva. |
| `casa_paz_url`, `fn_resolver_url_registro`, `fn_registrar_persona_via_url` | `19_registro_publico.sql` | Flujo público (KAN-125), se reutiliza intacto. |
| `invitacion_lider`, `fn_mi_invitacion_pendiente`, `fn_completar_membresia` | `42_invitacion_lideres.sql` | Flujo de invitación, acotado — KAN-126 pide un caso más amplio. |
| `invitacion_departamento` | `71_invitar_lider_departamento.sql` | Variante departamental del mismo patrón. |
| `MEMBRESIA_*_OBLIGATORIO`, `fn_config_formulario` | `21_validaciones_membresia.sql` | Obligatoriedad configurable, patrón a replicar para campos nuevos si aplica. |
| `CamposMembresiaFields` (frontend) | `components/shared/` | Campos compartidos por los 3 flujos actuales. |

## 2. Objetos que se reutilizan SIN cambios

`persona`, `persona_detalle`, `relacion_familiar`, `referencia_familiar`,
`tipo_relacion`, `ministerio_persona`, `casa_paz_url` + sus funciones,
`invitacion_lider`, `invitacion_departamento`, `MEMBRESIA_*_OBLIGATORIO`.

## 3. Cambios propuestos (NO ejecutados, dependen de open-questions.md)

### 3.1 Nuevos objetos — KAN-123

- `precision_fecha_enum` (`EXACTA|APROXIMADA|SOLO_MES_ANIO|SOLO_ANIO`) —
  bloqueado por Q-4 (¿`DATE` único o `anio/mes/dia` separados nullable?).
- `tipo_discipulado` (catálogo) + seed de los 6 valores del ticket —
  bloqueado por Q-1 (¿catálogo global o por iglesia?).
- `persona_discipulado` (persona_id, tipo_discipulado_id, fecha,
  precisión) — bloqueado por Q-2 (¿se puede repetir el mismo tipo?).
- `persona_seminario`, `persona_universidad_rey_jesus` (o tabla genérica
  alternativa, ver technical-design.md §2.3) — bloqueado por Q-3.
- `persona_mentor` (persona_id, mentor_persona_id NULL, mentor_nombre_txt
  NULL, mentor_es_miembro) — **bloqueado por Q-5**, la pregunta más
  abierta del cluster (qué hace "disponible" a un mentor).
- Columnas de bautismo en `persona_detalle` o tabla `persona_bautismo`
  dedicada (decisión menor, no bloqueante).
- RLS + auditoría + `trg_bloquear_delete` en cada tabla nueva, mismo
  patrón que toda tabla del sistema.

### 3.2 Nuevos objetos — KAN-124 (si se elige la opción "servidor" de
persistencia entre páginas, ver technical-design.md §3.2)

- Estado `BORRADOR` en `persona` (columna o tabla aparte) — **no
  recomendado implementar todavía**, ver Q-7. Si se confirma, requiere
  también una política de limpieza de borradores abandonados (¿cuánto
  tiempo se conservan personas nunca completadas?).

### 3.3 Nuevos objetos — KAN-126

- `fn_mi_membresia_incompleta()` [PROPUESTO], generaliza
  `fn_mi_invitacion_pendiente()` — bloqueado por Q-8 (qué cuenta como
  "tiene un rol").
- Mecanismo de `Saltar` (flag por sesión, no permanente) — decisión menor
  de implementación, no bloqueante, pero depende de Q-8 para saber a
  quién aplica.

### 3.4 Lo que NO se toca

- No se altera `casa_paz_url`, `fn_resolver_url_registro`,
  `fn_registrar_persona_via_url` (el mecanismo público en sí).
- No se altera `invitacion_lider`/`fn_completar_membresia` (el flujo de
  invitación ya probado sigue igual; KAN-126 es un caso **adicional**, no
  un reemplazo).
- No se altera el modelo de `relacion_familiar`/`referencia_familiar`
  (Cónyuge/Familia de KAN-123 se resuelven con UI nueva sobre datos ya
  existentes, no con tablas nuevas).

## 4. Impacto esperado en datos existentes

**Ninguno todavía** — este documento no ejecuta ningún DDL. Cuando se
implemente: todo aditivo (tablas/enums/funciones nuevas), sin
`UPDATE`/`DELETE` de datos existentes. El único cambio con impacto real en
comportamiento (no en datos) es KAN-126: una vez implementado, usuarios
existentes con rol y sin `persona` empezarían a ver el formulario de
Membresía al loguearse — por eso Q-8 debe confirmarse antes de tocar
`PrivateLayout.tsx` en producción.

## 5. Riesgo y orden recomendado

1. Cerrar Q-1 a Q-6 (campos de KAN-123) → implementar el modelo de datos
   ampliado + UI de campos (sin wizard todavía, se puede probar cada grupo
   de campos de forma aislada).
2. Cerrar Q-7 (persistencia de KAN-124) → construir `FormularioPaginado`
   con la opción elegida.
3. Aplicar el wizard a `FormularioMembresiaPublico` (KAN-125) — bajo
   riesgo, flujo ya aislado y sin usuarios con sesión.
4. Cerrar Q-8 (alcance de KAN-126) → implementar `fn_mi_membresia_incompleta`
   y el gate en `PrivateLayout.tsx` — se recomienda dejarlo para el final
   porque es el de mayor radio de impacto (afecta a todo usuario
   existente, no solo a un flujo nuevo).
