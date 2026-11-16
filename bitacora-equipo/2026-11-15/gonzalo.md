# Gonzalo — 2026-11-15

- [x] Continué integración móvil en codex/frontend-adminlte-mui-real tras checkpoint 783c3eb. Vista aislada con Shadow DOM, estilos locales, datos/hooks oficiales y callback al menú original. Tipos y QA interceptado aprobados; lista para revisión local.
- [x] QA interceptado aprobado en móviles 320/390/767 px y temas claro/oscuro. Menú original y devolución de foco, reporte real y perfil conservados. Verifiqué CSS externo invasivo sin alterar estilos internos, variable de zoom local y vistas previas en 768/820/1440 px. Papeletas deshabilitada como pendiente, sin contador de muestra. Lint sin advertencias; comprobación final de tipos aprobada.

- [x] Finalicé el logo oscuro estable con la misma casita original, corrigiendo la superposición de letras dentro del Shadow DOM. El CSS del diseño está encapsulado; las reglas externas de encuadre solo se activan cuando el Inicio móvil aislado está montado. Compilación de tipos y lint aprobados. Rama experimental sin aprobación para publicar.
- [ ] Falta: revisión visual de Gonzalo con su cuenta en móvil y aprobación del primer tramo antes de continuar pantallas interiores.
- [x] Medí apertura del menú: base 240–280 ms de montaje más animación 260 ms. Probé precarga de contenido y la retiré por mejora inconsistente. Conservé Radix original, estabilicé callback/contexto y navegación con memoización, quité desenfoque del overlay del líder y acorté entrada/salida a 180/140 ms. Medición posterior: 180–250 ms de montaje, mejora moderada. Lint y tipos aprobados.
- [ ] Falta: aprobación de Gonzalo sobre la sensación de apertura del menú en su equipo. Ajustes locales pendientes de commit hasta esa revisión.
- [x] QA interceptado del menú optimizado: clic interno no cierra el panel; foco permanece dentro con Tab; Escape/X/arrastre cierran; reapertura y devolución de foco correctas; sin bloqueo de interacción al cerrar ni errores JS. Captura inspeccionada.
- [x] Sustituí el selector doble del Inicio móvil por AppearanceToggle del sistema, con presentación HTML nativa para el Shadow DOM y estilos locales. Un solo icono luna/sol, mismo controlador de tema. Verifiqué teclado, ambos modos, botón único y sincronización al entrar/salir del reporte; lint sin errores ni advertencias. Captura inspeccionada. Ajustes locales pendientes de revisión.

- [x] Gonzalo aprobó el menú y tema móvil y autorizó preparar Front 2; guardé esos ajustes en 70d7338 y renombré la rama a codex/front-2.
- [x] Preparé base /v2/, recursos y redirecciones con prefijo, clave de estado de autenticación y borradores separados de V1, y guía local para Gonzalo, Matías y Daniel. Login existente de Supabase, sin lista de correos adicional.
- [x] Gonzalo aclaró que hoy no hay deploy: retiré la publicación FTP propuesta y dejé únicamente compilación en GitHub. No fusionar a master. El sitio oficial y Supabase no se modifican.
- [x] Tipos y compilación /v2/ completos en Docker. Advertencias no bloqueantes de CSS AdminLTE (@charset) y tamaño de chunks. Preparación lista para subir al remoto sin deploy.

- [x] QA de /v2/ con Supabase interceptado: login, selector de rol, móvil 320/390/767 px en ambos temas, aislamiento CSS, menú/foco, reporte y perfil; tablet/escritorio 768/820/1440 px conservados. Estado persistido V2 separado. Lint: 0 errores y 22 advertencias existentes de Fast Refresh.
- [x] Guardé y subí codex/v2-host-routing en 9e8324e solo como preparación futura. Sin PR, merge ni deploy.

- [x] Subí codex/front-2 al remoto en 2d113f6, con guía harness/FRONT-2.md y workflow de validación sin deploy. Confirmé master remoto sin cambios en 43bdb2e.
- [x] Verifiqué fallo de Actions 43680554399: GitHub no inició ningún paso por bloqueo de facturación de la cuenta; no es fallo de compilación. Build y QA locales aprobados.
- [ ] Falta para usar CI: resolver facturación de GitHub y reintentar validación. Para seguir el diseño en local no bloquea. Matías continuará pantallas internas y adaptación tablet/PC.

- [x] Documenté el acuerdo de migración: reutilizar lógica real, base AdminLTE + MUI, CSS móvil/tablet aislado sin nuevas variables globales, prioridad móvil/tablet/PC, Matías a cargo de Líder de Casa de Paz y luego avanzar por roles. Añadí referencia obligatoria en AGENTS.md para las sesiones de Codex y normalicé UTF-8 de la guía y bitácora. Solo documentación, sin deploy.
