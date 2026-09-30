# Preguntas abiertas — Portal intermedio de Colaborar

Decisiones menores que quedan por cerrar. Ninguna bloquea empezar el portal
(el flujo grande ya está definido con el owner).

## Navegación / estructura

1. Con un **solo departamento** (Afirmación) hoy, el owner pidió mantener
   igual los 2 niveles (tarjeta departamento → colaboraciones). Confirmar
   que NO se saltea el nivel 1 aunque haya un solo departamento (así ya
   queda listo para cuando entren más). Asumido: se muestra igual.
2. Pantallas de proceso no construidas (Bautismo/RSIL/Membresía): asumido
   que se muestran como tarjeta **"Próximamente"** deshabilitada hasta que
   Matías las termine, y solo Altar está operativa. Confirmar que está bien
   mostrar las 4 tarjetas desde ya (3 en "Próximamente") en vez de mostrar
   solo Altar.

## Historial / "solo lo mío"

3. **Trazabilidad**: hoy cada registro guarda `creado_por` +
   `fecha_creacion`, y `colaborador_sesion` liga usuario↔código. ¿Alcanza
   con eso para saber "con qué código se registró", o hace falta guardar
   explícitamente el `colaborador_codigo_id`/`sesion_id` en cada registro
   de proceso? (El owner no lo priorizó -- se puede dejar como está y
   agregarlo después si hace falta un reporte por código.)
4. El "Mi historial" global que hoy tiene Colaborar -- ¿desaparece a favor
   del historial por colaboración (la pestaña Datos de cada proceso, que ya
   muestra solo lo del colaborador), o se mantiene además un resumen global
   en el portal?

## Confirmado, no requiere pregunta (documentado para no repreguntar)

- 4 colaboraciones: **Altar, Bautismo, RSIL, Membresía**. Fiesta de
  Bienvenida queda fuera de Colaborar por ahora.
- El código habilita **todas** las colaboraciones (sin granularidad por
  tarea).
- Portal de **2 niveles** (Departamento → Colaboración), pensado para
  futuros departamentos.
- **Bautismo y RSIL** son colaboraciones separadas e independientes.
  Bautismo y Membresía también separadas, pero van juntas en la práctica.
- La colaboración **"Membresía"** = membresía paralela liviana (harness
  21), NO la membresía por link actual (que no se toca).
- Cada colaboración abre su **pantalla de proceso** (Altar ya existe) con
  botón **"Volver al portal"**.
- El colaborador ve en los listados **solo lo que él registró** (ya
  resuelto en Altar por `fn_afirmacion_historial_proceso`).
- **Cualquier rol** puede colaborar con un código válido; la vigencia
  temporal se respeta; los datos sobreviven al vencimiento.
