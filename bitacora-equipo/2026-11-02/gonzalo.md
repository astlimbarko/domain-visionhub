# Gonzalo — 2026-11-02

- [x] Separé Inicio del Dashboard del líder con portada real; Dashboard conserva indicadores y cálculos originales. Colaborar integrado al menú; soporte retirado solo del líder. Barra lateral PC oscura con iconos blancos en ambos temas. Menú móvil con un solo scroll y acciones de cuenta al final.
- [x] Verifiqué con respuestas interceptadas PC/tablet/móvil claro/oscuro: Inicio sin indicadores, entrada independiente a Dashboard y vuelta a Inicio; Colaborar visible, soporte ausente, Mi cuenta fuera del menú móvil, acciones finales alcanzables con un solo scroll y sidebar PC oscuro. Sin overflow ni errores JS; lint sin errores. No se escribieron datos reales.

- [x] Corregí iconos de Inicio/Colaborar sobre fondo claro y oculté el control flotante mientras está abierto el menú para no tapar opciones.
- [ ] Siguiente paso: Gonzalo revisa esta organización en 5178; luego adaptar tarjetas/gráficos del Dashboard, manteniendo cálculos, por etapas.

- [x] Revisión TypeScript completa aprobada; capturas finales inspeccionadas y verificaciones de navegación repetidas después de los ajustes de contraste.

- [x] Moví el control claro/oscuro arriba a la derecha y retiré todas sus etiquetas, incluida Acciones reales. Reservé espacio en la cabecera del líder para que no tape las acciones. Sin cambios en permisos ni transporte.

- [x] Verifiqué en Chrome móvil el control arriba (menos de 60px desde el borde), ausencia de Acciones reales y alternancia de ambos temas. Lint sin errores/avisos.

- [x] Guardé un punto de retorno solicitado por Gonzalo antes de rediseñar los cuatro accesos de Inicio. Frontend sin cambios; propuesta: botones amplios en cuadrícula 2 por 2.

- [x] Reemplacé los accesos de Inicio por cuatro tarjetas grandes 2×2: Reporte de casa de paz (formulario oficial), Asistencia (pantalla existente), Evangelismo y Boletas deshabilitada con Próximamente. Eliminados Historial y Calendario de estos accesos, sin borrar sus secciones del menú. Conservado contexto de CdP en navegación.

- [x] Verificación con respuestas interceptadas: cuatro tarjetas 2×2, altura mínima 150px, sin overflow en PC/tablet/móvil claro/oscuro; tres enlaces oficiales, Boletas deshabilitada y navegación a /reportes comprobada. Lint sin errores y sin errores JS. Siguiente paso: Gonzalo revisa los cuatro accesos en Inicio.
