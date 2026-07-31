# 15 — Gestión administrativa — open-questions.md

> Decisiones. Las 4 grandes ya se cerraron con el owner el 2026-07-30 (marcadas
> ✅ RESUELTA). Quedan sub-preguntas menores que no bloquean documentar pero sí
> conviene cerrar antes de implementar el panel correspondiente.

## Decisiones cerradas (2026-07-30)

- ✅ **RESUELTA — Iglesia satélite.** Modelar el tipo **completo pero de forma no
  destructiva**: columna aditiva `iglesia.tipo` con `DEFAULT 'HIJA'`. Comportamiento
  hoy idéntico a hija (solo visual); diferenciación futura se apoya encima.
- ✅ **RESUELTA — Nombres de departamento.** UI en **verbos**
  (Evangelizar/Afirmar/Discipular/Enviar); códigos internos intactos. Colores:
  Evangelizar=Amarillo, Afirmar=Azul, Discipular=Rojo, Enviar=Gris.
- ✅ **RESUELTA — Crear iglesias hijas.** Permitido a **Super-Admin y Pastor** de
  la iglesia madre (se amplía `fn_crear_iglesia`).
- ✅ **RESUELTA — Supervisor de Red de la Visión en Acción.** Se **incluye como
  rol nuevo** (`ALTER TYPE rol_sistema_enum ADD VALUE`).
- ✅ **RESUELTA — Confirmación sensible.** Reemplazar el **PIN estático por OTP por
  correo** (código de un solo uso). No hay plantilla aún; se implementa (Edge
  Function + HTML propio).

## Sub-preguntas abiertas (cerrar antes del panel que las usa)

- **OQ-OTP-TTL** — ¿Cuánto dura el OTP antes de expirar? Propuesta: **10 minutos**,
  un solo uso. (Panel 1)
- **OQ-OTP-PIN** — ¿Se elimina la tabla `usuario_pin` o se deja deprecada tras
  migrar al OTP? Propuesta: dejarla deprecada y dropear en una migración
  posterior una vez validado el OTP en vivo. (Panel 1)
- **OQ-OTP-ALCANCE** — ¿El OTP aplica solo al Super-Admin (como el PIN hoy) o
  también al Pastor/Supervisor en sus acciones sensibles nuevas? Propuesta:
  **a todos** en acciones destructivas/estructurales, uniforme. (Panel 1/2)
- **OQ-SR** — **Alcance funcional del Supervisor de Red.** ¿Qué ve y qué puede
  hacer exactamente? ¿Supervisa una Red o varias? ¿Solo consulta o también
  gestiona líderes de CdP dentro de su(s) Red(es)? Propuesta base: supervisa
  una o más Redes, sin capacidades del Supervisor de la Visión en Acción (no
  departamentos, no finanzas globales). **Bloquea el Panel 5.** (Panel 5)
- **OQ-SAT-DIFF** — Cuando llegue la diferenciación real hija vs. satélite, ¿qué
  cambia de comportamiento? Fuera de alcance ahora; el modelo queda listo.
- **OQ-SUP-SELF** — Confirmar la lista exacta de auto-protecciones a exponer en
  UI (no auto-eliminarse, no auto-modificar cargo, Pastor no removible por
  Supervisor) — el backend ya cubre la mayoría; validar que la UI no muestre
  botones que el backend rechaza. (Paneles 2–4)
- **OQ-SOPORTE** — Texto exacto del cuerpo prellenado del correo de soporte
  (¿qué contexto incluir: rol, iglesia, ruta, versión de build?). Propuesta:
  incluir rol + iglesia activa + ruta actual. (Panel 0)
- **OQ-MIGR-NUM** — Confirmar los números de migración libres al momento de
  implementar (Matías puede haber agregado archivos SQL nuevos). Ajustar 55+.
