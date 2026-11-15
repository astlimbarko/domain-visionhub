# Gonzalo — 2026-11-15

- [x] Continué integración móvil en codex/frontend-adminlte-mui-real tras checkpoint 783c3eb. Vista aislada con Shadow DOM, estilos locales, datos/hooks oficiales y callback al menú original. Tipos y QA interceptado aprobados; lista para revisión local.
- [x] QA interceptado aprobado en móviles 320/390/767 px y temas claro/oscuro. Menú original y devolución de foco, reporte real y perfil conservados. Verifiqué CSS externo invasivo sin alterar estilos internos, variable de zoom local y vistas previas en 768/820/1440 px. Papeletas deshabilitada como pendiente, sin contador de muestra. Lint sin advertencias; comprobación final de tipos aprobada.

- [x] Finalicé el logo oscuro estable con la misma casita original, corrigiendo la superposición de letras dentro del Shadow DOM. El CSS del diseño está encapsulado; las reglas externas de encuadre solo se activan cuando el Inicio móvil aislado está montado. Compilación de tipos y lint aprobados. Rama experimental sin aprobación para publicar.
- [ ] Falta: revisión visual de Gonzalo con su cuenta en móvil y aprobación del primer tramo antes de continuar pantallas interiores.
