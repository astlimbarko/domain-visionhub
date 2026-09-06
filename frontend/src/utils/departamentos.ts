/**
 * Paleta institucional de Departamentos (verbo + color), centralizada en un
 * único lugar por pedido explícito del sistema de diseño (frontend-style
 * SKILL.md, "Colores institucionales de Departamento") -- no hardcodear
 * estos hex sueltos por archivo.
 */
export const DEPARTAMENTO_META: Record<string, { verbo: string; color: string }> = {
  EVANGELISMO: { verbo: 'Evangelizar', color: '#F5C518' },
  AFIRMACION: { verbo: 'Afirmar', color: '#0071E3' },
  DISCIPULADO: { verbo: 'Discipular', color: '#FF3B30' },
  ENVIO: { verbo: 'Enviar', color: '#8E8E93' },
};

/** Departamentos con gestión funcional (2026-08-01 solo Afirmación; KAN-281
 * suma Evangelismo reutilizando el panel del Supervisor) -- Discipulado y
 * Envío siguen sin invitación por correo armada. */
export const DEPARTAMENTOS_FUNCIONALES: string[] = ['AFIRMACION', 'EVANGELISMO'];
