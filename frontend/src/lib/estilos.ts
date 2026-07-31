/**
 * Estilos compartidos que son "estándar de proyecto" pero no encajan como
 * componente propio (son solo un className reutilizable). Ver
 * `frontend/.claude/skills/frontend-style/SKILL.md` para el catálogo
 * completo de piezas visuales.
 */

// Hover azul de formularios: más contraste que el <Input>/<SelectTrigger> por
// defecto, con un resplandor al pasar el mouse/enfocar. Nació en el módulo de
// Afirmación (14-afirmacion) y quedó consolidado como el estándar de todos los
// formularios de captura de datos del proyecto (15-gestion-administrativa,
// REQ-UI-2). Usa los tokens de tema (--ring) para respetar claro/oscuro sin
// colores fijos.
export const CAMPO_ESTILO =
  'h-10 border-2 border-border/70 transition-shadow duration-200 hover:border-ring/50 ' +
  'hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-ring)_18%,transparent)] ' +
  'focus-visible:border-ring/70 focus-visible:ring-0 ' +
  'focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-ring)_28%,transparent)]';
