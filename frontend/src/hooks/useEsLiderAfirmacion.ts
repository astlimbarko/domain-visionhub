/**
 * Capacidad ortogonal al RolUI: si la persona tiene una asignacion vigente
 * de Lider de Afirmacion en la iglesia activa (departamento_cargo). No
 * reemplaza ni interfiere con useRolUI -- alguien puede ser LIDER_CDP y
 * ademas Lider de Afirmacion a la vez.
 *
 * KAN-339 (2026-09-10, bug real en vivo): tambien true con el contexto
 * SINTETICO de "Visualizar" (Super Admin, modo lectura) -- sin esto, un
 * Super Admin real (sin cargo de Afirmacion en ningun lado) entraba en un
 * loop infinito: RutaAfirmacion lo rebotaba a /dashboard por no tener la
 * capacidad real, y el guard de PrivateLayout lo rebotaba de vuelta a
 * /afirmacion porque su contexto sintetico solo tiene acceso ahi -- las 2
 * rutas se pisaban sin parar (el "parpadea y nunca se mira nada" reportado).
 * Evangelismo no tenia este problema porque esa ruta se protege por RolUI
 * (RequiereRol), que ya reconoce 'LIDER_DEPARTAMENTO' del contexto sintetico
 * sin necesitar este chequeo aparte.
 */
import { useAuthStore } from '@/store/auth.store';
import { useContextoActivo } from '@/hooks/useContextoActivo';

export function useEsLiderAfirmacion(): boolean {
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const { contextoActivo } = useContextoActivo();
  if (contextoActivo?.rolUI === 'LIDER_DEPARTAMENTO' && contextoActivo.departamentoCodigo === 'AFIRMACION') {
    return true;
  }
  return iglesias.find((i) => i.id === iglesiaActivaId)?.es_lider_afirmacion ?? false;
}
