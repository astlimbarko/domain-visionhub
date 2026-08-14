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
 * conserva el header (logo + iglesia) y el fondo degradado de KAN-191. */
export function AyudaSeleccionarRol({ onVolver }: Props) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[var(--chart-1)]/15 blur-lg" />
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--chart-1)_14%,transparent)]">
          <HelpCircle className="h-5 w-5" style={{ color: AZUL }} />
        </div>
      </div>
      <h1 className="mt-2 text-xl font-extrabold tracking-tight text-foreground">¿Necesitás ayuda?</h1>
      <p className="text-[13px] text-muted-foreground">Información para ingresar con tus roles</p>

      <div className="mt-4 flex w-full flex-col gap-3 text-left">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <SeccionIconHeader
            icon={MousePointerClick}
            color={AZUL}
            titulo="Seleccionar un rol"
            descripcion="Haz clic sobre el rol con el que deseas ingresar. Podrás cambiar de rol posteriormente desde tu perfil."
          />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <SeccionIconHeader
            icon={UserRound}
            color={AMBAR}
            titulo="¿No aparece tu rol?"
            descripcion={
              <>
                Si un rol que te corresponde no aparece en la lista, contacta con tu{' '}
                <a href={MAILTO_LIDER} className="font-semibold text-[var(--chart-1)] hover:underline">
                  líder inmediato
                </a>{' '}
                para que pueda revisar o asignar tu acceso.
              </>
            }
          />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <SeccionIconHeader
            icon={CircleCheck}
            color={VERDE}
            titulo="¿Ves un rol que ya no te corresponde?"
            descripcion={
              <>
                Contacta con tu{' '}
                <a href={MAILTO_LIDER} className="font-semibold text-[var(--chart-1)] hover:underline">
                  líder inmediato
                </a>{' '}
                para solicitar la actualización de tu acceso.
              </>
            }
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-[12px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Los roles son administrados por los responsables de tu iglesia.
        </div>
      </div>

      <button
        type="button"
        onClick={onVolver}
        className="mt-5 flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2 text-[13px] font-medium text-[var(--chart-1)] transition-colors hover:bg-[var(--chart-1)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a mis roles
      </button>
    </div>
  );
}
