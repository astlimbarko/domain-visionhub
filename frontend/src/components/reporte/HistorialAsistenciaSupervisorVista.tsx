import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { HistorialAsistencia as HistorialAsistenciaSeccion } from '@/components/reporte/HistorialAsistencia';
import { obtenerSemaforoCdp } from '@/services/dashboard.service';
import { useAuthStore } from '@/store/auth.store';
import { useRedes, useCdps } from '@/hooks/useCasasDePaz';
import type { RedResumen } from '@/types/casas-de-paz.types';

const FILAS_FIDELIDAD = [
  { clave: 'verdes' as const, color: 'var(--chart-2)' },
  { clave: 'amarillos' as const, color: '#f59e0b' },
  { clave: 'rojos' as const, color: 'var(--destructive)' },
];

/** Versión chica del aro de 3 segmentos de `IndiceFidelidadRing` (Líder de CdP), para
 * mostrar de un vistazo el índice de fidelidad de cada Red en la grilla de tarjetas. */
function AroFidelidadChico({ verdes, amarillos, rojos }: { verdes: number; amarillos: number; rojos: number }) {
  const size = 64;
  const stroke = 7;
  const total = verdes + amarillos + rojos;
  const porcentaje = total > 0 ? Math.round((verdes / total) * 100) : null;
  const conteos = { verdes, amarillos, rojos };
  const radius = (size - stroke) / 2;
  const circunferencia = 2 * Math.PI * radius;
  let acumulado = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {total > 0 &&
          FILAS_FIDELIDAD.map((f) => {
            const valor = conteos[f.clave];
            if (valor === 0) return null;
            const largo = (valor / total) * circunferencia;
            const offset = -acumulado;
            acumulado += largo;
            return (
              <circle
                key={f.clave}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={f.color}
                strokeWidth={stroke}
                strokeDasharray={`${largo} ${circunferencia - largo}`}
                strokeDashoffset={offset}
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[13px] font-bold text-foreground">{porcentaje ?? '—'}%</span>
      </div>
    </div>
  );
}

/** Card clickeable de una Red: aro de fidelidad agregado (suma el semáforo de todas sus
 * Casas de Paz activas) + nombre + cantidad de CdP. Tocarla abre el modal con el detalle. */
function RedFidelidadCard({ red, iglesiaId, onAbrir }: { red: RedResumen; iglesiaId: string | undefined; onAbrir: () => void }) {
  const { data: cdpsTodas = [] } = useCdps(iglesiaId, red.id);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);
  const cdpIds = useMemo(() => cdps.map((c) => c.id), [cdps]);

  const resultados = useQueries({
    queries: cdpIds.map((id) => ({
      queryKey: ['dashboard', 'semaforo-cdp', id],
      queryFn: () => obtenerSemaforoCdp(id),
      enabled: !!id,
    })),
  });

  const cargando = cdpIds.length > 0 && resultados.some((r) => r.isLoading);
  let verdes = 0;
  let amarillos = 0;
  let rojos = 0;
  for (const r of resultados) {
    for (const m of r.data ?? []) {
      if (m.semaforo === 'VERDE') verdes++;
      else if (m.semaforo === 'AMARILLO') amarillos++;
      else rojos++;
    }
  }

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      {cargando ? <Skeleton className="h-16 w-16 shrink-0 rounded-full" /> : <AroFidelidadChico verdes={verdes} amarillos={amarillos} rojos={rojos} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">{red.nombre}</p>
        <p className="truncate text-[12px] text-muted-foreground">
          {cdps.length} Casa{cdps.length === 1 ? '' : 's'} de Paz · {red.lider_nombre ?? 'Sin líder'}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
    </button>
  );
}

/** Contenido del modal de una Red: una pestaña por Casa de Paz, cada una con su
 * historial de asistencia completo (mismo componente que usa el Líder/Sublíder de CdP). */
function ModalHistorialRed({ red, iglesiaId }: { red: RedResumen; iglesiaId: string | undefined }) {
  const { data: cdpsTodas = [], isLoading } = useCdps(iglesiaId, red.id);
  const cdps = useMemo(() => cdpsTodas.filter((c) => c.activo), [cdpsTodas]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{red.nombre}</DialogTitle>
        <DialogDescription>Historial de asistencia por Casa de Paz</DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : cdps.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Esta Red todavía no tiene Casas de Paz activas.</p>
      ) : (
        <Tabs defaultValue={cdps[0].id}>
          <TabsList>
            {cdps.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>{c.etiqueta}</TabsTrigger>
            ))}
          </TabsList>
          {cdps.map((c) => (
            <TabsContent key={c.id} value={c.id}>
              <HistorialAsistenciaSeccion casaDePazId={c.id} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

/**
 * "Historial de Asistencia" del Supervisor: grilla de Redes (todas las de la
 * iglesia, `useRedes`), cada una con su índice de fidelidad agregado -- suma
 * del semáforo (VERDE/AMARILLO/ROJO) de los miembros de todas sus Casas de
 * Paz activas, mismo criterio que ya usa `IndiceFidelidadRing` para una CdP
 * puntual en el dashboard del Líder de CdP. Tocar una Red abre un modal con
 * una pestaña por Casa de Paz (mismo componente `Tabs` del Panel del
 * Supervisor / Casas de Paz), cada una con su historial de asistencia
 * completo. Pedido del owner, 2026-08-06 -- solo para el Supervisor de la
 * Visión en Acción por ahora.
 */
export function HistorialAsistenciaSupervisorVista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: redesTodas = [], isLoading: cargandoRedes } = useRedes(iglesiaActivaId);
  const redes = useMemo(() => redesTodas.filter((r) => r.activo), [redesTodas]);

  const [redAbierta, setRedAbierta] = useState<RedResumen | null>(null);

  if (cargandoRedes) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (redes.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Historial de Asistencia"
        descripcion="Todavía no hay Redes activas en esta iglesia, así que no hay historial que mostrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Índice de fidelidad de cada Red — tocá una para ver el historial de asistencia de sus Casas de Paz.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {redes.map((r) => (
          <RedFidelidadCard key={r.id} red={r} iglesiaId={iglesiaActivaId} onAbrir={() => setRedAbierta(r)} />
        ))}
      </div>

      <Dialog open={!!redAbierta} onOpenChange={(open) => !open && setRedAbierta(null)}>
        <DialogContent className="sm:max-w-3xl">
          {redAbierta && <ModalHistorialRed red={redAbierta} iglesiaId={iglesiaActivaId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
