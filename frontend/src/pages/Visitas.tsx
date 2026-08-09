import { useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Home, Plus, Target, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AMBAR, MARINO } from '@/components/dashboard/DashboardUI';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import { useContextoActivo } from '@/hooks/useContextoActivo';
import { useCdps } from '@/hooks/useCasasDePaz';
import { useVisitasRed } from '@/hooks/useVisitas';
import { VisitaFormDialog } from '@/components/visitas/VisitaFormDialog';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { ASPECTOS_VISITA, MOTIVOS_VISITA } from '@/types/visitas.types';
import { fechaLegible } from '@/utils/calendario-fechas';

const ETIQUETA_MOTIVO = Object.fromEntries(MOTIVOS_VISITA.map((m) => [m.value, m.label]));
const ETIQUETA_ASPECTO = Object.fromEntries(ASPECTOS_VISITA.map((a) => [a.value, a.label]));

// Mismo patrón de paginación en cliente que ControlReportesVista.tsx: la
// lista completa ya viene del backend, solo se corta cuánto se pinta.
const LOTE = 10;

export function Visitas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: roles, isLoading: cargandoRoles } = useMisRoles(iglesiaActivaId);
  const { contextoActivo } = useContextoActivo();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [visibles, setVisibles] = useState(LOTE);

  const redId = contextoActivo?.alcance === 'RED' ? contextoActivo.redId : undefined;
  const red = roles?.redes_lider?.find((item) => item.id === redId);
  const { data: cdps = [] } = useCdps(iglesiaActivaId, red?.id);
  const { data: visitas = [], isLoading: cargandoVisitas } = useVisitasRed(red?.id);
  const visitasVisibles = visitas.slice(0, visibles);

  if (cargandoRoles) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!red) {
    return (
      <ProximamentePlaceholder
        titulo="Visitas"
        descripcion="Todavía no tenés una Red asignada como líder, así que no hay visitas que registrar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Nueva visita
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={ClipboardList}
          color={MARINO}
          titulo="Visitas a Casas de Paz"
          descripcion="Registro de supervisión a las Casas de Paz de tus líderes"
        />
        <div className="p-5">
          {cargandoVisitas ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : visitas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <ClipboardList className="h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Todavía no registraste ninguna visita.</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDialogoAbierto(true)}>
                <Plus className="h-3.5 w-3.5" />
                Registrar la primera
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visitasVisibles.map((v) => (
                <div key={v.id} className="flex flex-col gap-2.5 rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in oklab, ${MARINO} 14%, transparent)` }}>
                        <Home className="h-4 w-4" style={{ color: MARINO }} />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-foreground">{v.casa_de_paz_etiqueta}</p>
                        {v.lider_cdp_nombre && (
                          <p className="text-xs text-muted-foreground">
                            Líder:{' '}
                            {v.lider_cdp_id ? (
                              <PersonaNombreLink personaId={v.lider_cdp_id}>{v.lider_cdp_nombre}</PersonaNombreLink>
                            ) : (
                              v.lider_cdp_nombre
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> {fechaLegible(v.fecha_visita)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 border-0" style={{ backgroundColor: `color-mix(in oklab, ${AMBAR} 14%, transparent)`, color: AMBAR }}>
                      <Target className="h-3 w-3" /> {ETIQUETA_MOTIVO[v.motivo] ?? v.motivo}
                    </Badge>
                    {v.aspectos.map((a) => (
                      <Badge key={a} variant="outline" className="border-border/70 text-muted-foreground">
                        {ETIQUETA_ASPECTO[a] ?? a}
                      </Badge>
                    ))}
                  </div>
                  {v.aspectos.includes('OTRO') && v.aspecto_otro_detalle && (
                    <p className="text-xs text-muted-foreground">Otro: {v.aspecto_otro_detalle}</p>
                  )}
                  {(v.tiene_adn_casa !== null || v.ensenanza_correcta !== null) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {v.tiene_adn_casa !== null && (
                        <Badge variant="outline" className="gap-1 border-border/70 text-muted-foreground">
                          {v.tiene_adn_casa ? <CheckCircle2 className="h-3 w-3 text-[var(--chart-2)]" /> : <XCircle className="h-3 w-3 text-destructive" />}
                          ADN de la casa
                        </Badge>
                      )}
                      {v.ensenanza_correcta !== null && (
                        <Badge variant="outline" className="gap-1 border-border/70 text-muted-foreground">
                          {v.ensenanza_correcta ? <CheckCircle2 className="h-3 w-3 text-[var(--chart-2)]" /> : <XCircle className="h-3 w-3 text-destructive" />}
                          Enseñanza correcta
                        </Badge>
                      )}
                    </div>
                  )}
                  {v.observaciones && <p className="text-sm text-foreground">{v.observaciones}</p>}
                </div>
              ))}

              {visitas.length > visibles && (
                <Button variant="outline" className="mt-1 w-full rounded-xl" onClick={() => setVisibles((n) => n + LOTE)}>
                  Mostrar más ({visitas.length - visibles} restantes)
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      <VisitaFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        redId={red.id}
        redNombre={red.nombre}
        iglesiaId={iglesiaActivaId as string}
        cdps={cdps}
      />
    </div>
  );
}
