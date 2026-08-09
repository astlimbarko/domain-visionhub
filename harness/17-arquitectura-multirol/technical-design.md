# 17 — Arquitectura multirol y contexto activo — technical-design.md

> Diseño propuesto, anclado a los archivos existentes. No aplica cambios por sí solo. La implementación empieza después de cerrar las preguntas de este paquete.

## 1. Problema observado en el código actual

El estado persistido en `frontend/src/store/auth.store.ts` conserva `rolActivo: RolUI | null`. Solo identifica el tipo (`LIDER_RED`), pero no la asignación real elegida (`redId`, `cdpId`, `departamentoId`). Al cambiar iglesia solo se reinicia ese tipo genérico.

El selector `frontend/src/hooks/useOpcionesRolContextuales.ts` ya produce opciones con claves reales como `LIDER_RED-{redId}` y una `vista`; sin embargo, `frontend/src/pages/SeleccionarRol.tsx` guarda únicamente `opcion.rolUI`. La vista se envía mediante `location.state`, que se pierde al recargar, navegar por el sidebar o abrir una URL directamente.

Además:

- `useOpcionesRol.ts` y `useRolUI.ts` reducen múltiples asignaciones a tipos de rol, por lo cual las guardas no distinguen dos Redes/CdP del mismo usuario.
- `AppShell.tsx` parte de `obtenerNavItems(rolUI)` y añade capacidades de otros cargos; esa composición es la causa directa de sidebars mezclados.
- `Dashboard.tsx`, `Calendario.tsx`, `Evangelismo.tsx`, `Visitas.tsx` y otras vistas usan variantes de `redes_lider?.[0]` o `cdp_lider?.[0]`.
- `NAVBAR_COLOR_ROL` depende solo del `RolUI`; no existe fuente única de navegación, tema, alcance y ruta inicial por contexto.

## 2. Modelo canónico propuesto

Crear un tipo discriminado central, por ejemplo en `frontend/src/types/contexto-activo.types.ts`:

```ts
type ContextoActivo =
  | { clave: 'SUPER_ADMIN'; rolUI: 'SUPER_ADMIN'; alcance: 'GLOBAL' }
  | { clave: string; rolUI: 'PASTOR'; alcance: 'IGLESIA'; iglesiaId: string }
  | { clave: string; rolUI: 'SUPERVISOR'; alcance: 'IGLESIA'; iglesiaId: string }
  | { clave: string; rolUI: 'LIDER_DEPARTAMENTO'; alcance: 'DEPARTAMENTO'; iglesiaId: string; departamentoId: string }
  | { clave: string; rolUI: 'LIDER_RED'; alcance: 'RED'; iglesiaId: string; redId: string }
  | { clave: string; rolUI: 'LIDER_CDP' | 'SUBLIDER_CDP'; alcance: 'CDP'; iglesiaId: string; redId: string | null; cdpId: string };
```

`clave` identifica la asignación elegible y permite invalidarla frente a los roles que devuelve `fn_mis_roles_dashboard`. El tipo se debe extender, no duplicar, cuando aparezca un nuevo panel.

### Principios

1. El store persiste `contextoActivo`, no un Rol UI aislado.
2. El backend sigue siendo la fuente de verdad: el frontend valida el contexto contra los datos de `useMisRoles` antes de usarlo.
3. `RolUI` se deriva de `contextoActivo.rolUI`; no se calcula por prioridad si hay una selección válida.
4. La prioridad histórica solo sirve como fallback temporal para una cuenta con exactamente un contexto válido.
5. El contexto no duplica entidades remotas completas; conserva IDs y claves.

## 3. Selector, inicio y guardas

### Selector

`useOpcionesRolContextuales` se convierte en la única fuente de opciones de selección. Cada opción incluye el `ContextoActivo` completo y una etiqueta humana: “Líder de Red — Galilea”, “Líder de CdP — Ana Gómez”, etc.

Al elegir, `SeleccionarRol` persiste el objeto completo y navega a la ruta inicial configurada. No usa `location.state` como portador de autorización o alcance; puede conservarse únicamente para animación o navegación no crítica.

### PrivateLayout

Debe validar: sesión autenticada; iglesia seleccionada cuando el contexto lo requiera; pertenencia del contexto a las asignaciones devueltas por backend; y ruta compatible con la configuración del contexto.

Si falla, limpia solo el contexto inválido y va a `/seleccionar-rol`; no intenta adivinar una Red/CdP usando la primera disponible.

## 4. Catálogo único de paneles

El catálogo único vive en `frontend/src/utils/paneles-contexto.ts`. Cada entrada recibe el contexto y devuelve título, color de navbar, contraste, rutas permitidas, ruta inicial y `NavItem[]`.

`AppShell.tsx` consume exclusivamente ese catálogo. Afirmación, Jóvenes y Matrimonios solo aparecen cuando su contexto está activo; nunca se añaden sobre el menú de otro rol.

### Separación de sistemas de color

- Los colores del navbar son fijos por contexto y viven en el catálogo central.
- Super Admin conserva `#0A0E1A`; Líder de Red conserva `#4E73B7`.
- Supervisor de Red comparte panel y permisos con Líder de Red, pero usa `#5B4BB7`.
- Sublíder de CdP usa blanco nieve `#FFFAFA` con texto oscuro.
- Los roles todavía sin color oficial usan temporalmente `#FFFAFA` hasta que el owner confirme su paleta.
- Los colores de Red son datos dinámicos de Supabase y no reemplazan el color del navbar.
- Los colores de departamentos, chips del selector e íconos de navegación son sistemas visuales separados.

Afirmación, Jóvenes y Matrimonios se modelan como paneles/contextos independientes. Sus accesos dejan de añadirse sobre el sidebar de otro rol.

## 5. Consumo de datos y caché

Las páginas no deben consultar “mi primera Red” o “mi primera CdP”. Reciben el alcance desde `useContextoActivo()`:

- Líder de Red: usa `contexto.redId`.
- Líder/Sublíder CdP: usa `contexto.cdpId`.
- Supervisor/Pastor: usa `contexto.iglesiaId` cuando la vista sea por iglesia.
- Departamento: usa `contexto.departamentoId`.

Las query keys de TanStack Query incluyen el ID de alcance. Al cambiar contexto, se invalidan o eliminan las queries del alcance anterior que puedan revelar datos en el nuevo panel. Los selectores internos de Red/CdP solo permanecen si el requisito funcional autoriza mirar varias entidades desde un mismo panel.

## 6. Rutas y URLs

Primera fase: el store persistido es el origen del contexto y las rutas se validan contra él. Una ruta directa sin contexto válido lleva al selector.

Segunda fase, si se requieren enlaces compartibles, puede incorporar IDs en URL con validación equivalente (`/redes/:redId`). Nunca se confía en ese ID sin que la RPC/RLS confirme la asignación.

## 7. Backend y seguridad

No se propone migración de entrada. La respuesta existente de roles ya expone IDs de Redes y CdP. Antes de modificar SQL se debe comprobar que cada contexto pueda validarse de forma estable contra el cargo vigente.

Las políticas RLS y RPC existentes permanecen como autoridad. Si una vista requiere una nueva RPC, esta debe validar `auth.uid()`, la iglesia y la entidad pedida; ocultar un menú no concede permisos.

## 8. Compatibilidad y migración frontend

1. Introducir el nuevo tipo y adaptador desde datos actuales.
2. Persistir ambos campos temporalmente si hace falta, usando `contextoActivo` como preferente.
3. Migrar selector y `PrivateLayout`.
4. Migrar `AppShell` al catálogo único.
5. Migrar páginas y retirar `rolActivo`/defaults por índice.
6. Eliminar compatibilidad temporal tras pruebas completas.

No se deben refactorizar todos los módulos en un único commit sin pruebas por rol; el orden está detallado en `implementation-plan.md`.
