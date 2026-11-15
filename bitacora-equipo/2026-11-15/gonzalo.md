# Gonzalo — 2026-11-15

- [x] Continué integración móvil en codex/frontend-adminlte-mui-real tras checkpoint 783c3eb. Vista aislada con Shadow DOM, estilos locales, datos/hooks oficiales y callback al menú original. Tipos y QA interceptado aprobados; lista para revisión local.
- [x] QA interceptado aprobado en móviles 320/390/767 px y temas claro/oscuro. Menú original y devolución de foco, reporte real y perfil conservados. Verifiqué CSS externo invasivo sin alterar estilos internos, variable de zoom local y vistas previas en 768/820/1440 px. Papeletas deshabilitada como pendiente, sin contador de muestra. Lint sin advertencias; comprobación final de tipos aprobada.

- [x] Finalicé el logo oscuro estable con la misma casita original, corrigiendo la superposición de letras dentro del Shadow DOM. El CSS del diseño está encapsulado; las reglas externas de encuadre solo se activan cuando el Inicio móvil aislado está montado. Compilación de tipos y lint aprobados. Rama experimental sin aprobación para publicar.
- [ ] Falta: revisión visual de Gonzalo con su cuenta en móvil y aprobación del primer tramo antes de continuar pantallas interiores.
- [x] Medí apertura del menú: base 240–280 ms de montaje más animación 260 ms. Probé precarga de contenido y la retiré por mejora inconsistente. Conservé Radix original, estabilicé callback/contexto y navegación con memoización, quité desenfoque del overlay del líder y acorté entrada/salida a 180/140 ms. Medición posterior: 180–250 ms de montaje, mejora moderada. Lint y tipos aprobados.
- [ ] Falta: aprobación de Gonzalo sobre la sensación de apertura del menú en su equipo. Ajustes locales pendientes de commit hasta esa revisión.
- [x] QA interceptado del menú optimizado: clic interno no cierra el panel; foco permanece dentro con Tab; Escape/X/arrastre cierran; reapertura y devolución de foco correctas; sin bloqueo de interacción al cerrar ni errores JS. Captura inspeccionada.
- [x] Sustituí el selector doble del Inicio móvil por AppearanceToggle del sistema, con presentación HTML nativa para el Shadow DOM y estilos locales. Un solo icono luna/sol, mismo controlador de tema. Verifiqué teclado, ambos modos, botón único y sincronización al entrar/salir del reporte; lint sin errores ni advertencias. Captura inspeccionada. Ajustes locales pendientes de revisión.

- [x] Gonzalo aprob� el men� y tema m�vil y autoriz� preparar Front 2; guard� esos ajustes en 70d7338 y renombr� la rama a codex/front-2.
- [x] Prepar� base /v2/, recursos y redirecciones con prefijo, clave de estado de autenticaci�n y borradores separados de V1, y gu�a local para Gonzalo, Mat�as y Daniel. Login existente de Supabase, sin lista de correos adicional.
- [x] Gonzalo aclar� que hoy no hay deploy: retir� la publicaci�n FTP propuesta y dej� �nicamente compilaci�n en GitHub. No fusionar a master. El sitio oficial y Supabase no se modifican.
- [x] Tipos y compilaci�n /v2/ completos en Docker. Advertencias no bloqueantes de CSS AdminLTE (@charset) y tama�o de chunks. Preparaci�n lista para subir al remoto sin deploy.

- [x] QA de /v2/ con Supabase interceptado: login, selector de rol, m�vil 320/390/767 px en ambos temas, aislamiento CSS, men�/foco, reporte y perfil; tablet/escritorio 768/820/1440 px conservados. Estado persistido V2 separado. Lint: 0 errores y 22 advertencias existentes de Fast Refresh.
- [x] Guard� y sub� codex/v2-host-routing en 9e8324e solo como preparaci�n futura. Sin PR, merge ni deploy.
