import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DEPARTAMENTO_META } from '@/utils/departamentos';

interface Props {
  titulo?: string;
  subtitulo?: string;
  accion?: ReactNode;
}

/**
 * Banner "hero" de Evangelismo -- extraído de `EvangelismoSupervisorVista.tsx`
 * (2026-09-06) para reusarlo también en "Personas evangelizadas" (pedido
 * explícito del owner: mismo banner en más de una pantalla del departamento).
 * Mismo tratamiento visual exacto: plano (`rounded-none`, el mockup del
 * owner no tiene ningún radio), edge-to-edge (márgenes negativos cancelan el
 * padding de `<main>` en AppShell.tsx SOLO acá, no el layout global), imagen
 * con fade-in (evita el "salto" color-sólido → imagen), alto +10% en desktop.
 */
export function EvangelismoBanner({ titulo = 'Evangelismo', subtitulo = 'Gestioná las metas y el seguimiento mensual', accion }: Props) {
  const [bannerCargado, setBannerCargado] = useState(false);

  return (
    <div
      className="relative -mx-5 -mt-5 overflow-hidden rounded-none p-6 text-white shadow-xl shadow-[var(--brand-navy)]/25 sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-[38px]"
      style={{ backgroundColor: DEPARTAMENTO_META.EVANGELISMO.color }}
    >
      <img
        src="/evangelismo-banner.png"
        alt=""
        onLoad={() => setBannerCargado(true)}
        className={cn(
          'pointer-events-none absolute inset-0 h-full w-full object-cover object-left transition-opacity duration-500',
          bannerCargado ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img src="/icono-evangelismo.svg" alt="" className="h-14 w-14 shrink-0 rounded-full shadow-lg shadow-black/25" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
            <p className="text-[13px] text-white/70">{subtitulo}</p>
          </div>
        </div>
        {accion}
      </div>
    </div>
  );
}
