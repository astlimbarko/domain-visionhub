import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Target, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

  if (cargandoCasas) return <Skeleton className="h-96 w-full" />;

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
        <Button onClick={() => setDialogoAbierto(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo evangelizado
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Tasa de evangelismo
            </CardTitle>
            {tasa?.origen && (
              <CardDescription>Meta {tasa.origen === 'ASIGNADA' ? 'asignada por un rol superior' : 'propia'}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {cargandoTasa ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-foreground">{tasa?.evangelizados ?? 0}</span>
                  <span className="text-muted-foreground">
                    {tasa?.meta != null ? `de ${tasa.meta} evangelizados` : 'sin meta definida'}
                  </span>
                </div>
                {tasa?.meta != null && (
                  <>
                    <Progress value={porcentaje} />
                    <p className="text-sm text-muted-foreground">{tasa.tasa}% de la meta {tasa.tasa && tasa.tasa > 100 ? '(superada)' : ''}</p>
                  </>
                )}
              </>
            )}

            {tasa?.origen !== 'ASIGNADA' && (
              <div className="mt-2 flex items-end gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meta_propia">Mi meta para este mes</Label>
                  <Input
                    id="meta_propia"
                    type="number"
                    min={1}
                    className="w-32"
                    placeholder={String(tasa?.meta ?? '')}
                    value={metaLocal}
                    onChange={(e) => setMetaLocal(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={guardarMeta} disabled={actualizarMeta.isPending}>
                  Guardar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartHandshake className="h-4 w-4" />
              Evangelizados del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {cargandoLista && <Skeleton className="h-40 w-full" />}
            {!cargandoLista && evangelizados.length === 0 && (
              <p className="text-sm text-muted-foreground">Nadie registrado todavía este mes.</p>
            )}
            {evangelizados.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span>{e.nombre_completo}</span>
                <span className="text-muted-foreground">{e.fecha}</span>
              </div>
            ))}
          </CardContent>
        </Card>
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
