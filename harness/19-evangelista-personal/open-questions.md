# Preguntas abiertas — Evangelista personal + UI v2

Cada ticket de la épica pide explícitamente "no asumir, confirmar antes
de implementar". Esto es lo que queda sin resolver después de investigar
el código real -- decisiones que le corresponden al owner, no al
desarrollo.

## Sobre el rol (KAN-427/434)

1. ¿Quién puede otorgar el rol Evangelista a un miembro? ¿Solo Líder de
   CdP, o también Sublíder de CdP / Líder de Red / Supervisor / Pastor?
2. ¿El miembro tiene que pertenecer obligatoriamente a una Casa de Paz
   para poder ser Evangelista, o cualquier persona de la iglesia (incluso
   sin CdP)?
3. Si la persona todavía no tiene cuenta de usuario (correo/login), ¿se
   dispara una invitación nueva al otorgarle el rol, o queda "pendiente"
   hasta que tenga cuenta por otro medio?
4. ¿El rol se puede auto-otorgar (alguien pide ser Evangelista) o siempre
   lo asigna otra persona?

## Sobre el registro (KAN-430)

5. ¿Confirmás que los únicos campos obligatorios son primer nombre,
   primer apellido y sexo (teléfono/fecha nacimiento/dirección
   opcionales)?
6. Tipo de evangelismo (1+1/Elite/Semilla) -- ¿es obligatorio elegir uno,
   o puede quedar sin especificar?
7. ¿El registro de un Evangelista-miembro debe aparecer o no en las
   estadísticas actuales de Departamento de Evangelismo/Afirmación (que
   hoy excluyen `SEMILLA`)? Si tiene que distinguirse de los evangelizados
   de CdP para no inflar esas métricas, hay que definir el criterio
   exacto.

## Sobre las métricas del dashboard (KAN-429)

8. Los 3 indicadores (Registrados / En seguimiento / Nuevos convertidos)
   -- ¿son del mes en curso, de los últimos 30 días, o de un período que
   el Evangelista puede elegir?
9. "Nuevos convertidos" -- ¿qué condición exacta convierte un registro en
   esto? (ej. ¿cambio de estado SSVA a Creyente, un seguimiento marcado
   como "convertido", o algo que hay que definir de cero)

## Sobre el seguimiento (KAN-432)

10. ¿Existe alguna cadencia recomendada para "cuándo volver a
    contactar" (ej. avisar si pasaron X días sin seguimiento), o el
    siguiente contacto es 100% manual, sin recordatorios?
11. Al tocar "Contactar ahora" con WhatsApp/llamada, ¿la app abre esa
    aplicación externa y vuelve sola a pedir el resultado, o el
    Evangelista tiene que volver manualmente a VisionHub y buscar la
    persona de nuevo para registrar el contacto?

## Sobre la integración en roles existentes (KAN-433)

12. Para Líder de Red / Supervisor / Pastor que **no tienen** una CdP
    propia: ¿qué ven al entrar a "Evangelismo" -- directo el panel
    personal (como cualquier Evangelista), o siguen viendo solo el
    módulo de supervisión que ya tienen?
13. ¿Todos los roles estructurales (Sublíder CdP en adelante) tienen el
    rol Evangelista automáticamente disponible, o hay que otorgárselo
    igual que a un miembro sin cargo?

## Recursos visuales pendientes (KAN-428/429)

14. Falta la ruta del **banner SVG de Evangelismo** y del **SVG del
    fuego** (racha) -- las 3 capturas (`1.jpeg`, `2.jpeg`, `3.jpeg`) ya
    están revisadas, pero esos 2 archivos todavía no se compartieron.

## Confirmado, no requiere pregunta (documentado para no repreguntar)

- Efesio "Evangelista" (censo, alto rango, sin CdP propia) y rol
  Evangelista (miembro con CdP, mandato general) son conceptos
  completamente separados -- confirmado por el owner, 2026-09-29.
- El registro puede guardarse en la tabla `evangelismo` ya existente
  (acepta `casa_de_paz_id = NULL`) -- confirmado por el owner, 2026-09-29.
- Tipo de evangelismo usa el catálogo `tipo_evangelismo` ya existente
  (1+1/Elite/Semilla), no uno nuevo.
