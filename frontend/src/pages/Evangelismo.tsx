import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  MapPin,
  Network,
  Plus,
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
import { TarjetaHeader, GRADIENTE_HERO, DEGRADADO_IDENTIDAD, HeroDato } from '@/components/shared/SeccionPerfil';
import { DescargarPdfButton } from '@/components/shared/DescargarPdfButton';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { esMetaAsignada, quienAsignoMeta } from '@/utils/evangelismo-meta';
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
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { EvangelismoTrendChart } from '@/components/evangelismo/EvangelismoTrendChart';
import { CalendarioEvangelismo } from '@/components/evangelismo/CalendarioEvangelismo';
import { EvangelismoRed } from '@/components/evangelismo/EvangelismoRed';
import { EvangelismoSupervisorVista } from '@/components/evangelismo/EvangelismoSupervisorVista';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO, fechaLegible, nombreMes } from '@/utils/calendario-fechas';

// Paleta exacta pedida por el owner (2026-08-02), con hex propios para el
// módulo -- ver `evangelismo-colores.ts`. Un color por sección para que se
// distingan a simple vista, no un solo tono repetido en toda la pantalla.
const { AZUL, VERDE, NARANJA, AMARILLO, CELESTE } = EVANGELISMO_COLOR;

export function Evangelismo() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const rolUI = useRolUI();
  // El sublíder ve Evangelismo en modo solo lectura -- no puede registrar
  // evangelizados ni tocar la meta propia (decisión del owner, 2026-07-31).
  const esSublider = rolUI === 'SUBLIDER_CDP';
  const { data: roles } = useMisRoles(iglesiaActivaId);

  const { data: misCasasCrudo, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  // Mismo filtro que GestionSubliderVista.tsx: si la persona es Líder de una
  // CdP y Sublíder de otra a la vez, esta vista se acota a la que corresponde
  // al "sombrero" activo -- sin esto, el selector mezclaba ambas CdP y
  // "esSublider" (flag global) quedaba mal aplicado a la CdP ajena.
  const misCasas = useMemo(() => {
    if (!misCasasCrudo) return misCasasCrudo;
    if (rolUI !== 'LIDER_CDP' && rolUI !== 'SUBLIDER_CDP') return misCasasCrudo;
    const idsPropios = new Set((rolUI === 'LIDER_CDP' ? roles?.cdp_lider : roles?.cdp_sublider)?.map((c) => c.id) ?? []);
    return misCasasCrudo.filter((c) => idsPropios.has(c.casa_de_paz_id));
  }, [misCasasCrudo, rolUI, roles]);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;
  const contenedorRef = useRef<HTMLDivElement>(null);

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

  // Variación vs. mes anterior: si el mes anterior tuvo 0, un % no dice nada,
  // así que ese caso se muestra como "nuevo" en vez de un porcentaje engañoso.
  const evangelizadosActual = tasa?.evangelizados ?? 0;
  const evangelizadosAnterior = tasaAnterior?.evangelizados ?? 0;
  const variacionAbsoluta = evangelizadosActual - evangelizadosAnterior;
  const variacionPct = evangelizadosAnterior > 0 ? Math.round((variacionAbsoluta / evangelizadosAnterior) * 100) : null;

  // Mientras la meta de la Red esté vigente y todavía no se haya alcanzado,
  // la meta propia queda bloqueada (pedido del owner, 2026-08-03) -- el
  // backend ya lo hace cumplir (trg_bloquear_meta_propia_bajo_asignada,
  // migración 93), esto solo refleja la misma regla en la UI.
  const metaAsignadaCumplida = esMetaAsignada(tasa?.origen) && tasa?.meta != null && evangelizadosActual >= tasa.meta;
  const metaAsignadaBloqueando = esMetaAsignada(tasa?.origen) && !metaAsignadaCumplida;

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
    const redActiva = roles.redes_lider?.[0];
    if (!redActiva) {
      return (
        <ProximamentePlaceholder
          titulo="Evangelismo"
          descripcion="Todavía no tenés una Red asignada como líder, así que no hay evangelismo que mostrar."
        />
      );
    }
    return <EvangelismoRed redId={redActiva.id} />;
  }

  // El Supervisor no lidera/sublidera ninguna Casa de Paz ni Red propia --
  // ve el mismo diseño que el Líder de Red pero pudiendo elegir cualquier
  // Red de la iglesia, y con el poder extra de asignarle una meta propia a
  // la Red (pedido del owner, 2026-08-06, ver EvangelismoRed.tsx).
  if (rolUI === 'SUPERVISOR') return <EvangelismoSupervisorVista />;

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
  const cdpNombreActiva = misCasas.find((c) => c.casa_de_paz_id === cdpActiva)?.nombre;

  return (
    <div ref={contenedorRef} className="flex flex-col gap-6">
      {/* Mismo encabezado "Hero" que Perfil de Casa de Paz (GestionSubliderVista.tsx)
          -- pedido del owner, 2026-08-02: las páginas de la vista de Sublíder/Líder
          de CdP deben verse como parte de la misma sección, no como pantallas sueltas. */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-[var(--brand-navy)]/25 sm:p-8"
        style={{ background: GRADIENTE_HERO }}
      >
        <div className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-black/25" style={{ background: DEGRADADO_IDENTIDAD }}>
                <HeartHandshake className="h-8 w-8 text-white" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-white/60">Evangelismo</span>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{cdpNombreActiva ?? 'Casa de Paz'}</h1>
              </div>
            </div>
            {!esSublider && (
              <Button
                onClick={() => setDialogoAbierto(true)}
                className="h-10 shrink-0 gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-white backdrop-blur-sm hover:bg-white/20"
              >
                <Plus className="h-4 w-4" />
                Nuevo evangelizado
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-3">
            <HeroDato icon={CalendarRange} label="Mes" valor={nombreMes(anio, mes)} />
            <HeroDato icon={Target} label="Evangelizados" valor={String(evangelizadosActual)} />
            <HeroDato
              icon={Flag}
              label="Meta"
              valor={
                tasa?.meta != null ? (
                  <span className="flex items-center gap-2">
                    {tasa.meta}
                    {/* Antes esto solo se distinguía en una nota chica más abajo -- el
                        owner reportó que a simple vista no se notaba que la meta no era
                        propia (2026-08-03). Este badge la hace visible de un vistazo. */}
                    {esMetaAsignada(tasa.origen) && (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/90 uppercase backdrop-blur-sm">
                        {quienAsignoMeta(tasa.origen)}
                      </span>
                    )}
                  </span>
                ) : (
                  'Sin definir'
                )
              }
              dot={tasa?.meta != null ? 'var(--chart-4)' : undefined}
              valorClase={tasa?.meta != null ? 'text-[var(--chart-4)]' : 'text-white/70'}
            />
          </div>
        </div>
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
        <DescargarPdfButton contenedorRef={contenedorRef} nombreArchivo="evangelismo" className="ml-auto" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
          <TarjetaHeader
            icon={Target}
            color={AMARILLO}
            titulo="Tasa de evangelismo"
            descripcion={tasa?.origen ? `Meta ${esMetaAsignada(tasa.origen) ? 'asignada por un rol superior' : 'propia'}` : 'Seguimiento del mes'}
          />
          <div className="flex flex-col gap-4 p-6">
            {cargandoTasa ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : (
              <>
                {/* Un solo número que mirar: cuántos evangelizados hay este mes, contra la
                    meta que esté rigiendo (asignada si hay, si no la propia), y cómo viene
                    vs. el mes pasado. Antes eran 5 cards grandes de igual peso visual --
                    nadie sabía cuál mirar primero. */}
                <KpiCard
                  icon={Target}
                  color={AMARILLO}
                  titulo="Evangelizados este mes"
                  valor={evangelizadosActual}
                  porcentaje={tasa?.meta != null ? porcentaje : null}
                  variacionPct={variacionPct}
                  subtitulo={
                    tasa?.meta != null
                      ? `${tasa.tasa}% de la meta de ${tasa.meta} · ${evangelizadosAnterior} el mes pasado`
                      : `Sin meta definida · ${evangelizadosAnterior} el mes pasado`
                  }
                />

                {/* Dos cards separadas en vez de una sola fila con una nota chica --
                    el owner reportó que así no se distinguía bien cuál meta manda
                    (2026-08-03). "Vigente" marca cuál de las dos rige el % de arriba;
                    son mutuamente excluyentes en la BD (fn_meta_efectiva), nunca las
                    dos a la vez. */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    className="flex flex-col gap-2.5 rounded-xl border px-4 py-3"
                    style={
                      tasa?.origen === 'PROPIA'
                        ? { borderColor: 'color-mix(in oklab, var(--chart-4) 40%, transparent)', background: 'color-mix(in oklab, var(--chart-4) 6%, transparent)' }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                        <Flag className="h-3.5 w-3.5 shrink-0" /> Meta propia
                      </span>
                      {tasa?.origen === 'PROPIA' && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase" style={{ background: 'color-mix(in oklab, var(--chart-4) 16%, transparent)', color: 'var(--chart-4)' }}>
                          Vigente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="meta_propia"
                        type="number"
                        min={1}
                        className="h-8 w-20 rounded-lg text-sm"
                        placeholder="Sin definir"
                        value={metaLocal}
                        onChange={(e) => setMetaLocal(e.target.value)}
                        disabled={esSublider || metaAsignadaBloqueando}
                      />
                      {!esSublider && (
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={guardarMeta} disabled={actualizarMeta.isPending || metaAsignadaBloqueando}>
                          {actualizarMeta.isPending && <Spinner className="h-3.5 w-3.5" />}
                          Guardar
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {metaAsignadaBloqueando
                        ? 'Bloqueada hasta cumplir la meta de la Red (mirá la card de al lado).'
                        : 'La que vos definiste para tu Casa de Paz.'}
                    </p>
                  </div>

                  <div
                    className="flex flex-col gap-2.5 rounded-xl border px-4 py-3"
                    style={
                      esMetaAsignada(tasa?.origen)
                        ? { borderColor: 'color-mix(in oklab, var(--chart-4) 40%, transparent)', background: 'color-mix(in oklab, var(--chart-4) 6%, transparent)' }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                        <Network className="h-3.5 w-3.5 shrink-0" /> Meta de la Red
                      </span>
                      {esMetaAsignada(tasa?.origen) && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase" style={{ background: 'color-mix(in oklab, var(--chart-4) 16%, transparent)', color: 'var(--chart-4)' }}>
                          Vigente
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      {esMetaAsignada(tasa?.origen) ? tasa?.meta : '—'}
                    </p>
                    {esMetaAsignada(tasa?.origen) && tasa?.meta != null ? (
                      <>
                        {/* Barra + "faltan N": el nuevo candado de la meta propia depende
                            de esto, así que la card tiene que explicar por sí sola qué
                            falta para destrabarla, no solo mostrar el número (2026-08-03). */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-[width]"
                            style={{ width: `${Math.min(100, Math.round((evangelizadosActual / tasa.meta) * 100))}%`, background: metaAsignadaCumplida ? VERDE : 'var(--chart-4)' }}
                          />
                        </div>
                        <p className="text-[11px] font-medium" style={{ color: metaAsignadaCumplida ? VERDE : 'var(--chart-4)' }}>
                          {metaAsignadaCumplida
                            ? '¡Meta cumplida! Ya podés editar tu meta propia.'
                            : `${evangelizadosActual} de ${tasa.meta} -- faltan ${tasa.meta - evangelizadosActual} para poder editar la propia.`}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Tu líder de red no asignó una meta para este período.</p>
                    )}
                  </div>
                </div>
              </>
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
            color={VERDE}
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
                    <PersonaNombreLink personaId={e.persona_id} className="min-w-0 truncate font-medium">{e.nombre_completo}</PersonaNombreLink>
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
            color={CELESTE}
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
            color={AZUL}
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
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in oklab, ${AZUL} 15%, transparent)` }}>
                      <HeartHandshake className="h-3.5 w-3.5" style={{ color: AZUL }} />
                    </div>
                    <div className="min-w-0">
                      <PersonaNombreLink personaId={e.persona_id} className="font-medium">{e.nombre_completo}</PersonaNombreLink>
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
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${NARANJA} 12%, transparent)` }}>
                    <Flame className="h-4 w-4" style={{ color: NARANJA }} />
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
