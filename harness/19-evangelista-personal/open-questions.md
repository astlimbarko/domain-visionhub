# Preguntas abiertas — Evangelista personal + UI v2

Cada ticket de la épica pide explícitamente "no asumir, confirmar antes
de implementar". Esto es lo que queda sin resolver después de investigar
el código real -- decisiones que le corresponden al owner, no al
desarrollo. Actualizado 2026-09-29 con las respuestas de la primera
ronda de preguntas.

## Sobre el rol (KAN-427/434)

1. ~~¿Quién puede otorgar el rol Evangelista a un miembro?~~ **RESUELTO
   (2026-09-29)**: Líder de CdP, Sublíder de CdP, Líder/Supervisor de
   Red, operativos (Pastor/Supervisor) y Departamento de Evangelismo --
   todos, no uno solo. Además va a existir un **panel dedicado** para
   este alta, todavía sin especificar en detalle (pendiente, ver más
   abajo).
2. ~~¿Un miembro necesita pertenecer obligatoriamente a una CdP?~~
   **RESUELTO (2026-09-29)**: sí, siempre, para un miembro común. La
   única excepción son los Efesios sin CdP propia (ver Requisito 9 en
   requirements.md) -- ellos evangelizan sin necesitar membresía en una
   CdP.
3. Si la persona todavía no tiene cuenta de usuario (correo/login), ¿se
   dispara una invitación nueva al otorgarle el rol, o queda "pendiente"
   hasta que tenga cuenta por otro medio?
4. ¿El rol se puede auto-otorgar (alguien pide ser Evangelista) o siempre
   lo asigna otra persona?
5. **NUEVA (2026-09-29)**: el panel dedicado para dar de alta el rol --
   ¿reemplaza a que cada rol lo otorgue desde su propio menú (Requisito 2
   original), o convive como una vía adicional? Pendiente de
   especificación completa por el owner en otra sesión.

## Sobre el registro (KAN-430)

6. ¿Confirmás que los únicos campos obligatorios son primer nombre,
   primer apellido y sexo (teléfono/fecha nacimiento/dirección
   opcionales)?
7. Tipo de evangelismo (1+1/Elite/Semilla) -- ¿es obligatorio elegir uno,
   o puede quedar sin especificar?
8. ¿El registro de un Evangelista-miembro debe aparecer o no en las
   estadísticas actuales de Departamento de Evangelismo/Afirmación (que
   hoy excluyen `SEMILLA`)? Si tiene que distinguirse de los evangelizados
   de CdP para no inflar esas métricas, hay que definir el criterio
   exacto.

## Sobre las métricas del dashboard (KAN-429)

9. Los 3 indicadores (Registrados / En seguimiento / Nuevos convertidos)
   -- ¿son del mes en curso, de los últimos 30 días, o de un período que
   el Evangelista puede elegir?
10. ~~¿Qué condición exacta convierte un registro en "Nuevo
    convertido"?~~ **RESUELTO (2026-09-29)**: cuando el estado SSVA de la
    persona pasa a `NC` (Nuevo Convertido) -- ocurre al aceptar a Cristo
    en la iglesia o en la Casa de Paz. Antes de eso es solo "registro de
    evangelismo" (clasificación exacta a definir).

## Sobre el seguimiento (KAN-432)

11. ¿Existe alguna cadencia recomendada para "cuándo volver a
    contactar" (ej. avisar si pasaron X días sin seguimiento), o el
    siguiente contacto es 100% manual, sin recordatorios?
12. Al tocar "Contactar ahora" con WhatsApp/llamada, ¿la app abre esa
    aplicación externa y vuelve sola a pedir el resultado, o el
    Evangelista tiene que volver manualmente a VisionHub y buscar la
    persona de nuevo para registrar el contacto?

## Sobre la integración en roles existentes (KAN-433)

13. ~~Roles sin CdP propia -- ¿qué ven al entrar a "Evangelismo"?~~
    **RESUELTO (2026-09-29)**: en la práctica todo rol estructural
    (Líder de Red, Supervisor, Pastor) SIEMPRE tiene una CdP de la que es
    miembro, así que ven el panel personal igual que cualquiera. La
    excepción real son los Efesios sin CdP (Requisito 9), no los roles
    estructurales.
14. ¿Todos los roles estructurales (Sublíder CdP en adelante) tienen el
    rol Evangelista automáticamente disponible, o hay que otorgárselo
    igual que a un miembro sin cargo?

## Sobre Efesios sin CdP (NUEVO, Requisito 9, 2026-09-29)

15. Nombre exacto de la nueva categoría de estadísticas para personas
    evangelizadas por un Efesio sin CdP (propuesta en technical-design.md:
    "Evangelizado por Efesios" o "Sin Casa de Paz asignada") -- confirmar
    con el owner el nombre final que va a ver el usuario.
16. ¿En qué pantallas exactas tiene que aparecer esta categoría nueva
    (dashboard de Departamento de Evangelismo, reportes de Red, ambos)?
17. El futuro proceso de asignación de CdP por Afirmación (para mover a
    estas personas de "sin CdP" a una CdP real) -- confirmado que es
    trabajo FUERA de esta épica, pero: ¿ya existe un ticket para eso, o
    hay que crearlo cuando llegue el momento?

## Recursos visuales pendientes (KAN-428/429)

18. Falta la ruta del **banner SVG de Evangelismo** y del **SVG del
    fuego** (racha) -- las 3 capturas (`1.jpeg`, `2.jpeg`, `3.jpeg`) ya
    están revisadas, pero esos 2 archivos todavía no se compartieron.

## Confirmado, no requiere pregunta (documentado para no repreguntar)

- Efesio "Evangelista" (censo, alto rango, sin CdP propia necesariamente)
  y rol Evangelista (miembro con CdP, mandato general) son conceptos
  completamente separados -- confirmado por el owner, 2026-09-29.
- El registro puede guardarse en la tabla `evangelismo` ya existente
  (acepta `casa_de_paz_id = NULL`) -- confirmado por el owner, 2026-09-29.
- Tipo de evangelismo usa el catálogo `tipo_evangelismo` ya existente
  (1+1/Elite/Semilla), no uno nuevo.
- Quién otorga el rol: varios roles a la vez, no uno solo (ver #1).
- CdP obligatoria para miembros comunes, con excepción de Efesios (#2).
- Definición de "Nuevo convertido" = SSVA pasa a NC (#10).
