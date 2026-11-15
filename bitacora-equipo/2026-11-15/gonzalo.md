# Gonzalo â€” 2026-11-15

- [x] ContinuÃ© integraciÃ³n mÃ³vil en codex/frontend-adminlte-mui-real tras checkpoint 783c3eb. Vista aislada con Shadow DOM, estilos locales, datos/hooks oficiales y callback al menÃº original. Tipos y QA interceptado aprobados; lista para revisiÃ³n local.
- [x] QA interceptado aprobado en mÃ³viles 320/390/767 px y temas claro/oscuro. MenÃº original y devoluciÃ³n de foco, reporte real y perfil conservados. VerifiquÃ© CSS externo invasivo sin alterar estilos internos, variable de zoom local y vistas previas en 768/820/1440 px. Papeletas deshabilitada como pendiente, sin contador de muestra. Lint sin advertencias; comprobaciÃ³n final de tipos aprobada.

- [x] FinalicÃ© el logo oscuro estable con la misma casita original, corrigiendo la superposiciÃ³n de letras dentro del Shadow DOM. El CSS del diseÃ±o estÃ¡ encapsulado; las reglas externas de encuadre solo se activan cuando el Inicio mÃ³vil aislado estÃ¡ montado. CompilaciÃ³n de tipos y lint aprobados. Rama experimental sin aprobaciÃ³n para publicar.
- [ ] Falta: revisiÃ³n visual de Gonzalo con su cuenta en mÃ³vil y aprobaciÃ³n del primer tramo antes de continuar pantallas interiores.
- [x] MedÃ­ apertura del menÃº: base 240â€“280 ms de montaje mÃ¡s animaciÃ³n 260 ms. ProbÃ© precarga de contenido y la retirÃ© por mejora inconsistente. ConservÃ© Radix original, estabilicÃ© callback/contexto y navegaciÃ³n con memoizaciÃ³n, quitÃ© desenfoque del overlay del lÃ­der y acortÃ© entrada/salida a 180/140 ms. MediciÃ³n posterior: 180â€“250 ms de montaje, mejora moderada. Lint y tipos aprobados.
- [ ] Falta: aprobaciÃ³n de Gonzalo sobre la sensaciÃ³n de apertura del menÃº en su equipo. Ajustes locales pendientes de commit hasta esa revisiÃ³n.
- [x] QA interceptado del menÃº optimizado: clic interno no cierra el panel; foco permanece dentro con Tab; Escape/X/arrastre cierran; reapertura y devoluciÃ³n de foco correctas; sin bloqueo de interacciÃ³n al cerrar ni errores JS. Captura inspeccionada.
- [x] SustituÃ­ el selector doble del Inicio mÃ³vil por AppearanceToggle del sistema, con presentaciÃ³n HTML nativa para el Shadow DOM y estilos locales. Un solo icono luna/sol, mismo controlador de tema. VerifiquÃ© teclado, ambos modos, botÃ³n Ãºnico y sincronizaciÃ³n al entrar/salir del reporte; lint sin errores ni advertencias. Captura inspeccionada. Ajustes locales pendientes de revisiÃ³n.

- [x] Gonzalo aprobó el menú y tema móvil y autorizó preparar Front 2; guardé esos ajustes en 70d7338 y renombré la rama a codex/front-2.
- [x] Preparé base /v2/, recursos y redirecciones con prefijo, clave de estado de autenticación y borradores separados de V1, y guía local para Gonzalo, Matías y Daniel. Login existente de Supabase, sin lista de correos adicional.
- [x] Gonzalo aclaró que hoy no hay deploy: retiré la publicación FTP propuesta y dejé únicamente compilación en GitHub. No fusionar a master. El sitio oficial y Supabase no se modifican.
- [x] Tipos y compilación /v2/ completos en Docker. Advertencias no bloqueantes de CSS AdminLTE (@charset) y tamaño de chunks. Preparación lista para subir al remoto sin deploy.

- [x] QA de /v2/ con Supabase interceptado: login, selector de rol, móvil 320/390/767 px en ambos temas, aislamiento CSS, menú/foco, reporte y perfil; tablet/escritorio 768/820/1440 px conservados. Estado persistido V2 separado. Lint: 0 errores y 22 advertencias existentes de Fast Refresh.
- [x] Guardé y subí codex/v2-host-routing en 9e8324e solo como preparación futura. Sin PR, merge ni deploy.

- [x] Subí codex/front-2 al remoto en 2d113f6, con guía harness/FRONT-2.md y workflow de validación sin deploy. Confirmé master remoto sin cambios en 43bdb2e.
- [x] Verifiqué fallo de Actions 43680554399: GitHub no inició ningún paso por bloqueo de facturación de la cuenta; no es fallo de compilación. Build y QA locales aprobados.
- [ ] Falta para usar CI: resolver facturación de GitHub y reintentar validación. Para seguir el diseño en local no bloquea. Matías continuará pantallas internas y adaptación tablet/PC.
