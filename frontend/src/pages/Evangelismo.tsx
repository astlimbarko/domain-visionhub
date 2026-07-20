import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Target, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import {
  useActualizarMetaPropia,
  useCrearEvangelizado,
  useEvangelizados,
  useTasaEvangelismo,
} from '@/hooks/useEvangelismo';
import { NuevoEvangelizadoDialog } from '@/components/evangelismo/NuevoEvangelizadoDialog';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { aISO, nombreMes } from '@/utils/calendario-fechas';

export function Evangelismo() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [metaLocal, setMetaLocal] = useState<string>('');

  const desde = aISO(new Date(anio, mes, 1));
  const hasta = aISO(new Date(anio, mes + 1, 0));

  const { data: tasa, isLoading: cargandoTasa } = useTasaEvangelismo(cdpActiva, desde, hasta);
  const { data: evangelizados = [], isLoading: cargandoLista } = useEvangelizados(cdpActiva, desde, hasta);
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

  async function guardarMeta() {
    const valor = metaLocal.trim() === '' ? null : Number(metaLocal);
    try {
      await actualizarMeta.mutateAsync(valor);
    } catch {
      // el toast lo maneja el llamador si hace falta; el input vuelve a su valor real en el proximo fetch
    }
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
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Nuevo evangelizado
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="glass-card-elevated rounded-2xl p-6 lg:col-span-2">
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" />
              Tasa de evangelismo
            </h3>
            {tasa?.origen && (
              <p className="mt-0.5 text-xs text-muted-foreground">Meta {tasa.origen === 'ASIGNADA' ? 'asignada por un rol superior' : 'propia'}</p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {cargandoTasa ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-foreground">{tasa?.evangelizados ?? 0}</span>
                  <span className="text-sm text-muted-foreground">
                    {tasa?.meta != null ? `de ${tasa.meta} evangelizados` : 'sin meta definida'}
                  </span>
                </div>
                {tasa?.meta != null && (
                  <>
                    <Progress value={porcentaje} className="h-2 rounded-full" />
                    <p className="text-xs text-muted-foreground">{tasa.tasa}% de la meta {tasa.tasa && tasa.tasa > 100 ? '(superada)' : ''}</p>
                  </>
                )}
              </>
            )}

            {tasa?.origen !== 'ASIGNADA' && (
              <div className="mt-3 flex items-end gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meta_propia" className="text-xs text-muted-foreground">Mi meta para este mes</Label>
                  <Input
                    id="meta_propia"
                    type="number"
                    min={1}
                    className="h-9 w-28 rounded-xl border-border/60 bg-muted/40 text-sm"
                    placeholder={String(tasa?.meta ?? '')}
                    value={metaLocal}
                    onChange={(e) => setMetaLocal(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="h-9 rounded-xl" onClick={guardarMeta} disabled={actualizarMeta.isPending}>
                  Guardar
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card-elevated rounded-2xl p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <HeartHandshake className="h-4 w-4 text-chart-2" />
            Evangelizados del mes
          </h3>
          <div className="flex flex-col gap-2">
            {cargandoLista && <Skeleton className="h-40 w-full rounded-xl" />}
            {!cargandoLista && evangelizados.length === 0 && (
              <p className="text-sm text-muted-foreground">Nadie registrado todavía este mes.</p>
            )}
            {evangelizados.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{e.nombre_completo}</span>
                <span className="text-xs text-muted-foreground">{e.fecha}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {cdpActiva && (
        <NuevoEvangelizadoDialog
          open={dialogoAbierto}
          onOpenChange={setDialogoAbierto}
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
            })
          }
        />
      )}
    </div>
  );
}
