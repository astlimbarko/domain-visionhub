# 14 — Departamento de Afirmación — open-questions.md

## Decisiones confirmadas (owner, Fase 1, 2026-07-26)

- **D-1** Modelo de asignación = **nueva tabla `departamento_cargo`** (persona + departamento
  `AFIRMACION` + cargo `LIDER_DEPARTAMENTO` + iglesia). No se agrega `LIDER_AFIRMACION` al enum.
- **D-2** Acceso en frontend = **capacidad ortogonal** (flag `es_lider_afirmacion` + hook +
  guard por capacidad), no un nuevo `RolUI`. Respeta multi-sombrero.
- **D-3** Registro interno = **nuevo RPC atómico autenticado** `fn_registrar_persona_afirmacion`
  (`SECURITY DEFINER`), reutilizando el formulario de membresía existente.
- **D-4** Los archivos de spec viven en `harness/14-afirmacion/` con los 5 nombres del instructivo.
- **D-5** La designación del Líder de Afirmación se hace **por DB** en esta etapa; el panel del
  Supervisor queda modelado para el futuro pero no se construye ahora.

## Preguntas pendientes (bloquean detalles, no la arquitectura)

- **Q-1 — Líder de CdP con varias CdP activas.** El RPC pide `casa_de_paz_cargo_id` explícito, que
  ya identifica una sola CdP. ¿El selector del formulario debe mostrar "Líder — (zona/CdP)" cuando
  un líder tenga 2+ CdP, para que el operador elija la correcta? *Recomendado: sí, mostrar la
  etiqueta de CdP (`fn_etiqueta_cdp`) junto al nombre.*
- **Q-2 — Aviso de duplicado en registro interno.** Además del bloqueo por `uq_persona_ci`,
  ¿mostramos una advertencia por coincidencia de nombre/CI antes de crear (con opción "es otra
  persona, continuar")? *Recomendado: sí, búsqueda previa no bloqueante.*
- **Q-3 — URLs en estado `SUSPENDIDO`.** ¿El Líder de Afirmación puede reactivar una URL
  `SUSPENDIDO`, o solo alterna `ACTIVO`/`INACTIVO` y `SUSPENDIDO` queda reservado al Supervisor?
  *Recomendado: Afirmación solo alterna ACTIVO/INACTIVO; no toca SUSPENDIDO.*
- **Q-4 — Interruptor `REGISTRO_URL_ACTIVO` por iglesia.** El registro público exige, además del
  estado de la URL, que la configuración `REGISTRO_URL_ACTIVO` de la iglesia esté en `true`
  (`fn_registrar_persona_via_url`). ¿El panel de Afirmación debe mostrar/gestionar ese interruptor
  global, o se asume que el Supervisor ya lo activó? *Recomendado: mostrarlo como indicador de solo
  lectura y avisar si está apagado; su edición queda en Panel del Supervisor.*
- **Q-5 — RESUELTA (2026-07-26).** Primer Líder de Afirmación: **Silvestre Stalon**
  (`envioskian@gmail.com`, contraseña temporal `123456` a cambiar desde Cuenta), iglesia
  **Centro de Vida 4 Anillo (Santa Cruz)**. Cuenta creada desde cero por SQL directo + fila en
  `departamento_cargo`. Verificado con login real y llamadas RPC reales.
- **Q-6 — Motivo de llegada.** El registro interno usa `INVITACION_PERSONAL` (igual que el público).
  ¿Correcto para bautizados por Afirmación, o conviene un motivo propio (p. ej. `AFIRMACION`)?
  *Recomendado: mantener `INVITACION_PERSONAL` por ahora; agregar catálogo si el owner lo pide.*

## Suposiciones explícitas

- **S-1** El alcance del Líder de Afirmación es **toda su iglesia** (todas las CdP/URLs), no un
  subconjunto (coherente con §5 del instructivo).
- **S-2** El formulario de membresía a reutilizar es el de `FormularioMembresiaPublico`
  (identidad + censo básico). Direcciones/teléfonos/familia (que `persona.service.ts` maneja aparte)
  **no** forman parte del alta rápida de Afirmación en esta entrega.
- **S-3** El flag `es_lider_afirmacion` se expone por iglesia activa (multi-iglesia soportado).
- **S-4** No hay panel de "miembros del departamento": `departamento_cargo` solo modela al líder por
  ahora (aunque la tabla admite otros cargos a futuro).

## Contradicciones detectadas

- **C-1 — `casa_de_paz.nombre` obligatorio vs. "la CdP no tiene nombre".** El esquema
  (`08_estructura.sql:24`) tiene `casa_de_paz.nombre NOT NULL` y `fn_resolver_url_registro` devuelve
  `cdp.nombre`, pero la decisión del owner (memoria `visionhub-estado`) es que la CdP se identifica
  por su líder (`fn_etiqueta_cdp`), no por un nombre propio. Para los listados de Afirmación se usará
  `fn_etiqueta_cdp`/nombre del líder, no `casa_de_paz.nombre` crudo. Señalado, no se corrige aquí.
- **C-2 — Instructivo (§9) sugiere `docs/specs/afirmacion/` "si no hay convención".** Sí hay
  convención (`harness/NN-modulo/`); por eso se usó `harness/14-afirmacion/` (D-4). No es un conflicto
  real, se documenta la desviación respecto del fallback sugerido.
- **C-3 — Instructivo dice "cambiaré el modelo a Opus" para implementar.** La sesión ya corre en
  Opus 4.8. Se interpreta como el checkpoint de aprobación + posible cambio a un modelo mayor a
  criterio del owner; no cambia la arquitectura.

## Implementación (2026-07-26) — hallazgos reales durante la verificación end-to-end

- **H-1 — `auth.users` con columnas de token en `NULL` rompe el login (500 "Database error querying schema").**
  El bootstrap de `envioskian@gmail.com` por SQL directo dejó `confirmation_token`,
  `recovery_token`, `email_change_token_new`, `email_change` en `NULL` en vez de `''`. GoTrue no
  tolera `NULL` en esos campos. Corregido con `UPDATE` a `''`. **Anotar para cualquier futuro
  bootstrap de usuario por SQL directo:** esas 4 columnas deben ir siempre en `''`, nunca `NULL`
  (la cuenta Super Admin ya las tenía bien; solo faltó replicarlo aquí).
- **H-2 — Hueco de defensa en profundidad (no touched, solo mitigado para los objetos nuevos):**
  `20_permisos_explicitos.sql` hace `ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON FUNCTIONS FROM anon`,
  pero eso no anula el default de fábrica de Postgres ("EXECUTE a PUBLIC" en toda función nueva),
  y `anon` hereda PUBLIC. Una llamada anónima real a `fn_listar_lideres_cdp_afirmacion` llegó a
  ejecutarse (sin fuga de datos, bloqueada por el chequeo interno `fn_es_lider_afirmacion_en`).
  Corregido con `52_revocar_execute_publico_afirmacion.sql`, quirúrgico solo sobre las 7 funciones
  de esta sesión. **Probablemente aplica a toda función creada después de `20_`** (no solo las de
  Afirmación) — queda como hallazgo para que el equipo decida si vale la pena un
  `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` global.
- **Renumeración de migraciones (2026-07-26):** las 8 migraciones de Afirmación se numeraron
  originalmente `46`-`53`, pero el PR #3 del compañero (`46_personas_de_red.sql`, merged a `master`
  el mismo día) también tomó el número `46`. Sin conflicto funcional (su archivo solo crea
  `fn_personas_de_red`, ya verificado vivo en la base real, no toca nada de Afirmación) — se
  renumeraron las 8 migraciones de Afirmación a `47`-`54` únicamente para no duplicar el prefijo
  en el repo; el contenido SQL ya aplicado a la base real no cambió.
- **Verificación real hecha:** login real de `envioskian@gmail.com`, llamadas RPC reales (listar
  líderes de CdP, listar URLs, registrar persona con datos de prueba — verificado en las 4 tablas y
  limpiado después), `fn_set_estado_casa_paz_url` probado con idempotencia + id inexistente + estado
  revertido a producción. Las 5 auditorías del harness (RLS, auditoría, `search_path`, `trg_no_delete`,
  privilegios de `anon`) dan cero filas tras las 6 migraciones (`46`–`51`). `tsc -b --force` y
  `oxlint` del frontend, limpios.
