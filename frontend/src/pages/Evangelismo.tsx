import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  Award,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  MapPin,
  Minus,
  Plus,
  Sparkles,
  Target,
  Trophy,
  HeartHandshake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { AZUL, VERDE, AMBAR, MORADO } from '@/components/dashboard/DashboardUI';
import { DonutRing } from '@/components/dashboard/DonutRing';
import { useAuthStore } from '@/store/auth.store';
import { useRolUI } from '@/hooks/useRolUI';
import { useMisRoles } from '@/hooks/useDashboard';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import {
  useActualizarMetaPropia,
  useCrearEvangelizado,
  useEvangelizados,
  useMetaPropia,
  useTasaEvangelismo,
  useTiposEvangelismo,
} from '@/hooks/useEvangelismo';
import { NuevoEvangelizadoDialog } from '@/components/evangelismo/NuevoEvangelizadoDialog';
import { EvangelismoTrendChart } from '@/components/evangelismo/EvangelismoTrendChart';
import { CalendarioEvangelismo } from '@/components/evangelismo/CalendarioEvangelismo';
import { EvangelismoRed } from '@/components/evangelismo/EvangelismoRed';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO, fechaLegible, nombreMes } from '@/utils/calendario-fechas';

export function Evangelismo() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const rolUI = useRolUI();
  const { data: roles } = useMisRoles(iglesiaActivaId);

  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [metaLocal, setMetaLocal] = useState<string>('');
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));
  // Mes anterior, para la KPI de variación -- mismo patrón que ya usa el Dashboard.
  const desdeAnterior = aISO(new Date(anio, mes - 1, 1));
  const hastaAnterior = aISO(new Date(anio, mes, 0));

  const { data: tasa, isLoading: cargandoTasa } = useTasaEvangelismo(cdpActiva, desde, hasta);
  const { data: tasaAnterior } = useTasaEvangelismo(cdpActiva, desdeAnterior, hastaAnterior);
  const { data: metaPropia } = useMetaPropia(cdpActiva);
  // El input de meta propia se siembra con lo guardado en la BD -- antes ese
  // valor solo se mostraba como placeholder (texto gris, no el value real),
  // asi que si alguien clickeaba "Guardar" sin volver a escribirlo, se
  // mandaba metaLocal="" y la meta quedaba en null sin que nadie lo pidiera.
  useEffect(() => {
    setMetaLocal(metaPropia?.meta_evangelismo != null ? String(metaPropia.meta_evangelismo) : '');
  }, [cdpActiva, metaPropia?.meta_evangelismo]);
  const {
    data: evangelizados = [],
    isLoading: cargandoLista,
    isFetching: actualizandoLista,
  } = useEvangelizados(cdpActiva, desde, hasta);
  const { data: tiposEvangelismo = [] } = useTiposEvangelismo(iglesiaActivaId);
  const crear = useCrearEvangelizado(cdpActiva);
  const actualizarMeta = useActualizarMetaPropia(cdpActiva);

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

  // El día con más evangelizados del mes (para la card de resumen junto al calendario).
  const mejorDia = useMemo(() => {
    const conteos = new Map<string, number>();
    for (const e of evangelizados) conteos.set(e.fecha, (conteos.get(e.fecha) ?? 0) + 1);
    let mejor: { fecha: string; cantidad: number } | undefined;
    for (const [fecha, cantidad] of conteos) {
      if (!mejor || cantidad > mejor.cantidad) mejor = { fecha, cantidad };
    }
    return mejor;
  }, [evangelizados]);

  // Racha de días consecutivos con al menos un evangelizado, contando hacia atrás
  // desde el día más reciente con actividad este mes (no cruza a meses anteriores).
  const rachaDias = useMemo(() => {
    const diasConActividad = new Set(evangelizados.map((e) => e.fecha));
    if (diasConActividad.size === 0) return 0;
    const masReciente = Array.from(diasConActividad).sort().at(-1) as string;
    let racha = 1;
    const cursor = new Date(`${masReciente}T00:00:00`);
    for (;;) {
      cursor.setDate(cursor.getDate() - 1);
      if (!diasConActividad.has(aISO(cursor))) break;
      racha += 1;
    }
    return racha;
  }, [evangelizados]);

  // Desglose por tipo de evangelismo (1+1, Elite, Semilla...) para este mes.
  // Se arma siempre a partir del catálogo completo (tamaño fijo, 3 tipos) y
  // no solo de los tipos que ya tienen datos: así la card no crece ni se
  // achica según qué se haya cargado, el conteo simplemente se acumula.
  const porTipoEvangelismo = useMemo(() => {
    const conteos = new Map<string, number>();
    for (const e of evangelizados) {
      if (!e.tipo_evangelismo_nombre) continue;
      conteos.set(e.tipo_evangelismo_nombre, (conteos.get(e.tipo_evangelismo_nombre) ?? 0) + 1);
    }
    return tiposEvangelismo.map((t) => ({ nombre: t.nombre, color: t.color, cantidad: conteos.get(t.nombre) ?? 0 }));
  }, [evangelizados, tiposEvangelismo]);

  const tipoMasFrecuente = porTipoEvangelismo.reduce<(typeof porTipoEvangelismo)[number] | undefined>(
    (mejor, t) => (t.cantidad > 0 && (!mejor || t.cantidad > mejor.cantidad) ? t : mejor),
    undefined
  );

  // Variación vs. mes anterior: si el mes anterior tuvo 0, un % no dice nada,
  // así que ese caso se muestra como "nuevo" en vez de un porcentaje engañoso.
  const evangelizadosActual = tasa?.evangelizados ?? 0;
  const evangelizadosAnterior = tasaAnterior?.evangelizados ?? 0;
  const variacionAbsoluta = evangelizadosActual - evangelizadosAnterior;
  const variacionPct = evangelizadosAnterior > 0 ? Math.round((variacionAbsoluta / evangelizadosAnterior) * 100) : null;

  async function guardarMeta() {
    const valor = metaLocal.trim() === '' ? null : Number(metaLocal);
    try {
      await actualizarMeta.mutateAsync(valor);
      toast.success(valor != null ? `Meta propia actualizada a ${valor}` : 'Meta propia borrada');
    } catch {
      toast.error('No se pudo guardar la meta propia');
    }
  }

  // Mismo motivo que en Calendario.tsx: un Líder de Red puro no tiene CdP
  // propia (misCasas vacío), así que sin esta rama caía siempre en el
  // placeholder de abajo pese a tener "Evangelismo" en su menú.
  if (rolUI === 'LIDER_RED') {
    if (!roles) return <Skeleton className="h-96 w-full rounded-2xl" />;
    const redId = roles.redes_lider?.[0]?.id;
    if (!redId) {
      return (
        <ProximamentePlaceholder
          titulo="Evangelismo"
          descripcion="Todavía no tenés una Red asignada como líder, así que no hay evangelismo que mostrar."
        />
      );
    }
    return <EvangelismoRed redId={redId} />;
  }

  if (cargandoCasas) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!misCasas || misCasas.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Evangelismo"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay evangelismo que mostrar."
      />
    );
  }

  const porcentaje = tasa?.tasa != null ? Math.min(tasa.tasa, 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Nuevo evangelizado
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:p-2 sm:pl-4">
        {misCasas.length > 1 && (
          <Select value={cdpActiva} onValueChange={setCasaDePazId}>
            <SelectTrigger className="w-full sm:w-56 rounded-xl border-border/60 bg-background text-sm">
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesAnterior} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex w-36 items-center justify-center gap-1.5 text-center text-sm font-semibold tracking-tight capitalize">
            {nombreMes(anio, mes)}
            {actualizandoLista && !cargandoLista && <Spinner className="h-3 w-3 text-muted-foreground" />}
          </span>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={irMesSiguiente} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
          <TarjetaHeader
            icon={Target}
            color={AZUL}
            titulo="Tasa de evangelismo"
            descripcion={tasa?.origen ? `Meta ${tasa.origen === 'ASIGNADA' ? 'asignada por un rol superior' : 'propia'}` : 'Seguimiento del mes'}
          />
          <div className="flex flex-col gap-4 p-6">
            {cargandoTasa ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* KPI: evangelizados del mes vs. meta */}
                <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg shadow-blue-500/20">
                  <DonutRing porcentaje={tasa?.meta != null ? porcentaje : null} size={80} strokeWidth={8} color="white" trackColor="rgba(255,255,255,0.3)">
                    <span className="text-base font-bold text-white">{tasa?.meta != null ? `${tasa.tasa}%` : '—'}</span>
                  </DonutRing>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-[11px] font-semibold tracking-wider text-white/80 uppercase">Evangelizados</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight">{tasa?.evangelizados ?? 0}</span>
                      <span className="text-sm font-bold text-white/90">
                        {tasa?.meta != null ? `de ${tasa.meta}` : 'sin meta definida'}
                      </span>
                    </div>
                    {tasa?.meta != null && (
                      <p className="text-[11px] text-white/80">
                        {tasa.tasa}% de la meta{tasa.tasa && tasa.tasa > 100 ? ' — ¡meta superada!' : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* KPI: meta asignada por un rol superior (Líder de Red, Supervisor...) -- solo lectura,
                    vive aparte de la meta propia porque en la BD son mutuamente excluyentes: si hay una
                    asignada vigente, es la que cuenta para el % de arriba y la propia queda "en pausa". */}
                <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 text-white shadow-lg shadow-indigo-500/20">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <Award className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-[11px] font-semibold tracking-wider text-white/80 uppercase">Meta asignada</p>
                    {tasa?.origen === 'ASIGNADA' ? (
                      <>
                        <span className="text-3xl font-bold tracking-tight">{tasa.meta}</span>
                        <p className="text-[11px] text-white/80">Fijada por un rol superior, no editable acá</p>
                      </>
                    ) : (
                      <span className="text-sm text-white/80">Sin meta asignada por ahora</span>
                    )}
                  </div>
                </div>

                {/* KPI: Meta propia de Casa de Paz -- siempre editable por el lider, sea o no la que
                    esté rigiendo el % de arriba (esa se lee aparte, sin depender de fn_tasa_evangelismo,
                    porque esa RPC oculta la propia mientras haya una asignada vigente). */}
                <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in oklab, ${VERDE} 10%, transparent)` }}>
                    <Flag className="h-5 w-5" style={{ color: VERDE }} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Meta propia de Casa de Paz
                    </p>
                    <div className="flex items-end gap-2">
                      <Input
                        id="meta_propia"
                        type="number"
                        min={1}
                        className="h-9 w-24 rounded-xl text-sm"
                        placeholder="Sin definir"
                        value={metaLocal}
                        onChange={(e) => setMetaLocal(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-xl"
                        onClick={guardarMeta}
                        disabled={actualizarMeta.isPending}
                      >
                        {actualizarMeta.isPending && <Spinner className="h-3.5 w-3.5" />}
                        Guardar
                      </Button>
                    </div>
                    {tasa?.origen === 'ASIGNADA' && (
                      <p className="text-[11px] text-muted-foreground">
                        No mueve el % de arriba mientras haya una meta asignada vigente
                      </p>
                    )}
                  </div>
                </div>

                {/* KPI: variación vs. mes anterior */}
                <div
                  className={cn(
                    'flex items-center gap-4 rounded-2xl p-4 text-white shadow-lg',
                    variacionAbsoluta > 0
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/20'
                      : variacionAbsoluta < 0
                        ? 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/20'
                        : 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/20'
                  )}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    {variacionAbsoluta > 0 ? (
                      <ArrowUp className="h-5 w-5 text-white" />
                    ) : variacionAbsoluta < 0 ? (
                      <ArrowDown className="h-5 w-5 text-white" />
                    ) : (
                      <Minus className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-[11px] font-semibold tracking-wider text-white/80 uppercase">Vs. mes anterior</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight">
                        {variacionAbsoluta > 0 ? '+' : ''}
                        {variacionAbsoluta}
                      </span>
                      {variacionPct !== null && (
                        <span className="text-xs text-white/80">
                          ({variacionPct > 0 ? '+' : ''}
                          {variacionPct}%)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/80">
                      {evangelizadosAnterior === 0 && evangelizadosActual > 0
                        ? 'El mes pasado no hubo evangelizados'
                        : `${evangelizadosAnterior} el mes pasado`}
                    </p>
                  </div>
                </div>

                {/* KPI: tipo de evangelismo con más evangelizados este mes */}
                <div
                  className="flex items-center gap-4 rounded-2xl p-4 text-white shadow-lg"
                  style={{ backgroundColor: tipoMasFrecuente?.color ?? '#6B7280' }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-[11px] font-semibold tracking-wider text-white/80 uppercase">Tipo más frecuente</p>
                    {tipoMasFrecuente ? (
                      <>
                        <span className="text-3xl font-bold tracking-tight">{tipoMasFrecuente.nombre}</span>
                        <p className="text-[11px] text-white/80">
                          {tipoMasFrecuente.cantidad} de {evangelizadosActual} este mes
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-white/80">Sin clasificar todavía</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Metricas extra: desglose de evangelizados por tipo de evangelismo (1+1, Elite, Semilla...).
                Siempre muestra los mismos 3 chips del catálogo (con 0 si todavía no hay datos), para
                que el alto de la card no cambie cada vez que se agrega un evangelizado de un tipo nuevo. */}
            {tiposEvangelismo.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Por tipo</span>
                {porTipoEvangelismo.map((t) => (
                  <span
                    key={t.nombre}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `color-mix(in oklab, ${t.color} 14%, transparent)`, color: t.color }}
                  >
                    {t.nombre}
                    <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] font-bold">{t.cantidad}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={HeartHandshake}
            color={AMBAR}
            titulo="Evangelizados del mes"
            descripcion={`${evangelizados.length} en ${nombreMes(anio, mes)}`}
          />
          <div className="flex flex-col gap-3 p-5">
            {cargandoLista && <Skeleton className="h-40 w-full rounded-xl" />}
            {!cargandoLista && evangelizados.length === 0 && (
              <p className="text-sm text-muted-foreground">Nadie registrado todavía este mes.</p>
            )}
            {!cargandoLista && <EvangelismoTrendChart anio={anio} mes={mes} evangelizados={evangelizados} />}
            {/* Alto fijo con scroll propio: la lista no debe estirar la card entera
                cuando hay muchos evangelizados -- el resto del layout no se entera. */}
            {evangelizados.length > 0 && (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
                {evangelizados.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl px-1 py-1.5 text-sm hover:bg-muted/50">
                    <span className="min-w-0 truncate font-medium">{e.nombre_completo}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fechaLegible(e.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Calendario: qué días se salió a evangelizar, con el detalle de a quién se ganó ese día */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
          <TarjetaHeader
            icon={CalendarRange}
            color={AMBAR}
            titulo="Calendario de evangelismo"
            descripcion="Días en los que se registró al menos un evangelizado"
          />
          <div className="p-4">
            {cargandoLista ? (
              <Skeleton className="h-80 w-full rounded-2xl" />
            ) : (
              <CalendarioEvangelismo
                anio={anio}
                mes={mes}
                evangelizados={evangelizados}
                diaSeleccionado={diaSeleccionado}
                onSeleccionarDia={setDiaSeleccionado}
              />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader
            icon={HeartHandshake}
            color={AMBAR}
            titulo={diaSeleccionado ? fechaLegible(diaSeleccionado) : 'Resumen del mes'}
            descripcion={
              diaSeleccionado
                ? `${evangelizadosDelDiaSeleccionado.length} evangelizado${evangelizadosDelDiaSeleccionado.length === 1 ? '' : 's'}`
                : 'Lo más destacado y lo más reciente'
            }
            accion={
              diaSeleccionado && (
                <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs" onClick={() => setDiaSeleccionado(null)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Resumen
                </Button>
              )
            }
          />

          <div className="p-5">
          {diaSeleccionado ? (
            <div className="flex flex-col gap-2.5">
              {evangelizadosDelDiaSeleccionado.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nadie registrado este día.</p>
              ) : (
                evangelizadosDelDiaSeleccionado.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-sm">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in oklab, ${AMBAR} 15%, transparent)` }}>
                      <HeartHandshake className="h-3.5 w-3.5" style={{ color: AMBAR }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{e.nombre_completo}</p>
                      {e.domicilio && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {e.domicilio}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!mejorDia}
                  onClick={() => mejorDia && setDiaSeleccionado(mejorDia.fecha)}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition-colors enabled:hover:bg-accent/60 disabled:cursor-default"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 12%, transparent)` }}>
                    <Trophy className="h-4 w-4" style={{ color: AZUL }} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Mejor día</p>
                    {mejorDia ? (
                      <>
                        <span className="text-lg font-bold text-foreground">{mejorDia.cantidad}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          evangelizado{mejorDia.cantidad === 1 ? '' : 's'} · {fechaLegible(mejorDia.fecha)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </button>
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${MORADO} 12%, transparent)` }}>
                    <Flame className="h-4 w-4" style={{ color: MORADO }} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Racha este mes</p>
                    {rachaDias > 0 ? (
                      <>
                        <span className="text-lg font-bold text-foreground">
                          {rachaDias} día{rachaDias === 1 ? '' : 's'}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">seguidos con evangelismo</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Actividad reciente</p>
                {evangelizados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nadie registrado todavía este mes.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {evangelizados.slice(0, 4).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setDiaSeleccionado(e.fecha)}
                        className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0 truncate font-medium">{e.nombre_completo}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{fechaLegible(e.fecha)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </section>
      </div>

      {cdpActiva && (
        <NuevoEvangelizadoDialog
          open={dialogoAbierto}
          onOpenChange={setDialogoAbierto}
          iglesiaId={iglesiaActivaId}
          fechaInicial={aISO(hoy)}
          onCrear={(valores) =>
            crear.mutateAsync({
              casa_de_paz_id: cdpActiva,
              iglesia_id: iglesiaActivaId as string,
              fecha: valores.fecha,
              primer_nombre: valores.primer_nombre,
              primer_apellido: valores.primer_apellido,
              sexo: valores.sexo,
              domicilio: valores.domicilio || undefined,
              telefono: valores.telefono || undefined,
              tipo_evangelismo_id: valores.tipo_evangelismo_id,
            })
          }
        />
      )}
    </div>
  );
}
