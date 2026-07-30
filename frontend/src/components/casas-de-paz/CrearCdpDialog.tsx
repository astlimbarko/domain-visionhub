import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCiudades } from '@/hooks/useCasasDePaz';
import { BuscadorPersona } from './BuscadorPersona';
import { DIAS_SEMANA } from './EditarReunionCdpDialog';
import type { DatosNuevaCdp, PersonaBusqueda } from '@/types/casas-de-paz.types';

const SIN_DIA = 'SIN_DIA';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redNombre: string | undefined;
  iglesiaId: string | undefined;
  creando: boolean;
  onCrear: (datos: DatosNuevaCdp) => void;
}

function SelectorPersona({
  label,
  iglesiaId,
  persona,
  excluirIds,
  onSeleccionar,
  onQuitar,
}: {
  label: string;
  iglesiaId: string | undefined;
  persona: PersonaBusqueda | undefined;
  excluirIds: string[];
  onSeleccionar: (p: PersonaBusqueda) => void;
  onQuitar: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {persona ? (
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
          {persona.nombre_completo}
          <Button type="button" variant="ghost" size="icon" onClick={onQuitar} aria-label="Quitar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <BuscadorPersona iglesiaId={iglesiaId} excluirIds={excluirIds} onSeleccionar={onSeleccionar} />
      )}
    </div>
  );
}

/**
 * Al crear una Casa de Paz se pide directamente quién la lidera (y de paso
 * sublíder/anfitrión y lugar de reunión) en vez de un nombre manual: sin
 * líder la etiqueta de la CdP cae en "Casa de Paz sin líder"
 * (fn_etiqueta_cdp), así que quedaba huérfana hasta que alguien se acordaba
 * de asignarla después desde el menú "…".
 */
export function CrearCdpDialog({ open, onOpenChange, redNombre, iglesiaId, creando, onCrear }: Props) {
  const [lider, setLider] = useState<PersonaBusqueda>();
  const [sublideres, setSublideres] = useState<PersonaBusqueda[]>([]);
  const [anfitrion, setAnfitrion] = useState<PersonaBusqueda>();
  const [dia, setDia] = useState<string>(SIN_DIA);
  const [hora, setHora] = useState('');
  const [ciudadId, setCiudadId] = useState('');
  const [zona, setZona] = useState('');
  const [calle, setCalle] = useState('');
  const [numero, setNumero] = useState('');
  const [referencia, setReferencia] = useState('');
  const [urlGps, setUrlGps] = useState('');

  const { data: ciudades = [], isLoading: cargandoCiudades } = useCiudades();

  // Se resetea al abrir, no al enviar -- si el backend rechaza la creacion,
  // el dialogo se queda abierto y lo ya cargado no se debe perder.
  useEffect(() => {
    if (open) {
      setLider(undefined);
      setSublideres([]);
      setAnfitrion(undefined);
      setDia(SIN_DIA);
      setHora('');
      setCiudadId('');
      setZona('');
      setCalle('');
      setNumero('');
      setReferencia('');
      setUrlGps('');
    }
  }, [open]);

  // Nadie puede ocupar dos de estos roles a la vez en la misma Casa de Paz nueva.
  const idsOcupados = [lider?.id, anfitrion?.id, ...sublideres.map((s) => s.id)].filter((id): id is string => !!id);

  function handleCrear() {
    if (!lider) return;
    onCrear({
      liderId: lider.id,
      sublideresIds: sublideres.map((s) => s.id),
      anfitrionId: anfitrion?.id,
      diaReunion: dia === SIN_DIA ? null : Number(dia),
      horaReunion: hora || null,
      domicilio: ciudadId
        ? {
            ciudadId,
            zona: zona.trim() || null,
            calle: calle.trim() || null,
            numero: numero.trim() || null,
            referencia: referencia.trim() || null,
            url_gps: urlGps.trim() || null,
          }
        : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva Casa de Paz</DialogTitle>
          <DialogDescription>En la red {redNombre}. Se identifica por el nombre de su líder.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
          <div className="flex flex-col gap-3">
            <SelectorPersona
              label="Líder *"
              iglesiaId={iglesiaId}
              persona={lider}
              excluirIds={idsOcupados}
              onSeleccionar={setLider}
              onQuitar={() => setLider(undefined)}
            />

            <div className="flex flex-col gap-1.5">
              <Label>Sublíderes (opcional)</Label>
              {sublideres.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {sublideres.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                      {s.nombre_completo}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSublideres((prev) => prev.filter((p) => p.id !== s.id))}
                        aria-label="Quitar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <BuscadorPersona iglesiaId={iglesiaId} excluirIds={idsOcupados} onSeleccionar={(p) => setSublideres((prev) => [...prev, p])} />
            </div>

            <SelectorPersona
              label="Anfitrión (opcional)"
              iglesiaId={iglesiaId}
              persona={anfitrion}
              excluirIds={idsOcupados}
              onSeleccionar={setAnfitrion}
              onQuitar={() => setAnfitrion(undefined)}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground">Reunión (opcional)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nueva_cdp_dia">Día de la semana</Label>
                <Select value={dia} onValueChange={setDia}>
                  <SelectTrigger id="nueva_cdp_dia" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_DIA}>Sin definir</SelectItem>
                    {DIAS_SEMANA.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nueva_cdp_hora">Hora</Label>
                <Input id="nueva_cdp_hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground">Dirección de reunión (opcional)</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nueva_cdp_ciudad">Ciudad</Label>
              <Select value={ciudadId} onValueChange={setCiudadId}>
                <SelectTrigger id="nueva_cdp_ciudad" className="w-full">
                  <SelectValue placeholder={cargandoCiudades ? 'Cargando...' : 'Elegí una ciudad'} />
                </SelectTrigger>
                <SelectContent>
                  {ciudades.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ciudadId && (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nueva_cdp_zona">Zona o barrio</Label>
                    <Input id="nueva_cdp_zona" value={zona} onChange={(e) => setZona(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nueva_cdp_numero">Número de casa</Label>
                    <Input id="nueva_cdp_numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nueva_cdp_calle">Calle o avenida</Label>
                  <Input id="nueva_cdp_calle" value={calle} onChange={(e) => setCalle(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nueva_cdp_referencia">Referencia</Label>
                  <Textarea
                    id="nueva_cdp_referencia"
                    rows={2}
                    placeholder="Ej. Portón verde, frente a la plaza"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nueva_cdp_gps">Enlace de ubicación (Google Maps)</Label>
                  <Input
                    id="nueva_cdp_gps"
                    type="url"
                    inputMode="url"
                    placeholder="https://maps.app.goo.gl/…"
                    value={urlGps}
                    onChange={(e) => setUrlGps(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleCrear} disabled={creando || !lider}>
            {creando ? 'Creando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
