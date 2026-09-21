import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, DollarSign, PartyPopper, Pencil, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { MORADO, TEAL } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import { useMonedasActivas } from '@/hooks/usePanelSupervisor';
import {
  useActualizarDetalleMegafiesta,
  useDesgloseMegafiesta,
  useDetalleMegafiesta,
  useLibros,
  useMegafiestasRed,
  useTemas,
} from '@/hooks/useReporte';
import { rutaReporteEditar } from '@/utils/constants';
import { fechaLegibleConDia } from '@/utils/calendario-fechas';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';

interface Props {
  redId: string;
}

/**
 * KAN-409: "Megafiestas de Casa de Paz" -- consolidado automático por Red,
 * dentro del área de Reportes del Líder de Red (se monta debajo de
 * ControlReportesVista en la página ControlReportes). Cada fila es un
 * `evento` tipo MEGA_FIESTA -- se actualiza sola a medida que las Casas de
 * Paz reportan (useMegafiestasRed/useDesgloseMegafiesta, sin polling: se
 * invalida por React Query cuando useCrearReporteMegafiesta tiene éxito).
 */
export function MegafiestasRedVista({ redId }: Props) {
  const { data: megafiestas = [], isLoading } = useMegafiestasRed(redId);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <TarjetaHeader
        icon={PartyPopper}
        color={MORADO}
        titulo="Megafiestas de Casa de Paz"
        descripcion="Consolidado automático de asistencia por Red -- se actualiza solo a medida que cada CdP reporta"
      />
      <div className="flex flex-col gap-2 p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : megafiestas.length === 0 ? (
          <ProximamentePlaceholder
            titulo="Todavía no hubo Megafiestas"
            descripcion="Cuando alguna Casa de Paz de esta Red reporte una Megafiesta, o vos programes una desde el Calendario, va a aparecer acá con el consolidado."
          />
        ) : (
          megafiestas.map((m) => {
            const abierto = expandidoId === m.evento_id;
            return (
              <div key={m.evento_id} className="overflow-hidden rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setExpandidoId(abierto ? null : m.evento_id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in oklab, ${MORADO} 14%, transparent)`, color: MORADO }}
                  >
                    <PartyPopper className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{conMayusInicial(fechaLegibleConDia(m.fecha))}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.cantidadCdpReportaron} Casa{m.cantidadCdpReportaron === 1 ? '' : 's'} de Paz reportó{m.cantidadCdpReportaron === 1 ? '' : 'ron'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `color-mix(in oklab, ${MORADO} 14%, transparent)`, color: MORADO }}>
                    <Users className="h-3 w-3" />
                    {m.totalAsistentes}
                  </div>
                  {abierto ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                {abierto && <MegafiestaDetalleExpandido eventoId={m.evento_id} redId={redId} />}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

/** `capitalize` de CSS pone mayúscula a cada palabra -- esto solo a la primera letra (mismo helper que HistorialReportesCalendario). */
function conMayusInicial(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function MegafiestaDetalleExpandido({ eventoId, redId: _redId }: { eventoId: string; redId: string }) {
  const navigate = useNavigate();
  const { data: desglose = [], isLoading: cargandoDesglose } = useDesgloseMegafiesta(eventoId, true);
  const total = desglose.reduce((suma, d) => suma + d.total_asistentes, 0);

  return (
    <div className="flex flex-col gap-4 border-t border-border/60 bg-muted/20 p-3">
      {/* Desglose por CdP -- "CdP Daniel — 14 personas", navega al detalle del
          reporte de esa CdP (misma pantalla/permiso que ya usa Control de
          Reportes para "ver un reporte puntual"). */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Desglose por Casa de Paz</p>
        {cargandoDesglose ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : desglose.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">Ninguna Casa de Paz reportó todavía.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {desglose.map((d) => (
              <button
                key={d.reporte_id}
                type="button"
                onClick={() => navigate(rutaReporteEditar(d.reporte_id))}
                className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm hover:bg-muted/50"
                title="Ver lista de asistentes de este reporte"
              >
                <span className="truncate font-medium">{d.casa_de_paz_nombre}</span>
                <span className="shrink-0 text-muted-foreground">{d.total_asistentes} persona{d.total_asistentes === 1 ? '' : 's'}</span>
              </button>
            ))}
            <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: `color-mix(in oklab, ${MORADO} 10%, transparent)`, color: MORADO }}>
              <span>Total</span>
              <span>{total} persona{total === 1 ? '' : 's'}</span>
            </div>
          </div>
        )}
      </div>

      <MegafiestaDatosGenerales eventoId={eventoId} />
    </div>
  );
}

/**
 * KAN-409 (punto 5 del ticket): el Líder de Red completa Tema y Finanzas UNA
 * sola vez desde acá, no por cada CdP. Testimonio queda simplemente presente
 * y opcional -- a propósito no se impone quién debe registrarlo (pedido
 * explícito: no inventar esa responsabilidad).
 */
function MegafiestaDatosGenerales({ eventoId }: { eventoId: string }) {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const [editando, setEditando] = useState(false);
  const { data: detalle, isLoading } = useDetalleMegafiesta(eventoId, true);
  const { data: libros = [] } = useLibros();
  const { data: monedas = [] } = useMonedasActivas(iglesiaActivaId);
  const actualizar = useActualizarDetalleMegafiesta(eventoId);

  const [libroId, setLibroId] = useState<string | undefined>(undefined);
  const [temaId, setTemaId] = useState<string | undefined>(undefined);
  const [totalOfrendas, setTotalOfrendas] = useState('');
  const [monedaId, setMonedaId] = useState<string | undefined>(undefined);
  const [testimonios, setTestimonios] = useState('');
  const { data: temas = [] } = useTemas(libroId, iglesiaActivaId);

  function abrirEdicion() {
    setLibroId(detalle?.libro_id ?? undefined);
    setTemaId(detalle?.tema_id ?? undefined);
    setTotalOfrendas(detalle?.total_ofrendas != null ? String(detalle.total_ofrendas) : '');
    setMonedaId(detalle?.moneda_id ?? monedas[0]?.moneda_id);
    setTestimonios(detalle?.testimonios ?? '');
    setEditando(true);
  }

  async function guardar() {
    try {
      await actualizar.mutateAsync({
        libro_id: libroId ?? null,
        tema_id: temaId ?? null,
        total_ofrendas: totalOfrendas ? Number(totalOfrendas) : null,
        moneda_id: monedaId ?? null,
        testimonios: testimonios.trim() || null,
      });
      setEditando(false);
    } catch {
      // El botón queda habilitado para reintentar -- sin toast propio para no
      // sumar una dependencia nueva a este componente chico.
    }
  }

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;

  if (!editando) {
    const libro = libros.find((l) => l.id === detalle?.libro_id);
    const moneda = monedas.find((m) => m.moneda_id === detalle?.moneda_id);
    const hayDatos = !!(detalle?.tema_id || detalle?.total_ofrendas || detalle?.testimonios);
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Datos generales</p>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 rounded-lg px-2 text-xs" onClick={abrirEdicion}>
            <Pencil className="h-3 w-3" />
            {hayDatos ? 'Editar' : 'Completar'}
          </Button>
        </div>
        {hayDatos ? (
          <div className="flex flex-col gap-1 text-sm">
            {libro && <p>Libro {libro.numero} — {libro.nombre}</p>}
            {detalle?.total_ofrendas != null && (
              <p className="flex items-center gap-1.5" style={{ color: TEAL }}>
                <DollarSign className="h-3.5 w-3.5" />
                {moneda?.simbolo ?? ''} {detalle.total_ofrendas}
              </p>
            )}
            {detalle?.testimonios && <p className="text-muted-foreground">"{detalle.testimonios}"</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Todavía no se completó el tema ni las finanzas de esta Megafiesta.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-3">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Datos generales</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Libro</label>
          <Select value={libroId ?? ''} onValueChange={(v) => { setLibroId(v); setTemaId(undefined); }}>
            <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {libros.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  Libro {l.numero} — {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Tema</label>
          <Select value={temaId ?? ''} onValueChange={setTemaId} disabled={!libroId}>
            <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {temas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Total ofrendas</label>
          <Input type="number" step="0.01" min="0" className={CAMPO_ESTILO} value={totalOfrendas} onChange={(e) => setTotalOfrendas(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Moneda</label>
          <Select value={monedaId ?? ''} onValueChange={setMonedaId}>
            <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {monedas.map((m) => (
                <SelectItem key={m.moneda_id} value={m.moneda_id}>
                  {m.simbolo} {m.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Testimonio (opcional)</label>
        <Textarea
          className={CAMPO_ESTILO}
          rows={3}
          value={testimonios}
          onChange={(e) => setTestimonios(e.target.value)}
          placeholder="Lo que Dios hizo en esta Megafiesta"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" className="h-8 rounded-lg" disabled={actualizar.isPending} onClick={guardar}>
          {actualizar.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
