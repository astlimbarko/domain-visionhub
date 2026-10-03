import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EVANGELISTA_COLOR } from '@/utils/evangelista-colores';

interface Props {
  nombre: string;
  racha: number;
  accion?: ReactNode;
}

/**
 * Banner "hero" del panel personal de Evangelista (KAN-428/429, boceto
 * `evangelismo1.jpeg`). Mismo molde que `EvangelismoBanner.tsx` (edge-to-edge
 * con márgenes negativos que cancelan el padding de `<main>` en
 * `AppShell.tsx`, imagen con fade-in), pero con la paleta/foto propia de UI
 * v2 (naranja/rojo) y el badge de racha con el ícono de fuego -- no se
 * reusa el banner azul del módulo de Evangelismo de CdP, son conceptos
 * distintos (ver Glosario de requirements.md).
 */
export function EvangelistaBanner({ nombre, racha, accion }: Props) {
  const [bannerCargado, setBannerCargado] = useState(false);

  return (
    <div
      className="relative -mx-5 -mt-5 overflow-hidden rounded-none p-6 text-white shadow-xl shadow-[#D9480F]/25 sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-[38px]"
      style={{ backgroundColor: EVANGELISTA_COLOR.NARANJA }}
    >
      <img
        src="/evangelista-personal-banner.jpg"
        alt=""
        onLoad={() => setBannerCargado(true)}
        // object-left: el boceto no pide mostrar el 100% del ancho de la
        // foto (aclaración explícita del owner, 2026-09-30) -- se recorta
        // el lado derecho, igual criterio que EvangelismoBanner.
        className={cn(
          'pointer-events-none absolute inset-0 h-full w-full object-cover object-left transition-opacity duration-500',
          bannerCargado ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Evangelismo</h1>
            <p className="truncate text-[13px] text-white/80">{nombre}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
            <img src="/icono-fuego-racha.svg" alt="" className="h-5 w-5" />
            <span className="text-sm font-bold whitespace-nowrap">{racha} {racha === 1 ? 'día' : 'días'}</span>
          </div>
        </div>
        {accion}
      </div>
    </div>
  );
}
