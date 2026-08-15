import { ArrowLeft, CircleCheck, HelpCircle, Info, MousePointerClick, UserRound } from 'lucide-react';
import { AZUL, AMBAR, VERDE } from '@/components/dashboard/DashboardUI';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';

interface Props {
  onVolver: () => void;
}

const CORREO_SOPORTE = 'soporte@somoscdv.com';
const MAILTO_LIDER = `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent('Ayuda con mis roles asignados')}`;

/** KAN-193: pantalla de ayuda del selector de rol (multirol-help.jpeg) --
 * reemplaza el contenido del mismo card en vez de navegar a otra ruta, así
 * conserva el header (logo + iglesia) y el fondo degradado de KAN-191.
 * KAN-195: texto recortado al mínimo a propósito -- esta pantalla tiene que
 * entrar sin scroll (a diferencia de la lista de roles, que sí puede
 * necesitarlo con muchos roles). */
export function AyudaSeleccionarRol({ onVolver }: Props) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--chart-1)_14%,transparent)]">
        <HelpCircle className="h-4.5 w-4.5" style={{ color: AZUL }} />
      </div>
      <h1 className="mt-1.5 text-lg font-extrabold tracking-tight text-foreground">¿Necesitás ayuda?</h1>

      <div className="mt-3 flex w-full flex-col gap-2 text-left">
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <SeccionIconHeader
            size="sm"
            icon={MousePointerClick}
            color={AZUL}
            titulo="Seleccionar un rol"
            descripcion="Hacé clic en el rol con el que querés ingresar."
          />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <SeccionIconHeader
            size="sm"
            icon={UserRound}
            color={AMBAR}
            titulo="¿No aparece tu rol?"
            descripcion={
              <>
                Contactá a tu{' '}
                <a href={MAILTO_LIDER} className="font-semibold text-[var(--chart-1)] hover:underline">
                  líder inmediato
                </a>{' '}
                para revisar tu acceso.
              </>
            }
          />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <SeccionIconHeader
            size="sm"
            icon={CircleCheck}
            color={VERDE}
            titulo="¿Ves un rol que ya no corresponde?"
            descripcion={
              <>
                Contactá a tu{' '}
                <a href={MAILTO_LIDER} className="font-semibold text-[var(--chart-1)] hover:underline">
                  líder inmediato
                </a>{' '}
                para actualizarlo.
              </>
            }
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3 shrink-0" />
          Los roles son administrados por los responsables de tu iglesia.
        </div>
      </div>

      <button
        type="button"
        onClick={onVolver}
        className="mt-4 flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-1.5 text-[13px] font-medium text-[var(--chart-1)] transition-colors hover:bg-[var(--chart-1)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a mis roles
      </button>
    </div>
  );
}
