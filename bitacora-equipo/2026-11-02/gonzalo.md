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

- [x] Centré iconos y textos en las cuatro tarjetas con espacios de título iguales; Próximamente queda fuera del flujo para no desplazar Boletas. Ajusté altura/iconos en móvil y tablet de poca altura para dar espacio a la segunda fila sobre la barra inferior.

- [x] Medí centros horizontales de los cuatro iconos y alineación vertical por fila en PC/tablet/móvil y 490×650, en claro/oscuro; sin desbordamiento horizontal ni errores JS. Capturas tomadas; enlaces originales conservados.

- [x] Ajusté también el espaciado del hero en ventanas bajas para dar más espacio vertical a las cuatro tarjetas, sin cambiar sus datos.

- [x] Menú del líder en móvil/tablet a pantalla completa sin espacio superior; tirador de 48px con gesto hacia abajo (umbral 80px), seguimiento visual del arrastre, cancelación/restauración para gestos cortos y conservación del cierre X. Scroll de opciones independiente del tirador.

- [x] Verifiqué en Chrome con red interceptada móvil 390×844 y tablet 820×1180, claro/oscuro: panel en x=0/y=0 y tamaño exacto del viewport; arrastre corto no cierra, largo hacia abajo cierra y X sigue funcional. Sin errores JS; lint aprobado. Sin cambios en backend/datos/permisos. Siguiente paso: Gonzalo prueba el gesto en su móvil.

- [x] Revisé el origen de red_color: consulta oficial usa la relación vigente casa_de_paz_red→red.color y el hero aplica ese valor directamente. Detecté que la capa blanca del avatar podía bajar contraste de iniciales (ejemplo #557755: 5.05:1 en hero pero 3.67:1 en avatar); eliminé esa capa y añadí margen al umbral para evitar redondeo del contraste MUI.

- [x] Capturé y medí el hero con datos interceptados: cinco colores (verde, verde oscuro, amarillo, blanco, gris) en light/dark; fondo renderizado idéntico al hex recibido. Tras corrección, volví a medir textos, iconos e iniciales con #009B77, #557755 y #777777 en ambos temas: mínimos 5.95:1, 5.05:1 y 4.69:1. Capturas inspeccionadas y lint aprobado. No se verificó una cuenta real ni se modificaron colores de redes en Supabase.

- [x] Alineé X dentro de la misma fila del nombre de iglesia, botón 44×44 y cabecera compacta próxima al tirador. Definí animación explícita del menú desde abajo (260ms entrada/180ms salida) sin animar layout; respeta reducción de movimiento. Mantiene cierre por arrastre y Escape.

- [x] Medí alineación vertical X/título (diferencia menor a 2px) y animé en Chrome: animationName cdp-menu-enter, duración 0.26s; móvil/tablet ambos temas mantienen viewport completo, gesto corto/largo y X funcionales, sin errores JS. Capturas finales inspeccionadas; lint sin errores.

- [x] Retiré las utilidades de padding heredadas de Bootstrap en la cabecera del líder que aún conservaban espacio extra; espaciado aplicado a la fila interior para acercarla al tirador.

- [x] Medición final de cabecera compacta: título inicia antes de 65px desde arriba; X alineada (<2px), animación verificada en ambos temas y gestos/X correctos. Eliminada también la utilidad gap-4 heredada entre tirador y contenido.

- [x] Retiré Inicio del menú desplegable móvil/tablet del líder para evitar duplicarlo. Se conservan Inicio en la barra inferior y en el sidebar de PC, y Dashboard como opción independiente. Sin cambios en rutas ni permisos.

- [x] Guardé checkpoint solicitado por Gonzalo antes de cambiar el hero móvil a borde completo y sin esquinas redondeadas.
