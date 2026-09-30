# Preguntas abiertas — Formulario de Altar ampliado (membresía paralela)

Decisiones que el owner **delegó explícitamente en el programador**
("que el programador decida / pregunte") o que quedaron sin cerrar. Matías:
resolver estas antes de implementar. Formulario de referencia:
https://docs.google.com/forms/d/e/1FAIpQLSdTC5p1A85j4Xn8pzLj4k-pUgZM_v52C6oQZhkXLCc-_12LWA/viewform

## Estructura del componente

1. ¿Extender `DatosBasicosPersonaFields` con una variante, o crear
   `AltarMembresiaFields` que lo componga adentro? (Recomendado: componer,
   para no acoplar los campos de Altar a RSIL/Fiesta que reusan el base.
   Ver Hallazgo 1.)
2. ¿El alta ampliada usa una RPC nueva transaccional
   (`fn_altar_registrar_persona_membresia`) o encadena las RPCs actuales
   (`crearPersona` + `fn_guardar_membresia_extendida` + teléfono +
   dirección + SSVA + registrar proceso)? Preferible una sola RPC por
   atomicidad. **Recordar el gate `fn_es_super_admin()`.**

## Tipo de decisión / SSVA (Requisito 4)

3. Confirmar el mapeo exacto de "Reconciliación": el owner dijo "si ya está
   en el sistema → RE (reconciliado)". ¿Toda persona existente que pase por
   Altar con decisión de fe va a **RE**, aunque su estado actual ya sea CRE
   u otro? ¿O solo si venía de un estado anterior puntual?
4. En la UI, ¿se muestran los 3 botones del formulario (Salvación/
   Reconciliación/Visita) aunque Salvación vs Reconciliación sea
   automático, o se simplifica a solo "¿Es visita/simpatizante? sí/no" y el
   resto lo deduce el sistema? El owner dijo que NC/RE es automático y solo
   "Visita/simpatizante" es manual -- confirmar cómo se ve.

## Bautismo (Requisito 5 / Hallazgo 5)

5. ¿Cómo se modela la denominación de bautismo externo (Católica /
   Evangélica / cuál iglesia)? Opciones: columna nueva
   `bautismo_denominacion` + `bautismo_iglesia_nombre` en `persona_detalle`,
   o un enum `bautismo_origen_enum`. Además: "Centro de Vida" = cualquiera
   de nuestras iglesias del mundo -- NO es lo mismo que
   `bautizado_en_nuestra_iglesia` (que hoy implica ESTA iglesia). Definir la
   semántica antes de reusar ese booleano.

## Categoría de evangelismo (Requisito 6 / Hallazgo 6)

6. El catálogo `tipo_evangelismo` hoy es 1+1 / Elite / **Semilla**; el
   formulario pide 1+1 / **CDP** / Elite. "CDP" es un valor nuevo (persona
   que nunca vino a la iglesia pero sí a las CdP). **Coordinar con Daniel**
   (está trabajando Evangelismo, `harness/19-`) cómo queda "Semilla" y si
   la lista final es 1+1/CDP/Elite/Semilla o se reemplaza Semilla. No tocar
   el catálogo sin cerrar esto con Daniel.

## Categoría del servicio (Requisito 7)

7. ¿Se implementa ya como catálogo de tipos de servicio (tradicionales
   fijos: Domingo Mañana/Noche, Casa de Oración, Jóvenes, Discipulados... +
   eventuales) o se deja SOLO la fecha por ahora? El owner dijo que por
   ahora alcanza con la fecha, pensando que a futuro habrá lista. También
   mencionó que el día del servicio a veces se puede inferir de la fecha,
   pero no siempre (antes las reuniones cambiaban de día) -- si se modela el
   catálogo, no asumir el tipo a partir del día de la semana.

## Campos sin destino claro en la base

8. **SEXO**: el formulario tiene "Sin especificar", pero `persona.sexo`
   hoy es solo M/F. ¿Se agrega un tercer valor, o "Sin especificar" se
   guarda como NULL / se omite?
9. **HORARIO DE CONTACTO**: no hay campo hoy. ¿Columna nueva (ej.
   `persona_detalle.horario_contacto`), parte de observaciones, o no se
   persiste?
10. **ASISTE A ALGUNA CASA DE PAZ? (cuál líder)**: ¿se vincula a una CdP /
    líder real del sistema (relación), o es texto libre informativo? Si es
    relación, ¿reusa el buscador de CdP/líder existente?
11. **CÓMO LLEGÓ A LA IGLESIA? (solo / alguien lo invitó - quién)**: ¿se
    mapea a `persona_llegada` + `invitado_por_id` (dato estructurado que ya
    existe) o queda como texto libre?

## Patrón ver/editar y ficha (Requisitos 8-10)

12. El nuevo patrón "form bloqueado → Editar desbloquea" (Req 8) --
    ¿reemplaza a `FichaPersonaSheet` (la ficha paginada compartida) en
    TODA la app, o es solo la vista de edición del contexto Afirmación
    (Altar/RSIL/Bautismo) mientras el resto de la app sigue con la ficha
    actual? Afecta el alcance del cambio (12 archivos usan la ficha).
13. "Ocultar de búsquedas" (Req 10): confirmar el nombre/ubicación del
    toggle en el panel de Supervisor/Pastor y el nombre del criterio de
    config (propuesta: `OCULTAR_EFESIOS_DE_BUSQUEDAS`, por defecto true).
    ¿El toggle es por iglesia, o global de la organización? ¿Aplica solo a
    Efesios o a cualquier persona marcada hoy con `persona.oculto`?

## Membresía desde 0 — inventario de campos (2026-09-29)

14. **Cónyuge y Familia**: la membresía por link los pregunta
    (`SeccionConyugeMembresia`, `SeccionFamiliaMembresia`), pero
    `form_altar.png` no. ¿Se quitan de la Membresía desde-0 (todos nuevos,
    se simplifica) o se dejan opcionales? Ver la sección "A confirmar" del
    inventario en requirements.md.
15. **Origen link vs desde-0**: ¿cómo se distinguen las dos membresías en
    la base? (campo de origen en la ficha, tabla separada, etc.) -- el
    owner confirmó que son "dos formularios distintos", falta el mecanismo
    técnico exacto.
16. **Botón "llenar membresía" desde Bautismo** (Requisito 0): al registrar
    el bautismo, ¿el botón abre la Membresía desde-0 en la misma pantalla,
    navega a otra, o queda como pendiente/recordatorio? ¿Es obligatorio
    hacer la membresía tras bautizar o puede quedar para después?

## Confirmado, no requiere pregunta (documentado para no repreguntar)

- Es una **membresía paralela/v2** que coexiste con el formulario de
  membresía actual -- NO lo reemplaza, y NO incluye ministerio/rol/censo.
- Datos de membresía → van a la **ficha real** de la persona.
- Nombres → 4 campos separados + formato Título **en vivo**.
- Edad → fecha de nacimiento con el mecanismo de CdP (edad aproximada solo
  como excepción, el sistema sigue pidiendo la fecha después).
- Persona existente → precargar todos los datos, mostrar para verificar,
  confirmar, y recién ahí registrar.
