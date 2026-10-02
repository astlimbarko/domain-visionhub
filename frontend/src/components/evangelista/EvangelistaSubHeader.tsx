import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { EVANGELISTA_GRADIENTE_HERO } from '@/utils/evangelista-colores';
import { ROUTES } from '@/utils/constants';

interface Props {
  titulo: string;
  volverA?: string;
  accion?: ReactNode;
}

/**
 * Header liviano de las sub-pantallas de Evangelista (Nueva persona,
 * Historial, Seguimiento -- bocetos `evangelismo2/3.jpeg`): degradado propio
 * sin la foto del banner principal (ese queda solo para el dashboard,
 * `EvangelistaBanner`), con flecha de volver + eyebrow "Evangelismo" + título.
 */
export function EvangelistaSubHeader({ titulo, volverA = ROUTES.EVANGELISTA, accion }: Props) {
  const navigate = useNavigate();
  return (
    <div
      className="relative -mx-5 -mt-5 flex items-center justify-between gap-3 p-5 text-white sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-6"
      style={{ background: EVANGELISTA_GRADIENTE_HERO }}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          onClick={() => navigate(volverA)}
          className="flex w-fit items-center gap-1 text-[12px] font-medium text-white/85 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Evangelismo
        </button>
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{titulo}</h1>
      </div>
      {accion}
    </div>
  );
}
