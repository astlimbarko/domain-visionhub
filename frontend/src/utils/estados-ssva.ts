import { AZUL, VERDE, AMBAR, MORADO, TEAL, MARINO } from '@/components/dashboard/DashboardUI';

/**
 * Color por estado SSVA (tabla `estado`: SIM/NC/CRE/RE activos, DA/DI
 * sembrados inactivos para el Módulo 4) -- pedido explícito del owner
 * (2026-09-07) para la burbuja de avatar de "Personas evangelizadas". Elegido
 * por significado semántico con los tokens genéricos de `DashboardUI.tsx`
 * (no son hex sueltos): SIM recién contactado (ámbar, requiere seguimiento),
 * NC el logro que esta pantalla celebra (verde), CRE ya consolidado (azul),
 * RE un camino aparte (morado).
 */
export const ESTADO_SSVA_COLOR: Record<string, string> = {
  SIM: AMBAR,
  NC: VERDE,
  CRE: AZUL,
  RE: MORADO,
  DA: TEAL,
  DI: MARINO,
};

export const ESTADO_SSVA_NOMBRE: Record<string, string> = {
  SIM: 'Simpatizante',
  NC: 'Nuevo Convertido',
  CRE: 'Creyente',
  RE: 'Reconciliado',
  DA: 'Discípulo Activo',
  DI: 'Discípulo Inactivo',
};
