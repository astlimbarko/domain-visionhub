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

- [x] Hero de Inicio del líder sin esquinas ni márgenes exteriores en móvil/tablet, pegado a cabecera y bordes del contenido. Accesos conservan margen. En PC hero contenido en el área principal con radio discreto de 12px. No cambia datos ni color de red.

- [x] Quité la reserva forzada de scrollbar solo en Inicio del líder; conserva desplazamiento cuando el contenido lo necesita, sin banda lateral artificial.

- [x] QA interceptado PC/tablet/móvil claro/oscuro: hero en x=0, pegado a cabecera (y=65px), sin radio y con ancho idéntico a cabecera; sin overflow ni errores JS. Comprobación final móvil tras quitar gutter: hero y cabecera de 390px exactos. Siguiente paso: Gonzalo revisa este hero antes de continuar estética de PC.

- [x] Cambié únicamente el botón inferior derecho del líder: Reportar → Calendario, con icono y ruta oficiales y estado activo correspondiente. El acceso Reporte de casa de paz de Inicio permanece intacto.

- [x] Adapté la portada del líder al modelo: ondas SVG delimitando hero, insignia de red, separación del perfil, título Accesos rápidos, iconos y tarjetas con colores por sección, barra inferior con menú circular morado. Color de red conserva fondo sólido sin degradados/velos, por confirmación explícita de Gonzalo; foto y hooks oficiales sin sustituir.
- [x] Reutilicé campana real NotificacionesBell y añadí selector de tema adyacente en las cabeceras del líder; control flotante oculto para evitar duplicación. Otros roles y login conservan su control.
- [x] Capturas PC/tablet/móvil y 320px en ambos temas; sin overflow horizontal ni errores JS. Campana abre notificaciones oficiales interceptadas; tema adyacente y sin botón duplicado; menú completo conserva cierre. Fondo del hero coincide con red_color, background-image:none y filter:none. Lint y TypeScript completo aprobados.

- [x] Verifiqué la foto con descarga Storage interceptada: el servicio original devuelve blob URL, la imagen carga y conserva enlace a Mi cuenta; no se sustituyeron fotos de usuarios. Capturas de diseño usan datos de prueba y fallback de iniciales. No fueron necesarias imágenes IA: ondas SVG e iconos existentes permiten adaptar la referencia sin assets pesados.
- [ ] Siguiente paso: Gonzalo revisa la portada en su cuenta real en 5178; luego continuar con la apariencia AdminLTE del reporte sin perder sus campos ni validaciones.

- [x] Añadí degradado derivado del color real de red, con contraste del texto validado en cada tono y onda inferior del mismo color. Portada con altura disponible y tarjetas 2×2 flexibles; compresión progresiva en ventanas bajas sin ocultar contenido. Mantiene scroll accesible solo en alturas extremas menores a 540px.

- [x] QA interceptado en claro/oscuro: sin scroll horizontal ni vertical en 390×844, 320×740, 390×650, 360×600, tablet 820×1180 y PC 1440×1000. Tarjetas quedan sobre la barra inferior y comprobé que cada icono/título/etiqueta cabe dentro de su tarjeta en tamaños ajustados. Campana, tema, menú y perfil siguen funcionando; lint sin errores. Siguiente paso: Gonzalo verifica el ajuste en su móvil.

- [x] Checkpoint solicitado por Gonzalo antes de refinar ondas SVG y simplificar la estética de portada.

- [x] Rehice ondas SVG con curvas Bézier continuas; la franja y el borde inferior comparten exactamente el mismo trazado desplazado para evitar superposiciones irregulares. No se usan texturas ni filtros sobre datos/foto. Suavicé tipografía y sombras, tarjetas con acento discreto en esquina, flechas solo en enlaces funcionales e Inicio de contorno con indicador inferior. PC usa hero horizontal más bajo con horario a la derecha.

- [x] QA final con capturas interceptadas PC/tablet/móvil y 600px de alto, ambos temas: sin scroll ni errores JS; Inicio tiene fill:none, flechas solo en tres enlaces, Boletas sin flecha, campana/tema/perfil/menú preservados. Capturas inspeccionadas y lint aprobado. SVG de curvas reconstruidas y estilos exclusivos de la rama de prueba. Siguiente paso: Gonzalo revisa la nueva portada y compara móvil y PC antes de continuar.

- [x] Guardé checkpoint solicitado para conservar la variante de botones con acentos de color. Revisión visual y consideraciones sin cambiar el diseño.

- [x] Primera prueba de apariencia del reporte real: tarjetas y títulos sobrios, iconos de contorno, bordes finos, sombras suaves y espaciado compacto. Agregué solo envoltorio visual de cabeceras y clases de sección; preservé props, campos, validaciones y handlers. Estilos acotados al contexto líder.

- [x] Verifiqué reporte con red interceptada en PC/tablet/móvil claro/oscuro: cabeceras Información general, Asistencia, Finanzas y Testimonios, fecha, textarea y acción Enviar presentes; sin overflow ni errores JS. Prueba adicional con Evangelismo habilitado y variantes sin enviar reportes. Lint aprobado; diff confirma solo presentación, sin cambios en schemas, hooks ni handlers.
- [ ] Siguiente paso: Gonzalo revisa el estilo del reporte y luego decidir adaptación de los campos con etiqueta flotante manteniendo validaciones.
