# 17 — Arquitectura multirol y contexto activo — database-impact.md

## Decisión inicial

**No hay migración de base de datos aprobada en la primera fase.** El problema detectado es principalmente de representación de sesión, navegación y alcance en frontend. Las entidades actuales ya exponen iglesia, Red y Casa de Paz a las consultas de roles.

## Inventario existente relevante

| Recurso | Uso actual | Evaluación para multirol |
|---|---|---|
| `fn_mis_roles_dashboard` | Devuelve `es_operativo`, Redes y CdP del usuario por iglesia | Base para validar contexto; revisar campos de departamento |
| `usuario_rol` | Roles de sistema/históricos | Fuente de rol efectivo; no duplicar en Zustand |
| `red_cargo` | Cargos de Red | Debe identificar la Red vigente del Líder/Supervisor |
| `casa_de_paz_cargo` | Cargos de CdP | Debe identificar la CdP y tipo de cargo vigente |
| `departamento_cargo` | Liderazgo de departamento | Revisar exposición por RPC para contexto de departamento |
| RLS y RPC existentes | Autorización de datos | Mantienen autoridad; la UI no las reemplaza |

## Verificaciones obligatorias antes de SQL

1. Confirmar que cada opción contextual tiene una clave estable derivable de una asignación vigente, no solo del nombre de una entidad.
2. Confirmar que `fn_mis_roles_dashboard` puede validar todos los contextos que la UI ofrece, incluidos departamentos si tendrán panel propio.
3. Confirmar que las RPC de cada módulo comprueban la entidad solicitada y no solo que el usuario tenga algún rol dentro de la iglesia.
4. Probar que una persona con dos Redes/CdP no puede usar un ID ajeno por URL o desde DevTools para leer/escribir fuera de su alcance.

## Posible trabajo futuro — solo si la auditoría lo demuestra

Si no existe forma estable de identificar una asignación vigente, se podrá proponer una migración aditiva para exponer o normalizar ese identificador. Debe cumplir:

- migración numerada en `harness/11-esquema-bd/sql/`;
- claves foráneas e índices sobre columnas usadas por RLS;
- RLS habilitada y acceso directo mínimo;
- RPC `SECURITY DEFINER` con `auth.uid()`, búsqueda de pertenencia y `search_path` seguro;
- prueba de regresión de todos los roles antes de aplicarla.

No se debe crear una tabla para “roles activos”: el contexto activo es una preferencia de sesión de frontend, validada contra el dominio; no es un permiso que deba persistirse como fuente de verdad en la BD.

## Resultado de auditoría KAN-135

La Fase 5 demostró que sí hacen falta migraciones de seguridad. La base viva
tenía RPC `SECURITY DEFINER` que validaban solo pertenencia a la iglesia y no la
Red/CdP exacta, además de políticas `SELECT` con el mismo alcance amplio.

Migraciones preparadas localmente, todavía no aplicadas a Supabase:

- `20260809053351_kan_135_hardening_privilegios_y_coherencia.sql`: cierra
  ejecución pública, evita cruces de iglesia en notificaciones, valida la
  coherencia Iglesia/Red de anuncios y convierte `v_reporte_totales` en
  `security_invoker`.
- `20260809054456_kan_135_alcance_exacto_red_cdp.sql`: introduce
  `fn_puede_ver_red`/`fn_puede_ver_cdp`, acota listados y RPC de CdP y endurece
  las políticas de lectura de estructura, reportes, evangelismo y calendario.
- `20260809060533_kan_135_aprobaciones_red_transaccionales.sql`: valida que
  solicitud, iglesia, Red, payload y aprobador coincidan; permite ejecutar
  fusión/multiplicación aprobadas sin elevar al Líder a Supervisor.

Hallazgo pendiente que no se debe resolver por intuición:

1. `Personas.tsx` permite deliberadamente búsqueda de toda la iglesia a
   Líder/Sublíder CdP, mientras el contexto nuevo declara alcance CdP. Requiere
   decisión funcional del owner antes de cambiar UI, RPC o RLS de `persona`.

La migración de aprobaciones compiló en PostgreSQL 17 y pasó pruebas locales de
fusión válida, multiplicación válida y rechazo de payload manipulado. El
contenedor temporal fue eliminado después de las pruebas.

La migración de alcance exacto compiló en PostgreSQL 17 y pasó la matriz local:
Red propia visible, CdP propia visible, Red padre visible para cargo CdP, CdP
hermana bloqueada y Supervisor con alcance completo. La prueba detectó y
corrigió el alias faltante `lider_nombre` antes de llegar a Supabase.

Las migraciones siguen sin aplicarse a la base viva. Falta validar el primer
bloque de privilegios y ejecutar la matriz con cuentas multirol reales.
