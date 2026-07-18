# Tareas — Persona y Parentela

## 1. Enums

- [ ] 1.1 Crear `sexo_enum` con `M`, `F`. — *Req 1.8*
- [ ] 1.2 Crear `estado_civil_enum` con `SOLTERO`, `CASADO`, `VIUDO`, `DIVORCIADO`. — *Req 2.4*
- [ ] 1.3 Crear `grado_instruccion_enum` con los once valores. — *Req 2.5*

## 2. Persona

- [ ] 2.1 Crear `persona` con los campos de identidad. — *Req 1.1, 1.2, 1.3*
- [ ] 2.2 Crear `chk_persona_nacimiento` (`fecha_nacimiento <= CURRENT_DATE`). — *Req 1.9*
- [ ] 2.3 Crear `uq_persona_ci` como índice único parcial, global, ignorando nulos. — *Req 1.5, 1.6*
- [ ] 2.4 Crear `uq_persona_usuario` como índice único parcial. — *01-tenancy Req 2.7*
- [ ] 2.5 Crear `idx_persona_iglesia` para acelerar el filtro de RLS. — *Rendimiento*
- [ ] 2.6 Crear `fn_persona_normalizar()` y su disparador (correo a minúsculas, validar apellido de casada). — *Req 1.7, 3.2*
- [ ] 2.7 Crear `persona_detalle` con `UNIQUE (persona_id)`. — *Req 2.1, 2.2, 2.3*
- [ ] 2.8 Aplicar el bloque estándar de Fundación a ambas tablas. — *00-fundacion*

## 3. Nombre

- [ ] 3.1 Crear `fn_nombre_completo(persona)` con `array_to_string`. — *Req 4.1, 4.2, 4.3, 4.4*
- [ ] 3.2 Verificar que un nombre sin `segundo_nombre` no produce espacios dobles. — *Req 4.4*
- [ ] 3.3 Verificar que una casada muestra `apellido_casada` y **no** `segundo_apellido`. — *Req 4.3*
- [ ] 3.4 Verificar que PostgREST la expone como columna calculada con `select=id,fn_nombre_completo`. — *Req 4.1*
- [ ] 3.5 Crear `fn_sugerir_apellido_casada(uuid)`. — *Req 3.3*
- [ ] 3.6 Verificar que devuelve `NULL` cuando el cónyuge no está registrado. — *Req 3.8*
- [ ] 3.7 Crear `fn_limpiar_apellido_casada()` y su disparador sobre `persona_detalle`. — *Req 3.7*
- [ ] 3.8 **Confirmar con el owner:** ¿la viuda conserva el apellido de casada? El diseño asume que sí y excluye `VIUDO` del vaciado. — *Req 3.7*

## 4. Dirección y teléfono

- [ ] 4.1 Crear `direccion` con los ocho campos físicos. — *Req 5.2, 5.3*
- [ ] 4.2 Crear `direccion_asignacion` con las tres FK y `chk_direccion_una_sola_entidad`. — *Req 5.1*
- [ ] 4.3 Crear `uq_direccion_principal_persona`. — *Req 5.6*
- [ ] 4.4 Crear el catálogo `tipo_telefono` y sembrar los cinco valores. — *Req 5.4*
- [ ] 4.5 Crear `telefono` y `telefono_asignacion` con el mismo patrón. — *Req 5.1*
- [ ] 4.6 Crear `uq_telefono_principal_persona`. — *Req 5.6*
- [ ] 4.7 Verificar que `iglesia_id` (tenant) e `iglesia_ref_id` (dueño) son columnas distintas y que RLS filtra por la primera. — *01-tenancy Req 4.2*

## 5. Parentela

- [ ] 5.1 Crear `tipo_relacion` con `inverso_id` y `cuenta_para_familia`. — *Req 7.2, 9.2*
- [ ] 5.2 Sembrar los doce tipos y enlazar los inversos en un segundo `UPDATE`. — *Req 7.7, 9.3, 9.4*
- [ ] 5.3 Agregar `chk_tipo_relacion_inverso` como `NOT VALID` y validarla tras la siembra. — *Req 7.7*
- [ ] 5.4 Crear `familia` con `chk_familia_no_autorelacion` y `uq_familia_par`. — *Req 7.1, 7.5, 7.6*
- [ ] 5.5 Crear `fn_familia_simetria()` y `trg_familia_simetria` (`AFTER INSERT OR UPDATE`). — *Req 7.3, 7.4, 7.9*
- [ ] 5.6 Verificar que insertar A→B crea B→A automáticamente y **no** entra en bucle. — *Req 7.3*
- [ ] 5.7 Verificar que eliminar A→B elimina B→A. — *Req 7.4*
- [ ] 5.8 Verificar que relacionar personas de iglesias distintas falla con `FAMILIA_IGLESIAS_DISTINTAS`. — *Req 7.9*
- [ ] 5.9 Crear `referencia_familiar`. — *Req 8.1, 8.2*

## 6. Conteo de familias

- [ ] 6.1 Crear `fn_nucleos_familiares(uuid)` con el CTE recursivo. — *Req 9.1, 9.6, 9.7, 9.9*
- [ ] 6.2 Crear `fn_total_familias(uuid)`. — *Req 9.8*
- [ ] 6.3 Crear `fn_familias_detalle(uuid)` para el dashboard. — *Req 9.8*
- [ ] 6.4 Verificar que una persona sin relaciones cuenta como un núcleo de uno. — *Req 9.6*
- [ ] 6.5 Agregar la verificación de `fn_mis_iglesias()` al inicio de las tres funciones. **No es opcional**: son `SECURITY DEFINER` y sin esto cualquiera lee cualquier iglesia. — *Riesgo*
- [ ] 6.6 Verificar con datos de prueba: familia de 4 (padres + 2 hijos) debe dar un núcleo, no cuatro. — *Req 9.1*
- [ ] 6.7 Verificar que cambiar `cuenta_para_familia` de `ABUELO` a `false` cambia el conteo en la consulta siguiente, sin recálculo. — *Req 9.5, 9.10*
- [ ] 6.8 Medir con `EXPLAIN ANALYZE` sobre 5.000 personas. Si supera 500 ms, evaluar la vista materializada. — *Rendimiento*
- [ ] 6.9 **Confirmar con el owner:** ¿"familia" es hogar o linaje? Si es hogar, `ABUELO` debe ir en `false`. — *Req 9.3*

## 7. Llegada

- [ ] 7.1 Crear el catálogo `motivo_llegada` y sembrar los cinco valores. — *Req 6.4*
- [ ] 7.2 Crear `persona_llegada` con `chk_llegada_invitador` y `chk_llegada_fecha`. — *Req 6.1, 6.2, 6.3, 6.6*
- [ ] 7.3 Verificar que ambos invitadores a la vez falla, y que ambos nulos se acepta. — *Req 6.3*

## 8. Personas ocultas

- [ ] 8.1 Confirmar que `persona.oculto` existe con `DEFAULT false`. — *Req 10.1*
- [ ] 8.2 Crear la vista de búsqueda que filtra `oculto = false`. — *Req 10.2*
- [ ] 8.3 Crear la política que restringe el cambio de `oculto` a `fn_es_admin_en(iglesia_id)`. — *Req 10.3*
- [ ] 8.4 Verificar que las personas ocultas **sí** entran en los conteos agregados. — *Req 10.4*

## 9. RLS

- [ ] 9.1 Habilitar RLS y aplicar las 4 políticas estándar a: `persona`, `persona_detalle`, `direccion`, `direccion_asignacion`, `telefono`, `telefono_asignacion`, `persona_llegada`, `familia`, `referencia_familiar`. — *01-tenancy Req 4.1*
- [ ] 9.2 `tipo_relacion`, `tipo_telefono` y `motivo_llegada` son catálogos globales: lectura para todo `authenticated`, escritura solo para `ADMIN`. — *00-fundacion Req 5*
- [ ] 9.3 Ejecutar la auditoría de RLS. Cero filas. — *01-tenancy Req 4.7*

## Dependencias

- [00-fundacion](../00-fundacion/) completa.
- [01-tenancy-iglesias](../01-tenancy-iglesias/): `iglesia` debe existir. Circular con `iglesia.pastor_id` → misma migración.
- `casa_de_paz` de [03-estructura](../03-estructura/) para la FK de `direccion_asignacion`. Agregarla con `ALTER TABLE` después.

## Bloquea a

Todas las áreas de dominio. Todo referencia a `persona`.
