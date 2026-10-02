import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, HeartHandshake, History, KeyRound, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { CardIndicadorPastel } from '@/components/dashboard/CardIndicadorPastel';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { EvangelistaBanner } from '@/components/evangelista/EvangelistaBanner';
import { EvangelistaTrendChart } from '@/components/evangelista/EvangelistaTrendChart';
import { useAuthStore } from '@/store/auth.store';
import { useDashboardEvangelista, usePuedeOtorgarEvangelista } from '@/hooks/useEvangelistaPersonal';
import { EVANGELISTA_COLOR, EVANGELISTA_GRADIENTE_BOTON } from '@/utils/evangelista-colores';
import { nombreMes } from '@/utils/calendario-fechas';
import { ROUTES } from '@/utils/constants';

/** Dashboard personal del Evangelista (KAN-429, boceto `evangelismo1.jpeg`).
 * Toda la agregación (racha, indicadores, serie diaria) vive en
 * `fn_evangelista_dashboard` -- esta página solo pinta lo que llega. */
export function Evangelista() {
  const navigate = useNavigate();
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto) ?? '';
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const { data, isLoading, isFetching } = useDashboardEvangelista(anio, mes);
  const { data: puedeOtorgar } = usePuedeOtorgarEvangelista();

  function irMesAnterior() {
    const f = new Date(anio, mes - 1, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }
  function irMesSiguiente() {
    const f = new Date(anio, mes + 1, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

  return (
    <div className="flex flex-col gap-6">
      <EvangelistaBanner nombre={nombreCompleto} racha={data?.racha_dias ?? 0} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          className="h-auto justify-start gap-3 rounded-2xl px-4 py-3.5 text-white shadow-lg"
          style={{ background: EVANGELISTA_GRADIENTE_BOTON }}
          onClick={() => navigate(ROUTES.EVANGELISTA_NUEVO)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <UserPlus className="h-4.5 w-4.5" />
          </span>
          <span className="flex flex-col items-start">
            <span className="text-sm font-bold">Nuevo</span>
            <span className="text-[11px] font-normal text-white/85">Registrar persona</span>
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 rounded-2xl border-2 px-4 py-3.5"
          style={{ borderColor: EVANGELISTA_COLOR.NARANJA, color: EVANGELISTA_COLOR.NARANJA_OSCURO }}
          onClick={() => navigate(ROUTES.EVANGELISTA_HISTORIAL)}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `color-mix(in oklab, ${EVANGELISTA_COLOR.NARANJA} 14%, white)` }}
          >
            <History className="h-4.5 w-4.5" />
          </span>
          <span className="flex flex-col items-start">
            <span className="text-sm font-bold">Historial</span>
            <span className="text-[11px] font-normal text-muted-foreground">Ver seguimientos</span>
          </span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CardIndicadorPastel
            icon={Users}
            label="Registrados"
            color={EVANGELISTA_COLOR.NARANJA}
            valor={data?.registrados ?? 0}
            descripcion={nombreMes(anio, mes)}
          />
          <CardIndicadorPastel
            icon={Clock}
            label="En seguimiento"
            color={EVANGELISTA_COLOR.NARANJA_OSCURO}
            valor={data?.en_seguimiento ?? 0}
            descripcion="Con contacto registrado"
          />
          <CardIndicadorPastel
            icon={HeartHandshake}
            label="Nuevos convertidos"
            color={EVANGELISTA_COLOR.AMBAR}
            valor={data?.nuevos_convertidos ?? 0}
            descripcion="Aceptaron a Cristo"
          />
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={HeartHandshake}
          color={EVANGELISTA_COLOR.NARANJA}
          titulo="Personas evangelizadas"
          descripcion="Por día del mes"
          accion={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex w-28 items-center justify-center gap-1.5 text-center text-sm font-semibold tracking-tight capitalize">
                {nombreMes(anio, mes)}
                {isFetching && !isLoading && <Spinner className="h-3 w-3 text-muted-foreground" />}
              </span>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        />
        <div className="p-4">
          {isLoading ? (
            <Skeleton className="h-52 w-full rounded-xl" />
          ) : (
            <EvangelistaTrendChart serieDiaria={data?.serie_diaria ?? []} />
          )}
        </div>
      </section>

      {/* Requisito 2/KAN-434: acceso secundario al panel de alta, visible
          solo para quien puede otorgar el rol (Líder/Sublíder CdP,
          Líder/Supervisor Red, operativo, Depto. Evangelismo). */}
      {puedeOtorgar && (
        <button
          type="button"
          onClick={() => navigate(ROUTES.EVANGELISTA_CREDENCIALES)}
          className="flex items-center justify-center gap-2 self-center rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Crear credencial para Evangelista
        </button>
      )}
    </div>
  );
}
