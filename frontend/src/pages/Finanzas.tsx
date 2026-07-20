import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import { useMonedasActivas } from '@/hooks/usePanelSupervisor';
import { useComparativo, useCrearIngreso, useIngresosCdp, useTiposIngreso } from '@/hooks/useFinanzas';
import { NuevoIngresoDialog } from '@/components/finanzas/NuevoIngresoDialog';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO, nombreMes } from '@/utils/calendario-fechas';

export function Finanzas() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  const { data: tipos = [] } = useTiposIngreso(iglesiaActivaId);
  const { data: monedas = [] } = useMonedasActivas(iglesiaActivaId);
  const { data: totales = [], isLoading: cargandoTotales } = useIngresosCdp(cdpActiva, desde, hasta);
  const { data: comparativo = [] } = useComparativo(cdpActiva, desde, hasta);
  const crear = useCrearIngreso(cdpActiva);

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

  if (cargandoCasas) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!misCasas || misCasas.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Finanzas"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay finanzas que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {misCasas.length > 1 && (
            <Select value={cdpActiva} onValueChange={setCasaDePazId}>
              <SelectTrigger className="w-56 rounded-xl border-border/60 bg-muted/40 text-sm">
                <SelectValue placeholder="Casa de Paz" />
              </SelectTrigger>
              <SelectContent>
                {misCasas.map((c) => (
                  <SelectItem key={c.casa_de_paz_id} value={c.casa_de_paz_id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-semibold tracking-tight">{nombreMes(anio, mes)}</span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]" disabled={monedas.length === 0}>
          <Plus className="h-4 w-4" />
          Nuevo ingreso
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="glass-card-elevated rounded-2xl p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-primary" />
            Ingresos del mes
          </h3>
          <div className="flex flex-col gap-2.5">
            {cargandoTotales && <Skeleton className="h-24 w-full rounded-xl" />}
            {!cargandoTotales && totales.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin ingresos registrados este mes.</p>
            )}
            {totales.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.tipo_nombre}</span>
                <span className="font-semibold text-foreground">
                  {t.moneda_simbolo} {Number(t.total).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card-elevated rounded-2xl p-6">
          <h3 className="mb-4 text-sm font-semibold">Contra el mes anterior</h3>
          <div className="flex flex-col gap-2.5">
            {comparativo.length === 0 && <p className="text-sm text-muted-foreground">Sin datos para comparar.</p>}
            {comparativo.map((c) => (
              <div key={c.moneda_id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{c.moneda_codigo}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {Number(c.total_actual).toFixed(2)} vs {Number(c.total_anterior).toFixed(2)}
                  </span>
                  {c.variacion_pct != null && (
                    <span
                      className={
                        'flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ' +
                        (c.variacion_pct >= 0 ? 'bg-chart-2/10 text-chart-2' : 'bg-destructive/10 text-destructive')
                      }
                    >
                      {c.variacion_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {c.variacion_pct}%
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {cdpActiva && (
        <NuevoIngresoDialog
          open={dialogoAbierto}
          onOpenChange={setDialogoAbierto}
          tipos={tipos}
          monedas={monedas}
          fechaInicial={aISO(hoy)}
          onCrear={(valores) =>
            crear.mutateAsync({
              iglesia_id: iglesiaActivaId as string,
              casa_de_paz_id: cdpActiva,
              tipo_ingreso_id: valores.tipo_ingreso_id,
              monto: valores.monto,
              moneda_id: valores.moneda_id,
              fecha: valores.fecha,
            })
          }
        />
      )}
    </div>
  );
}
