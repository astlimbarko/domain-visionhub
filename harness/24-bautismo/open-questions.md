# Preguntas abiertas — Bautismo

## Bloquean el botón "Llenar membresía" (Req 5)

1. **Precarga de persona EXISTENTE en la Membresía (Nuevos)**: el botón
   abre la Membresía (Nuevos) para la persona recién bautizada, que en el
   99% de los casos **ya existe** en el sistema. Hoy la pantalla Membresía
   (Nuevos) arranca en blanco (crea gente nueva). Falta definir con el
   owner: ¿el botón abre la membresía **editando/completando** la de esa
   persona existente (precargando sus datos), o solo "crea" y la persona
   existente se vincula? Esto es trabajo de harness/21 (Requisito 1:
   "persona existente: precargar y verificar"), pero el botón de Bautismo
   lo necesita. Hasta cerrarlo, el botón navega a la ruta con el
   `persona_id` y queda un `// TODO`.

## Diseño

2. **Color suave de Bautismo**: confirmar el tono exacto (sugerido
   `#30b0c7` celeste-agua). Parte del molde visual único que el owner
   quiere para Altar/Bautismo/RSIL (colores suaves que diferencien cada
   proceso).
3. **Orden del rediseño**: el owner dijo que a Altar "no le gusta cómo
   luce" y queda en revisión para rediseñarse con un molde común sin
   scroll. ¿Bautismo se hace YA como está Altar hoy (y después se
   rediseñan los tres juntos), o se espera el molde nuevo? Asumido: se
   hace como Altar hoy (clon) y el rediseño unificado es un paso
   posterior.

## Registro

4. **Re-bautismo**: el owner confirmó historial de varias fechas (no se
   bloquea re-registrar). Confirmar que no hace falta ninguna advertencia
   del tipo "esta persona ya tiene un bautismo registrado".

## Confirmado, no requiere pregunta

- Bautismo = clon de Altar (Buscar/Nuevo/Datos, mismo backend genérico,
  mismo form de alta liviano, pestaña Datos con "solo lo mío" para
  colaborador).
- Historial de varias fechas; el estado acumulado nunca vuelve a "no".
- El bautismo NO cambia el estado SSVA.
- Botón "Llenar membresía" es OPCIONAL (se puede hacer después).
- Se agrega BAUTISMO al enum de procesos.
- Se enchufa en la tarjeta "Bautismo" del portal de Colaborar.
- Lo hace Gonzalo (no Matías).
