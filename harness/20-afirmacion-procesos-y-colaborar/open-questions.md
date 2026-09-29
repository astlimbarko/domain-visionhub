# Preguntas abiertas — Procesos de Afirmación + Colaborar por tarjetas

Decisiones que le corresponden al owner antes de implementar. Ninguna
bloquea RSIL/Fiesta (backend ya existe) -- todas son relevantes para
Bautismo/Membresía (KAN-482) y Colaborar (KAN-485).

## Sobre Colaborar por tarjetas (KAN-485)

1. **Códigos ya generados hoy** (antes de que exista la granularidad por
   tarea): ¿qué tareas les corresponden? Propuesta a confirmar: todas las
   4 (comportamiento actual, "todo Afirmación"), para no cortarle el
   acceso a nadie que ya esté colaborando -- pero es una decisión del
   owner, no algo a asumir.
2. ¿El Líder de Afirmación elige las tareas al **crear** el código
   (`GenerarCodigoCard`), o puede modificarlas después sobre un código ya
   generado (mismo código, cambiar qué autoriza)?
3. Si un código autoriza solo 1 tarea (ej. solo Altar), ¿igual se muestra
   la tarjeta "Afirmación" como paso intermedio con 1 sola tarjeta
   adentro, o se salta directo a esa tarea? El ticket pide la jerarquía
   `Colaborar → Afirmación → tarea`, pero no aclara este caso borde.
4. ¿Un Colaborador puede tener más de un código activo a la vez con
   distintas tareas (ej. uno de Altar + otro de RSIL por separado), o un
   código siempre cubre "todo lo que se decida" en un solo lugar? Afecta
   si la granularidad va en `colaborador_codigo` (1 código = N tareas) o
   si hay que permitir múltiples sesiones simultáneas.

## Sobre Bautismo/Membresía (KAN-482)

5. El ticket pide "revisar campos que no correspondan a una persona
   recién bautizada" (cargo/rango, ministerios, etc.) -- ¿se ocultan
   completamente para este contexto, quedan opcionales, o se dejan
   igual y la revisión es solo un chequeo de que nada rompe? El
   technical-design no asume una respuesta.
6. La fecha de bautismo -- ¿son los 3 campos completos (`bautismo_anio/
   mes/dia` + `bautismo_precision_fecha`, mismo patrón que discipulados/
   seminario) o alcanza con una fecha simple tipo `DATE`, más parecida a
   como Altar/RSIL/Fiesta guardan su fecha?
7. ¿El `SelectorLiderCdp` (elegir Líder de CdP, hoy obligatorio en
   `fn_registrar_persona_afirmacion`) sigue siendo obligatorio para el
   caso Bautismo, o se vuelve opcional cuando el registro viene desde un
   Colaborador que solo tiene tarea "Bautismo" y no necesariamente sabe
   a qué CdP asignar a la persona?

## Confirmado, no requiere pregunta (documentado para no repreguntar)

- RSIL y Fiesta de Bienvenida reusan la tabla/RPCs genéricas de Altar sin
  cambios de esquema -- el enum ya las incluye.
- La pantalla intermedia de tarjetas de Colaborar HOY NO EXISTE --
  confirmado en vivo contra `Colaborar.tsx` (2026-09-29).
- La restricción de tarea debe vivir en el backend, no solo ocultar
  tarjetas en el frontend -- texto explícito del ticket KAN-485.
- 2 bugs de permiso de Super Admin ya corregidos (ver Hallazgo 6 en
  technical-design.md) -- cualquier función nueva debe incluir
  `fn_es_super_admin()` desde el inicio.
