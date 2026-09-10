import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarRange, ChevronLeft, ChevronRight, Flag, HeartHandshake, Home, LayoutGrid, Pencil, Plus, Target, Users, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { CardIndicadorPastel } from '@/components/dashboard/CardIndicadorPastel';
import { degradadoIdentidadColor } from '@/components/dashboard/DashboardUI';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { esMetaAsignada, quienAsignoMeta } from '@/utils/evangelismo-meta';
import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import {
  useTasaEvangelismoRed,
  useEvangelismoRed,
  useEvangelismoRedDirecto,
  useCrearEvangelizadoRed,
  useMetasCdpRed,
  useAsignarMetaEvangelismo,
} from '@/hooks/useEvangelismo';
import { AsignarMetaRedDialog } from '@/components/evangelismo/AsignarMetaRedDialog';
import { CalendarioEvangelismo } from '@/components/evangelismo/CalendarioEvangelismo';
import { ListaPersonasDia } from '@/components/evangelismo/ListaPersonasDia';
import { NuevoEvangelizadoDialog, type ValoresEvangelizado } from '@/components/evangelismo/NuevoEvangelizadoDialog';
import { aISO, fechaLegible, nombreMes, primerDiaMesRelativo } from '@/utils/calendario-fechas';
import { TendenciaEvangelismo } from '@/components/evangelismo/TendenciaEvangelismo';
import type { MetaCdpRed } from '@/types/evangelismo.types';
// Nota: TendenciaEvangelismo NO se pudo lazy-loadear acá (a diferencia de
// EvangelismoTrendChart en Evangelismo.tsx de CdP) porque
// EvangelismoSupervisorVista.tsx todavía lo importa estático -- Vite avisa
// "INEFFECTIVE_DYNAMIC_IMPORT" y no separa el chunk igual. Se deja import
// estático simple en vez de un lazy() que no cumple nada. Si algún día se
// aplica el mismo rediseño/optimización a EvangelismoSupervisorVista.tsx,
// ahí sí conviene lazy-loadearlo en los 2 lugares juntos.

/** Sentinel para distinguir "asignar a todas" de una CdP real en el mismo diálogo. */
const ID_TODAS = '__TODAS__';

// Paleta exacta pedida por el owner (2026-08-02), con hex propios para el
// módulo -- ver `evangelismo-colores.ts`. Un color por sección para que se
// distingan a simple vista, no un solo tono repetido en toda la pantalla.
const { AZUL, VERDE, NARANJA, CELESTE } = EVANGELISMO_COLOR;
const AMARILLO = EVANGELISMO_COLOR.AMARILLO;

interface Props {
  redId: string;
}

/**
 * Evangelismo a nivel Red: mismo espíritu que Evangelismo.tsx (CdP) pero con
 * datos agregados de todas las CdP de la Red -- cuántas evangelizó cada una,
 * qué día, y una sección para que el Líder de Red les asigne meta
 * (meta_evangelismo_asignada ya soportaba esto -- 12_evangelismo.sql).
 *
 * "Meta Global de la Red" NO es un valor aparte que se tipea a mano -- el
 * owner aclaró (2026-08-02) que es la suma de las metas ya asignadas a cada
 * CdP (fn_tasa_evangelismo_red.meta_total). No hay un segundo número que
 * mantener sincronizado; se define asignando/cambiando las metas de abajo,
 * ya sea una por una o de a todas juntas con "Asignar a todas".
 *
 * Esta pantalla no cambia para el Supervisor (2026-08-06): la "Meta de Red"
 * que el Supervisor puede asignar (a UNA Red o a TODAS de una vez, con
 * prioridad por sobre las metas CdP-específicas de acá -- `fn_meta_efectiva`,
 * origen `ASIGNADA_RED`) vive en `EvangelismoSupervisorVista.tsx`, la
 * pantalla de arriba -- acá abajo solo se ve el detalle de una Red puntual,
 * igual que ya lo ve el Líder de Red.
 */
export function EvangelismoRed({ redId }: Props) {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [cdpParaMeta, setCdpParaMeta] = useState<MetaCdpRed | null>(null);
  const [bulkAsignando, setBulkAsignando] = useState(false);
  const [dialogoEvangelizadoAbierto, setDialogoEvangelizadoAbierto] = useState(false);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  const { data: tasa, isLoading: cargandoTasa } = useTasaEvangelismoRed(redId, desde, hasta);
  const { data: evangelizados = [], isLoading: cargandoLista, isFetching: actualizandoLista } = useEvangelismoRed(redId, desde, hasta);
  const { data: metasCdp = [], isLoading: cargandoMetas } = useMetasCdpRed(redId);
  const asignarMeta = useAsignarMetaEvangelismo(redId);

  // Líder de Red sin Casa de Paz propia (pedido del owner, 2026-09-08): si ya
  // lidera una CdP dentro de ESTA misma Red, ya puede registrar evangelizados
  // por ese otro rol (Evangelismo.tsx) -- no se le duplica el flujo acá.
  const { data: misRoles } = useMisRoles(iglesiaActivaId);
  const tieneCdpPropiaEnEstaRed = (misRoles?.cdp_lider ?? []).some((c) => c.red_id === redId);
  // Color elegido para esta Red en el Constructor -- blanco es el valor "sin
  // elegir" (mismo criterio que DashboardLiderRed.tsx/GestionRedVista.tsx).
  const redActual = misRoles?.redes_lider?.find((r) => r.id === redId);
  const colorRed = redActual?.color && redActual.color.toUpperCase() !== '#FFFFFF' ? redActual.color : null;
  const { data: evangelizadosDirecto = [], isLoading: cargandoDirecto } = useEvangelismoRedDirecto(redId, desde, hasta);
  const crearDirecto = useCrearEvangelizadoRed(redId);

  // Registrado sin Casa de Paz -- queda fuera del ciclo SIM/NC/CRE (decisión
  // aceptada por el owner, no es un olvido).
  async function handleCrearDirecto(valores: ValoresEvangelizado) {
    if (!iglesiaActivaId) return;
    await crearDirecto.mutateAsync({ ...valores, red_id: redId, iglesia_id: iglesiaActivaId });
  }

  // Tendencia (KAN-285): mismo rango amplio y fijo que en la vista del
  // Supervisor/Departamento, independiente del mes navegado arriba.
  const hoyISO = aISO(hoy);
  const desdeTendencia = primerDiaMesRelativo(hoyISO, 11);
  const { data: evangelizadosTendencia = [], isLoading: cargandoTendencia } = useEvangelismoRed(redId, desdeTendencia, hoyISO);

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

  const evangelizadosDelDiaSeleccionado = useMemo(() => {
    if (!diaSeleccionado) return [];
    return evangelizados.filter((e) => e.fecha === diaSeleccionado);
  }, [evangelizados, diaSeleccionado]);

  // Agrupado por CdP -- lo que pidió el owner: "que el calendario muestre
  // qué día cada Casa de Paz salió a evangelizar", no solo una lista plana.
  const porCdpDelDiaSeleccionado = useMemo(() => {
    const grupos = new Map<string, { etiqueta: string; personas: typeof evangelizadosDelDiaSeleccionado }>();
    for (const e of evangelizadosDelDiaSeleccionado) {
      const g = grupos.get(e.casa_de_paz_id) ?? { etiqueta: e.casa_de_paz_etiqueta, personas: [] };
      g.personas.push(e);
      grupos.set(e.casa_de_paz_id, g);
    }
    return Array.from(grupos.values()).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  }, [evangelizadosDelDiaSeleccionado]);

  // Cuántos evangelizó cada CdP este mes -- para el % cumplido de su meta
  // (pedido del owner, 2026-08-02: "la card debe mostrar porcentaje
  // cumplidos de esas metas en porcentaje").
  const evangelizadosPorCdp = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const e of evangelizados) mapa.set(e.casa_de_paz_id, (mapa.get(e.casa_de_paz_id) ?? 0) + 1);
    return mapa;
  }, [evangelizados]);

  // El toast y el "¿se cierra el diálogo?" se deciden acá, no en
  // AsignarMetaRedDialog -- así "asignar a todas" puede avisar cuántas
  // fallaron sin un segundo toast genérico contradictorio encima. Tirar el
  // error es lo que le dice al diálogo que se quede abierto.
  async function handleAsignar(params: { meta: number; fechaInicio: string; fechaFin: string }) {
    if (!cdpParaMeta || !iglesiaActivaId || !personaId) return;

    if (cdpParaMeta.casa_de_paz_id === ID_TODAS) {
      setBulkAsignando(true);
      try {
        const resultados = await Promise.allSettled(
          metasCdp.map((c) =>
            asignarMeta.mutateAsync({
              iglesiaId: iglesiaActivaId,
              casaDePazId: c.casa_de_paz_id,
              asignadorId: personaId,
              meta: params.meta,
              fechaInicio: params.fechaInicio,
              fechaFin: params.fechaFin,
            })
          )
        );
        const fallidas = resultados.filter((r) => r.status === 'rejected').length;
        if (fallidas === resultados.length) {
          toast.error('No se pudo asignar la meta a ninguna Casa de Paz (todas ya tenían una meta que se solapa en esas fechas)');
          throw new Error('BULK_FALLO_TOTAL');
        }
        if (fallidas > 0) {
          toast.error(`Se asignó a ${resultados.length - fallidas} de ${resultados.length} Casas de Paz (${fallidas} ya tenían una meta que se solapa en esas fechas)`);
        } else {
          toast.success(`Meta de ${params.meta} asignada a las ${resultados.length} Casas de Paz`);
        }
      } finally {
        setBulkAsignando(false);
      }
      return;
    }

    try {
      await asignarMeta.mutateAsync({
        iglesiaId: iglesiaActivaId,
        casaDePazId: cdpParaMeta.casa_de_paz_id,
        asignadorId: personaId,
        meta: params.meta,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
      });
      toast.success(`Meta asignada a ${cdpParaMeta.etiqueta}`);
    } catch (e) {
      const error = e as { message?: string } | null;
      const mensaje = typeof error?.message === 'string' ? error.message : '';
      if (mensaje.includes('excl_meta_asignada_solapada') || mensaje.includes('exclusion')) {
        toast.error('Ya hay una meta asignada para esa Casa de Paz en un rango que se solapa');
      } else {
        toast.error('No se pudo asignar la meta');
      }
      throw e;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Barra combinada: intro chica + navegador de mes (2026-09-10, mismo
          patrón que Evangelismo.tsx de CdP -- esta pantalla no tenía hero
          propio, se agrega la intro acá para no sumar un bloque aparte). */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-2 sm:pl-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* NARANJA en toda la pantalla, sin MORADO (2026-09-10, regla del
              owner: un color por sección -- esta pantalla se había pasado de
              morado en 5 lugares distintos sin relación entre sí). */}
          <span
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex"
            style={{ background: `color-mix(in oklab, ${NARANJA} 12%, white)` }}
          >
            <UsersRound className="h-4 w-4" style={{ color: NARANJA }} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">Evangelismo de Red</p>
            <p className="truncate text-[11px] text-muted-foreground">Todas las Casas de Paz de tu Red, juntas</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex w-40 items-center justify-center gap-1.5 text-center text-sm font-semibold tracking-tight capitalize">
            {nombreMes(anio, mes)}
            {actualizandoLista && !cargandoLista && <Spinner className="h-3 w-3 text-muted-foreground" />}
          </span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pestañas (2026-09-10, mismo patrón que la vista de CdP/Dashboard de
          Red): "Resumen" agrupa métricas, evangelismo propio, metas por CdP
          y tendencia; "Calendario" queda solo, es el bloque más alto. */}
      <Tabs defaultValue="resumen">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="resumen" className="gap-1.5">
            <LayoutGrid /> Resumen
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5">
            <CalendarRange /> Calendario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cargandoTasa ? (
          <>
            <Skeleton className="h-[164px] w-full rounded-2xl" />
            <Skeleton className="h-[164px] w-full rounded-2xl" />
            <Skeleton className="h-[164px] w-full rounded-2xl" />
          </>
        ) : (
          <>
            <CardIndicadorPastel
              icon={Target} label="Evangelizados de la Red" color={AMARILLO} valor={tasa?.evangelizados ?? 0}
              descripcion={tasa?.meta_total ? `${tasa.tasa}% de la meta (${tasa.meta_total})` : 'Sin meta definida'}
            />
            <CardIndicadorPastel
              icon={Flag} label="Meta Global de la Red" color={AZUL} valor={tasa?.meta_total ?? 0}
              descripcion="Suma de las metas vigentes por CdP"
            />
            <CardIndicadorPastel
              icon={Users} label="Casas de Paz con meta" color={VERDE} valor={tasa?.cdp_con_meta ?? 0}
              descripcion={`De ${tasa?.cdp_total ?? 0} en total`}
            />
          </>
        )}
      </div>

      {!tieneCdpPropiaEnEstaRed && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={HeartHandshake}
            color={VERDE}
            titulo="Evangelismo propio"
            descripcion="Para Líderes de Red sin Casa de Paz propia -- estas personas no quedan asignadas a ninguna CdP"
            accion={
              <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setDialogoEvangelizadoAbierto(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nuevo evangelizado
              </Button>
            }
          />
          <div className="p-5">
            {cargandoDirecto ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : evangelizadosDirecto.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no registraste a nadie este mes.</p>
            ) : (
              <ListaPersonasDia
                personas={evangelizadosDirecto.map((e) => ({
                  id: e.id,
                  personaId: e.persona_id,
                  nombre: e.nombre_completo,
                  tipoNombre: e.tipo_evangelismo_nombre,
                  tipoColor: e.tipo_evangelismo_color,
                }))}
              />
            )}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Flag}
          color={NARANJA}
          titulo="Metas por Casa de Paz"
          descripcion="Cada meta que asignás acá se suma a la Meta Global de arriba"
          accion={
            metasCdp.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                style={{ borderColor: `color-mix(in oklab, ${NARANJA} 40%, transparent)`, color: NARANJA }}
                onClick={() => setCdpParaMeta({ casa_de_paz_id: ID_TODAS, etiqueta: `Todas las Casas de Paz (${metasCdp.length})`, meta: null, origen: null })}
              >
                <UsersRound className="h-3.5 w-3.5" />
                Asignar a todas
              </Button>
            )
          }
        />
        <div className="p-5">
          {cargandoMetas ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : metasCdp.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay Casas de Paz activas en tu Red.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {metasCdp.map((c) => {
                const cantidad = evangelizadosPorCdp.get(c.casa_de_paz_id) ?? 0;
                const pctCumplido = c.meta ? Math.round((cantidad / c.meta) * 100) : null;
                return (
                  <div key={c.casa_de_paz_id} className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Antes naranja fijo para todas las filas (pedido del
                          owner 2026-09-10: "muy soso, se repite") -- ahora el
                          degradado de identidad con el color propio de la Red. */}
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ background: colorRed ? degradadoIdentidadColor(colorRed) : degradadoIdentidadColor(NARANJA) }}
                      >
                        <Home className="h-4 w-4" />
                      </span>
                      <p className="truncate text-sm font-bold text-foreground">{c.etiqueta}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      {c.meta != null ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className="font-bold text-foreground">{cantidad}/{c.meta}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{ backgroundColor: `color-mix(in oklab, ${VERDE} 14%, transparent)`, color: VERDE }}
                          >
                            {pctCumplido}% cumplido
                          </span>
                          <span className="text-xs text-muted-foreground">{esMetaAsignada(c.origen) ? `(asignada por ${quienAsignoMeta(c.origen)})` : '(propia)'}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin meta</span>
                      )}
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCdpParaMeta(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                        {esMetaAsignada(c.origen) ? 'Cambiar' : 'Asignar'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Tendencia: día/semana/mes, últimos 12 meses (KAN-285) ─────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Flag} color={NARANJA} titulo="Tendencia" descripcion="Semana es lo típico -- Día sirve para eventos puntuales, no es la vista de rutina" />
        <div className="p-5">
          <TendenciaEvangelismo evangelizados={evangelizadosTendencia} cargando={cargandoTendencia} />
        </div>
      </section>
        </TabsContent>

        <TabsContent value="calendario">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
          <TarjetaHeader
            icon={CalendarRange}
            color={CELESTE}
            titulo="Calendario de evangelismo"
            descripcion="Días en los que alguna Casa de Paz registró evangelismo"
            accion={<span className="text-lg font-bold capitalize" style={{ color: CELESTE }}>{nombreMes(anio, mes)}</span>}
          />
          <div className="p-4">
            {cargandoLista ? (
              <Skeleton className="h-80 w-full rounded-2xl" />
            ) : (
              <CalendarioEvangelismo anio={anio} mes={mes} evangelizados={evangelizados} diaSeleccionado={diaSeleccionado} onSeleccionarDia={setDiaSeleccionado} />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={HeartHandshake}
            color={AZUL}
            titulo={diaSeleccionado ? fechaLegible(diaSeleccionado) : 'Por Casa de Paz'}
            descripcion={diaSeleccionado ? `${evangelizadosDelDiaSeleccionado.length} evangelizado(s)` : 'Elegí un día del calendario'}
            accion={
              diaSeleccionado && (
                <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs" onClick={() => setDiaSeleccionado(null)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Volver
                </Button>
              )
            }
          />
          <div className="p-5">
            {!diaSeleccionado && <p className="text-sm text-muted-foreground">Elegí un día en el calendario para ver qué Casa de Paz salió a evangelizar.</p>}
            {diaSeleccionado && porCdpDelDiaSeleccionado.length === 0 && <p className="text-sm text-muted-foreground">Nadie registrado este día.</p>}
            {diaSeleccionado && porCdpDelDiaSeleccionado.length > 0 && (
              <div className="flex flex-col gap-4">
                {porCdpDelDiaSeleccionado.map((g) => (
                  <div key={g.etiqueta} className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                      <Home className="h-3.5 w-3.5" style={{ color: AZUL }} /> {g.etiqueta}
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{g.personas.length}</span>
                    </p>
                    <div className="pl-5">
                      <ListaPersonasDia
                        personas={g.personas.map((e) => ({
                          id: e.id,
                          personaId: e.persona_id,
                          nombre: e.nombre_completo,
                          tipoNombre: e.tipo_evangelismo_nombre,
                          tipoColor: e.tipo_evangelismo_color,
                        }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
        </TabsContent>
      </Tabs>

      <AsignarMetaRedDialog
        open={!!cdpParaMeta}
        onOpenChange={(open) => !open && setCdpParaMeta(null)}
        cdp={cdpParaMeta}
        asignando={cdpParaMeta?.casa_de_paz_id === ID_TODAS ? bulkAsignando : asignarMeta.isPending}
        onAsignar={handleAsignar}
      />

      <NuevoEvangelizadoDialog
        open={dialogoEvangelizadoAbierto}
        onOpenChange={setDialogoEvangelizadoAbierto}
        iglesiaId={iglesiaActivaId}
        fechaInicial={aISO(hoy)}
        onCrear={handleCrearDirecto}
      />
    </div>
  );
}
