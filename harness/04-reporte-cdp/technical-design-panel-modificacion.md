# Diseño — Panel de modificación de reportes (KAN-367 / seguimiento KAN-374/375)

## Contexto

Caso real (2026-09-14): la sublíder Viviana, de la Casa de Paz del Líder
Daniel Justiniano Lara, cargó un reporte que debía llevar fecha de
celebración de hace 3 semanas y terminó guardado con la fecha de la
semana en curso. Al intentar cargar el reporte real de esta semana, el
sistema respondió "ya existe" — bloqueada por el índice único
`uq_reporte_cdp_fecha` (una fila por `casa_de_paz_id` + `fecha_reunion`).

Investigado a fondo antes de tocar nada:

- **No hay bug de código** en el camino de guardado. `fn_resolver_url_registro`
  no interviene acá; el formulario de reporte (`Reportes.tsx`) manda
  `fecha_reunion` tal cual sale del `<input type="date">`, sin conversión de
  zona horaria ni sustitución por `fecha_creacion` en ningún punto del
  camino hacia el INSERT. El índice único ya está anclado a `fecha_reunion`
  (fecha de celebración), no a `fecha_creacion` — la hipótesis original de
  KAN-367 (que la unicidad usara la fecha de creación) queda descartada.
- Las 2 filas de reporte de esa CdP ya estaban soft-eliminadas antes de que
  se pudiera auditar el registro original (alguien siguió la sugerencia de
  Viviana de "borrar y cargar de cero") — exactamente lo que KAN-367 pide
  evitar. Sus `fecha_reunion` (09-09 y 09-11) no correspondían a "hace 3
  semanas", así que no se pudo reconstruir con certeza el mecanismo exacto
  del error de tipeo. La lectura más probable es un error de carga en el
  selector de fecha nativo, no un bug de backend — no se puede probar de
  forma forense con el rastro ya borrado.
- **El gap real** no es el guardado, es que **no existía ninguna forma de
  corregir `fecha_reunion` después de guardado** — el formulario de edición
  (KAN-271) la deja explícitamente `disabled`. Y aunque existiera, con la
  ventana de edición anclada a `fecha_reunion` (como estaba hasta hoy), un
  reporte atrasado nace prácticamente sin margen para corregirse: si se
  carga hoy un reporte de hace 3 semanas, su ventana ya está vencida el
  mismo día que se creó.

## Decisión: cambio de ancla

La ventana de edición pasa a contarse **desde `fecha_creacion`** del
reporte (cuándo se cargó), no desde `fecha_reunion` (cuándo fue la
celebración). Un reporte atrasado nace con su propia ventana fresca para
corregirse, sin importar qué tan vieja sea la fecha de la reunión que
describe.

Esto además alinea la implementación con el texto original de KAN-374
("tomar como referencia la fecha/hora en que el reporte fue registrado"),
del que la versión ya desplegada (KAN-374/375, migración
`20260913020000`) se había desviado ancladando en `fecha_reunion`.

## Matriz de permisos

| Rol | Alcance | Ventana (desde `fecha_creacion`) | Fuera de ventana |
|---|---|---|---|
| Líder / Sublíder de CdP | Su propia CdP | 3 días — `DIAS_LIMITE_EDICION_REPORTE_CDP` | Bloqueado, sin excepción |
| Líder de Red / Supervisor de Red (cargo `SUBLIDER_RED`) | Todas las CdP de su Red | 30 días — `DIAS_LIMITE_EDICION_REPORTE_RED` | Bloqueado, sin excepción |
| Supervisor de la Visión en Acción (`SUPERVISOR_VISION_ACCION`) | Todas las CdP de la iglesia | 30 días (misma variable `DIAS_LIMITE_EDICION_REPORTE_RED`) | Permitido, con justificación escrita + OTP |
| Pastor | Todas las CdP de la iglesia | 30 días (misma variable) | Permitido, con justificación escrita + OTP |

Antes de esta fase, Pastor y Supervisor tenían paso libre incondicional
(sin ventana) vía `fn_es_operativo_en`. Es un endurecimiento deliberado,
pedido explícitamente por el owner (2026-09-14): dentro de los 30 días
editan igual que un Líder de Red; más allá, pueden seguir editando pero
dejan rastro (motivo + verificación).

Ambos valores (`_CDP` y `_RED`) quedan en `configuracion_definicion`,
categoría `CONTROL_REPORTES` — se editan solos en Panel Supervisor, mismo
patrón ya usado por `DIAS_PLAZO_REPORTE`.

## Fase 1 — Backend: ancla + ventanas separadas

Reemplaza `DIAS_LIMITE_EDICION_REPORTE` (única, anclada a `fecha_reunion`)
por dos filas nuevas de configuración y una reescritura de
`fn_puede_editar_reporte_cdp`:

```sql
-- configuracion_definicion
DIAS_LIMITE_EDICION_REPORTE_CDP  -- default 3,  min 1, max 60
DIAS_LIMITE_EDICION_REPORTE_RED  -- default 30, min 1, max 90

CREATE OR REPLACE FUNCTION public.fn_puede_editar_reporte_cdp(p_reporte_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    (
      -- CdP: Líder/Sublíder de su propia CdP, ventana corta
      (
        r.fecha_creacion::date >= CURRENT_DATE - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_CDP')::int
        AND (fn_es_lider_cdp(r.casa_de_paz_id) OR fn_es_sublider_cdp(r.casa_de_paz_id))
      )
      OR
      -- Red: Líder/Supervisor de Red de cualquier CdP de su red, ventana larga
      (
        r.fecha_creacion::date >= CURRENT_DATE - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_RED')::int
        AND EXISTS (
          SELECT 1 FROM casa_de_paz_red cdr
          WHERE cdr.casa_de_paz_id = r.casa_de_paz_id
            AND cdr.fecha_fin IS NULL AND cdr.fecha_eliminacion IS NULL
            AND fn_es_lider_de_red(cdr.red_id)
        )
      )
      OR
      -- Pastor/Supervisor: misma ventana larga sin fricción; fuera de eso,
      -- solo por fn_editar_reporte_fuera_de_ventana (Fase 3), no por acá.
      (
        r.fecha_creacion::date >= CURRENT_DATE - fn_criterio(r.iglesia_id, 'DIAS_LIMITE_EDICION_REPORTE_RED')::int
        AND (fn_es_pastor_en(r.iglesia_id) OR fn_es_supervisor_en(r.iglesia_id))
      )
      OR fn_es_super_admin()
    )
  FROM casa_de_paz_reporte r
  WHERE r.id = p_reporte_id AND r.fecha_eliminacion IS NULL;
$$;
```

`fn_es_super_admin()` se mantiene sin ventana (mismo criterio que ya tenía
para el resto de las acciones administrativas). `fn_es_operativo_en` deja
de usarse acá — se reemplaza por el desglose explícito de
`fn_es_pastor_en` / `fn_es_supervisor_en`, porque de ahora en más esos dos
roles ya no comparten el mismo comportamiento (ambos con ventana de 30
días, pero el escape fuera de ventana es una función aparte).

**Frontend:** `dentroDeVentanaEdicionReporte()` pasa a recibir
`fecha_creacion` en vez de `fecha_reunion`. `useDiasLimiteEdicionReporte`
se separa en dos hooks (o uno parametrizado por código de configuración):
`HistorialReportes.tsx` (vista de Líder/Sublíder de CdP) usa la ventana
`_CDP`; `ControlReportesVista.tsx` (vista de Red/Supervisor/Pastor) usa la
ventana `_RED`.

## Fase 2 — Panel de activación + `fecha_reunion` editable

- `fecha_reunion` deja de tener `disabled={modoEdicion}` en `Reportes.tsx`.
- Nuevo paso antes de que los campos se habiliten: botón "Modificar este
  reporte" → mensaje de advertencia (reportes ya usados en estadísticas,
  cambiar la fecha puede afectar cumplimiento/rachas ya calculados) →
  recién ahí se muestran los campos precargados y editables.
- `actualizarReporte()` agrega `fecha_reunion` al `.update()` de
  `casa_de_paz_reporte`. El índice único `uq_reporte_cdp_fecha` sigue
  protegiendo contra choques al cambiar la fecha, sin cambios ahí.
- **Punto de seguridad a resolver con cuidado:** la policy RLS de `UPDATE`
  (`pol_casa_de_paz_reporte_update`) no tiene `WITH CHECK` propio — Postgres
  reutiliza el mismo `USING` (`fn_puede_editar_reporte_cdp(id)`) para
  validar la fila después del cambio. Como esa función vuelve a consultar
  la fila por `id`, si se le permite tocar `fecha_creacion` (no debería
  poder, pero conviene blindarlo) o si el chequeo dependiera de un campo
  que el propio UPDATE modifica, se abriría una forma de renovar el
  permiso de edición editando. Mitigación: `fecha_creacion` nunca se
  expone como editable (ya es así, no cambia), y el ancla de la Fase 1 es
  `fecha_creacion`, no `fecha_reunion` — cambiar `fecha_reunion` en la
  Fase 2 no altera el resultado de `fn_puede_editar_reporte_cdp` para esa
  misma fila, así que no hay bucle de auto-renovación. Se deja documentado
  para que quien toque esto después no lo reintroduzca sin querer.
- Encabezado de contexto (Líder, Anfitrión, Dirección, Ciudad) cuando quien
  edita no es el propio Líder/Sublíder de la CdP — reusa la misma consulta
  que ya resuelve `fn_resolver_url_registro` (KAN-380, 2026-09-14).

## Fase 3 — Escape de Pastor/Supervisor fuera de ventana

Nueva función `SECURITY DEFINER`, mismo patrón que
`fn_quitar_cargo_departamento` (`75_otp_baja_cargo_departamento_red.sql`):

```sql
CREATE OR REPLACE FUNCTION public.fn_editar_reporte_fuera_de_ventana(
  p_reporte_id UUID,
  p_justificacion TEXT,
  p_pin TEXT,
  -- + los mismos campos editables que actualizarReporte() ya actualiza
  p_fecha_reunion DATE,
  p_libro_id UUID,
  ...
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_iglesia_id UUID;
BEGIN
  SELECT iglesia_id INTO v_iglesia_id FROM casa_de_paz_reporte
  WHERE id = p_reporte_id AND fecha_eliminacion IS NULL;
  IF v_iglesia_id IS NULL THEN
    RAISE EXCEPTION 'REPORTE_INEXISTENTE: el reporte no existe o fue eliminado' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (fn_es_pastor_en(v_iglesia_id) OR fn_es_supervisor_en(v_iglesia_id)) THEN
    RAISE EXCEPTION 'REPORTE_SOLO_PASTOR_SUPERVISOR: solo Pastor o Supervisor de la Vision en Accion puede editar fuera de la ventana normal'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_justificacion IS NULL OR btrim(p_justificacion) = '' THEN
    RAISE EXCEPTION 'REPORTE_JUSTIFICACION_OBLIGATORIA: se requiere un motivo para editar fuera de la ventana normal'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_verificar_otp(p_pin) THEN
    RAISE EXCEPTION 'PIN_INCORRECTO: el codigo de confirmacion es incorrecto, expiro, o no fue solicitado'
      USING ERRCODE = 'P0001';
  END IF;

  -- UPDATE directo (SECURITY DEFINER, no pasa por la policy de ventana) +
  -- INSERT de auditoría (motivo, quién, cuándo, reporte_id) -- tabla a
  -- definir en la implementación, revisar primero si ya existe algo
  -- reusable (p.ej. tabla de notificaciones/auditoría genérica) antes de
  -- crear una nueva solo para esto.
END;
$$;
```

**Frontend:** el flujo de activación (Fase 2) detecta si el reporte está
fuera de la ventana de 30 días y quien edita es Pastor/Supervisor; en ese
caso, antes de habilitar los campos pide el motivo (texto obligatorio) y
dispara el mismo componente de verificación OTP que ya usan otras
pantallas del proyecto (no se crea un componente nuevo).

## Fuera de alcance de este esfuerzo

- El menú lateral "Membresía" por Casa de Paz (ver/editar personas, links
  de autogestión individuales) — pedido explícito del owner de tratarlo
  como ticket aparte más adelante.
- Los gaps ya detectados por separado en la auditoría de KAN-371 (falta
  búsqueda de duplicados al crear persona) no se tocan acá.
