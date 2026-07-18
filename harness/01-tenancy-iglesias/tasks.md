# Tareas — Tenancy e Iglesias

## 1. Tablas base

- [ ] 1.1 Crear `cobertura` con `cobertura_padre_id` y `chk_cobertura_no_autopadre`. — *Req 1.6*
- [ ] 1.2 Crear el enum `moneda_enum` con `BOB`, `USD`. — *Req 7.6*
- [ ] 1.3 Crear `iglesia` con `iglesia_padre_id`, `cobertura_id`, `pastor_id`, `supervisor_id`, `moneda_defecto`. — *Req 1.1, 1.6, 1.7*
- [ ] 1.4 Crear `chk_iglesia_no_autopadre`. — *Req 1.4*
- [ ] 1.5 Crear `fn_iglesia_sin_ciclo()` y su disparador. — *Req 1.5*
- [ ] 1.6 Crear el enum `rol_sistema_enum`. — *Req 3.3*
- [ ] 1.7 Crear `usuario_rol` con `chk_rol_iglesia` y `uq_usuario_rol_vigente`. — *Req 3.1, 3.4*
- [ ] 1.8 Aplicar a cada tabla el bloque estándar de Fundación: auditoría, bloqueo de DELETE, RLS, vista `v_`. — *00-fundacion Req 2, 3*

> `iglesia.pastor_id` y `supervisor_id` referencian `persona`, que se crea en [02-persona-parentela](../02-persona-parentela/). Crear `iglesia` primero sin esas FK y agregarlas con `ALTER TABLE` después de `persona`, o crear ambas tablas en la misma migración.

## 2. Vínculo Persona ↔ Usuario

- [ ] 2.1 Agregar `persona.usuario_id UUID REFERENCES auth.users(id)`, nulable. — *Req 2.5, 2.6*
- [ ] 2.2 Crear índice único parcial sobre `persona.usuario_id` donde no sea nulo y la fila esté vigente. — *Req 2.7*
- [ ] 2.3 Confirmar que `persona.correo` existe y es independiente de `auth.users.email`. — *Req 2.8*
- [ ] 2.4 Auditar el esquema: ninguna tabla de `public` debe tener columnas de password, hash, token ni contador de intentos. — *Req 2.4*

## 3. Funciones de acceso

- [ ] 3.1 Crear `fn_es_super_admin()` — `STABLE SECURITY DEFINER SET search_path = public`. — *Req 3.4*
- [ ] 3.2 Crear `fn_mi_persona_id()`. — *Req 5.4*
- [ ] 3.3 Crear `fn_mis_iglesias()` con las cinco ramas del `UNION`. — *Req 5.1 a 5.4*
- [ ] 3.4 Crear `fn_es_admin_en(uuid)`. — *Req 6.3*
- [ ] 3.5 Crear `fn_es_invitado_en(uuid)`. — *Req 3.5, 3.6*
- [ ] 3.6 Crear `fn_mis_iglesias_detalle()` para el selector de iglesia. — *Req 5.8*
- [ ] 3.7 Verificar que **todas** llevan `SECURITY DEFINER` y `SET search_path = public`. Sin esto hay recursión infinita y riesgo de secuestro de search_path. — *Req 4.5*

## 4. Políticas RLS

- [ ] 4.1 Habilitar RLS en `cobertura`, `iglesia` y `usuario_rol`. — *Req 4.1*
- [ ] 4.2 Crear `pol_iglesia_select`, `pol_iglesia_insert` (solo SUPER_ADMIN), `pol_iglesia_update` (solo ADMIN de esa iglesia). — *Req 4.3, 6.1*
- [ ] 4.3 Crear las políticas de `usuario_rol`: se lee lo de las iglesias accesibles, se escribe solo siendo ADMIN ahí. — *Req 6.3, 6.7*
- [ ] 4.4 Documentar el patrón de las 4 políticas estándar para que lo copien las demás áreas. — *Req 4.3*
- [ ] 4.5 Revocar todo acceso de `anon` al esquema `public`. — *Req 4.6*
- [ ] 4.6 Verificar con `EXPLAIN ANALYZE` que `fn_mis_iglesias()` aparece como InitPlan y no se evalúa por fila. — *Riesgo de rendimiento*

## 5. Alta en cadena

- [ ] 5.1 Crear `fn_validar_asignacion_rol()` con las cuatro validaciones. — *Req 6.5, 6.6, 6.7*
- [ ] 5.2 Crear `trg_validar_rol` sobre `usuario_rol`. — *Req 6.5*
- [ ] 5.3 Documentar el procedimiento de arranque del primer SUPER_ADMIN (desactivar disparador, insertar, reactivar). — *Req 6.1*
- [ ] 5.4 Crear la Edge Function `crear-usuario` con verificación de JWT y de `fn_es_admin_en`. — *Req 6.2, 6.3, 6.4*
- [ ] 5.5 Confirmar que la Edge Function nunca devuelve el `SERVICE_ROLE_KEY` ni lo expone en logs. — *Riesgo*
- [ ] 5.6 Confirmar que `inviteUserByEmail` obliga a fijar contraseña en el primer ingreso. — *Req 2.9*

## 6. Datos del despliegue inicial

- [ ] 6.1 Insertar la Cobertura "Red Apostólica del Ap. Edgar Ortuño", sede Cochabamba. — *Req 7.1*
- [ ] 6.2 Insertar "Centro de Vida Global 4 Anillo", Santa Cruz, `iglesia_padre_id = NULL`, `moneda_defecto = 'BOB'`. — *Req 7.2, 7.6*
- [ ] 6.3 Insertar "Centro de Vida Global Montero", Montero, `iglesia_padre_id = NULL`, `moneda_defecto = 'BOB'`. — *Req 7.3, 7.6*
- [ ] 6.4 Confirmar que Cochabamba **no** se inserta. — *Req 7.4*
- [ ] 6.5 Crear la persona del pastor y asignarla como `pastor_id` de ambas iglesias. — *Req 7.5*
- [ ] 6.6 Crear el usuario del pastor vía Edge Function y asignarle `ADMIN` en ambas iglesias. — *Req 6.1*

## 7. Verificación

- [ ] 7.1 Ejecutar la consulta de auditoría de RLS. Debe devolver cero filas:
      ```sql
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = false;
      ```
      — *Req 4.1, 4.7*
- [ ] 7.2 Con el JWT del líder de Montero, pedir las personas de Santa Cruz por curl. Debe devolver `[]`, no un error 403: el Requisito 4.4 exige que se comporte como si no existieran. — *Req 4.4*
- [ ] 7.3 Con el JWT del pastor, confirmar que `fn_mis_iglesias()` devuelve las dos iglesias. — *Req 5.2, 5.5*
- [ ] 7.4 Con el JWT de un líder de CdP, confirmar que `fn_mis_iglesias()` devuelve una sola. — *Req 5.4*
- [ ] 7.5 Con un JWT de un `LIDER_CDP` de otra iglesia (rol de dominio asignado, sin ninguna operación de escritura vigente en esta iglesia), confirmar que el `SELECT` de su propia iglesia funciona y que el `INSERT` fuera de sus reglas devuelve error. Ya no existe un rol `INVITADO` transversal (Req 3.5). — *Req 3.5, 4.3*
- [ ] 7.6 Intentar auto-asignarse `PASTOR`. Debe fallar con `ROL_AUTOASIGNACION`. — *Req 6.5*
- [ ] 7.7 Con el JWT del supervisor de Montero, intentar asignar un rol en Santa Cruz. Debe fallar con `ROL_FUERA_DE_ALCANCE`. — *Req 6.7*
- [ ] 7.8 Simular el alta de Cochabamba en una rama descartable: insertar la iglesia y actualizar `iglesia_padre_id` de las dos hijas. Confirmar que no hizo falta ningún `ALTER TABLE` ni cambio de política. — *Req 1.3, 7.7*
- [ ] 7.9 Intentar cerrar un ciclo (A padre de B, B padre de A). Debe fallar con `IGLESIA_CICLO`. — *Req 1.5*

## Dependencias

- [00-fundacion](../00-fundacion/) completa.
- `persona` de [02-persona-parentela](../02-persona-parentela/) para las FK `pastor_id` y `supervisor_id`. Crear ambas áreas en la misma migración.

## Bloquea a

Todas las áreas de datos. Sin `fn_mis_iglesias()` no hay política RLS que escribir.
