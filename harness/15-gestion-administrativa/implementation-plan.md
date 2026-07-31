# 15 — Gestión administrativa — implementation-plan.md

> Orden lógico de implementación. **Solo propuesto.** No ejecutar hasta la
> aprobación explícita del owner. Cada **Panel** es un entregable independiente:
> al terminarlo se avisa al owner para probar y se pregunta antes de continuar
> (flujo pactado 2026-07-30). Se commitea siempre, en rama de feature, nunca en
> master.

## Criterio de corte por paneles

Cada panel deja algo **probable en vivo** por sí mismo y minimiza el riesgo de
que un cambio de infraestructura rompa lo existente antes de tener UI para
verlo. Por eso la infraestructura transversal va primero pero validada de a poco.

---

## Panel 0 — Cimientos transversales (bajo riesgo, habilita todo)

**Objetivo:** piezas que no dependen de nada y desbloquean el resto.

1. Pie de soporte institucional en `AppShell.tsx` (desktop + drawer móvil) →
   `mailto:soporte@somoscdv.com` con asunto/cuerpo prellenados.
2. Extraer `CAMPO_ESTILO` (hover azul) a un lugar compartido y **documentarlo**
   en `frontend-style/SKILL.md`. No tocar el uso actual de Matías.
3. Documentar en el design system los colores de departamento y el tipo de
   iglesia (tokens/constantes).

**Prueba:** ver el pie de soporte en ambos layouts; el correo abre con el texto
base; el SKILL queda actualizado. `tsc -b` + `lint` limpios.

---

## Panel 1 — OTP por correo (reemplaza el PIN estático)

**Objetivo:** que toda acción sensible se confirme con código por correo.

1. Migración `57_usuario_otp.sql` (tabla + RLS + índices).
2. Edge Function `solicitar-otp` (genera, hashea, envía por Brevo; HTML propio;
   identidad correcta; rate-limit 30s).
3. Migración `58_otp_verificacion.sql`: `fn_exigir_pin(p_pin)` verifica OTP,
   misma firma → sin cambios en las funciones que ya lo llaman.
4. Frontend: `ConfirmarConCodigoDialog` (enviar código → ingresar → confirmar);
   reemplaza el input de PIN en los flujos existentes (crear iglesia, config,
   fusiones, etc.).

**Prueba:** ejecutar una acción sensible ya existente (p. ej. crear iglesia como
Super-Admin) → llega el correo con el código → se confirma. Entrega real
verificada (buzón desechable + `astlimbark@gmail.com`). Curl por cada función
sensible: sin OTP válido, rechaza.

> ⚠️ Es el panel de mayor cuidado: toca la verificación compartida. Se prueba
> función por función antes de avanzar.

---

## Panel 2 — Super-Admin: "Gestionar" completo

**Objetivo:** cerrar el ciclo agregar/modificar/suspender/reactivar/eliminar de
iglesias y usuarios, con alta de doble vía.

1. RPC de gestión de iglesias y usuarios (`60_gestion_admin_rpc.sql`, la parte
   de Super-Admin) con OTP + soft delete + validaciones.
2. UI en `Administracion.tsx`: menús de acción por fila + `EditarIglesiaDialog`,
   `GestionarUsuarioDialog`.
3. Alta con doble vía en admin: Opción 1 (buscar persona, reutiliza
   `BuscadorPersona`) + Opción 2 (invitar, ya existe).

**Prueba:** editar/suspender/reactivar/eliminar (soft) una iglesia y un usuario;
verificar que el eliminado desaparece de la operación pero queda en historial;
dar de alta un usuario por ambas vías.

---

## Panel 3 — Supervisor: Departamentos

**Objetivo:** el ítem de menú "Departamentos" y la gestión de sus líderes.

1. Migración `56_departamento_color.sql` (color + seed).
2. RPC `fn_designar/remover_lider_departamento` (parte de `60_`).
3. Nav "Departamentos" + `pages/Departamentos.tsx`: 4 tarjetas con color y verbo,
   líder vigente, gestión por doble vía.

**Prueba:** designar/cambiar/remover el líder de un departamento; ver colores y
verbos correctos; aislamiento por iglesia; soft delete conserva historial.

---

## Panel 4 — Pastor: pantalla de gestión

**Objetivo:** que el Pastor administre a su Supervisor y sus iglesias
hijas/satélite.

1. Migración `55_iglesia_tipo.sql` (tipo HIJA/SATELITE, aditivo).
2. Ampliar `fn_crear_iglesia` (Pastor) + `fn_convertir_tipo_iglesia` (parte de
   `60_`).
3. Ruta + item nav + `pages/` del Pastor: sección "Mi Supervisor" (doble vía) +
   sección "Iglesias hijas y satélite" (crear/convertir/suspender/eliminar).

**Prueba:** como Pastor, gestionar al Supervisor; crear una iglesia hija,
convertirla a satélite y de vuelta; suspender/eliminar; confirmar que el
Super-Admin ve los cambios en su panorama.

---

## Panel 5 — Supervisor de Red (rol nuevo)

**Objetivo:** incorporar el rol nuevo con su lógica.

1. Migración `59_supervisor_red.sql` (enum + ramas de permiso).
2. Frontend: nuevo `RolUI`/`RolSistema`, rutas, meta, detección, nav.
3. Gestión del Supervisor de Red por el Supervisor de la Visión en Acción
   (doble vía).

**Prueba:** asignar el rol; verificar navegación/alcance acotado; que no herede
capacidades del Supervisor de la Visión en Acción.

> Depende de cerrar **OQ-SR** (alcance funcional) antes de empezar.

---

## Notas de proceso

- **Modelo:** la documentación (specs) se hizo en Opus. La **implementación** se
  hace en **Sonnet** — avisar al owner para cambiar de modelo antes de codear.
- **Commits:** siempre, en la rama de feature de cada panel; PR a master al
  cerrar cada panel aprobado.
- **Al terminar cada panel:** avisar al owner, dejar el panel probado, y
  preguntar antes de continuar con el siguiente.
- **Bitácora:** actualizar `bitacora-equipo/AAAA-MM-DD/gonzalo.md` a medida que
  se avanza (regla de `CLAUDE.md`).
