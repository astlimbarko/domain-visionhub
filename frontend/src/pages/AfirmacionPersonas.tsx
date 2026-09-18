// VisionHub -- plan panel Afirmación 2026-08-20, punto 3/4 (KAN-216).
// Tabla de Membresía de la iglesia completa (Supervisión/Pastor/Super
// Admin) -- selector de Red/Casa de Paz, KPIs "Por URL"/"Por formulario".
//
// KAN-386/389 seguimiento (2026-09-17, pedido explícito del owner): la UI
// real vive en MembresiaTabla (componente compartido de verdad, no una
// copia) -- esta página queda como wrapper fino que le pasa el modo "sin
// casaDePazId" (iglesia completa). El mismo componente, en modo scoped, es
// lo que usa MembresiaCdp.tsx para Líder/Sublíder de CdP -- un cambio
// visual acá se ve en las dos pantallas sin tocar 2 archivos.
import { useAuthStore } from '@/store/auth.store';
import { MembresiaTabla } from '@/components/personas/MembresiaTabla';

export function AfirmacionPersonas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const iglesiaNombre = useAuthStore((s) => s.iglesias.find((i) => i.id === iglesiaActivaId)?.nombre) ?? 'Centro de Vida';

  return <MembresiaTabla iglesiaId={iglesiaActivaId} iglesiaNombre={iglesiaNombre} />;
}
