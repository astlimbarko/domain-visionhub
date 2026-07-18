import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  if (cargandoCasas) return <Skeleton className="h-96 w-full" />;

  if (!misCasas || misCasas.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Finanzas"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay finanzas que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {misCasas.length > 1 && (
            <Select value={cdpActiva} onValueChange={setCasaDePazId}>
              <SelectTrigger className="w-56">
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
          <Button variant="ghost" size="icon" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-medium">{nombreMes(anio, mes)}</span>
          <Button variant="ghost" size="icon" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2" disabled={monedas.length === 0}>
          <Plus className="h-4 w-4" />
          Nuevo ingreso
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Ingresos del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {cargandoTotales && <Skeleton className="h-24 w-full" />}
            {!cargandoTotales && totales.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin ingresos registrados este mes.</p>
            )}
            {totales.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{t.tipo_nombre}</span>
                <span className="font-medium text-foreground">
                  {t.moneda_simbolo} {Number(t.total).toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Contra el mes anterior</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {comparativo.length === 0 && <p className="text-sm text-muted-foreground">Sin datos para comparar.</p>}
            {comparativo.map((c) => (
              <div key={c.moneda_id} className="flex items-center justify-between text-sm">
                <span>{c.moneda_codigo}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {Number(c.total_actual).toFixed(2)} vs {Number(c.total_anterior).toFixed(2)}
                  </span>
                  {c.variacion_pct != null && (
                    <span
                      className={
                        'flex items-center gap-1 font-medium ' +
                        (c.variacion_pct >= 0 ? 'text-emerald-600' : 'text-destructive')
                      }
                    >
                      {c.variacion_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {c.variacion_pct}%
                    </span>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
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
