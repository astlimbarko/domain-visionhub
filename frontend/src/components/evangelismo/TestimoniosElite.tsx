import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { EVANGELISMO_COLOR } from '@/utils/evangelismo-colores';
import { useCrearTestimonioEvangelismo, useEvangelizadosElite, useTestimoniosEvangelismo } from '@/hooks/useEvangelismo';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { fechaLegible } from '@/utils/calendario-fechas';

const AMARILLO = EVANGELISMO_COLOR.AMARILLO;

interface Props {
  casaDePazId: string;
  iglesiaId: string;
}

/**
 * Pestaña "Testimonios Elite" (2026-09-10, pedido del owner): milagros o
 * testimonios en texto libre, solo para evangelizados registrados con tipo
 * Elite en esta Casa de Paz -- no hay distinción milagro/testimonio (una
 * sola entrada) y una vez cargado no se edita ni se borra (registro
 * histórico, ver evangelismo_testimonio.sql). Mismo permiso de carga que el
 * resto de Evangelismo (Líder y Sublíder de la CdP).
 */
export function TestimoniosElite({ casaDePazId, iglesiaId }: Props) {
  const { data: elegibles = [], isLoading: cargandoElegibles } = useEvangelizadosElite(casaDePazId);
  const { data: testimonios = [], isLoading: cargandoTestimonios } = useTestimoniosEvangelismo(casaDePazId);
  const crear = useCrearTestimonioEvangelismo(casaDePazId);

  const [evangelismoId, setEvangelismoId] = useState('');
  const [texto, setTexto] = useState('');

  async function guardar() {
    if (!evangelismoId || !texto.trim()) return;
    try {
      await crear.mutateAsync({ casa_de_paz_id: casaDePazId, iglesia_id: iglesiaId, evangelismo_id: evangelismoId, texto: texto.trim() });
      toast.success('Testimonio guardado');
      setEvangelismoId('');
      setTexto('');
    } catch {
      toast.error('No se pudo guardar el testimonio');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Sparkles}
          color={AMARILLO}
          titulo="Cargar testimonio"
          descripcion="Solo evangelizados de tipo Elite"
        />
        <div className="flex flex-col gap-4 p-5">
          {cargandoElegibles ? (
            <Skeleton className="h-10 w-full rounded-xl" />
          ) : elegibles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay evangelizados de tipo Elite en esta Casa de Paz.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Evangelizado
                </Label>
                <Select value={evangelismoId} onValueChange={setEvangelismoId}>
                  <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                    <SelectValue placeholder="Elegí a quién" />
                  </SelectTrigger>
                  <SelectContent>
                    {elegibles.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nombre_completo} · {fechaLegible(e.fecha)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Milagro o testimonio
                </Label>
                <Textarea
                  className={CAMPO_ESTILO}
                  rows={5}
                  placeholder="Contá lo que pasó..."
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
              </div>
              <Button
                className="gap-2 rounded-xl"
                onClick={guardar}
                disabled={!evangelismoId || !texto.trim() || crear.isPending}
              >
                {crear.isPending && <Spinner className="h-4 w-4" />}
                Guardar testimonio
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card lg:col-span-2">
        <TarjetaHeader
          icon={Sparkles}
          color={AMARILLO}
          titulo="Testimonios cargados"
          descripcion={`${testimonios.length} en total`}
        />
        <div className="flex flex-col gap-3 p-5">
          {cargandoTestimonios ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : testimonios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se cargó ningún testimonio.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {testimonios.map((t) => (
                <div key={t.id} className="flex flex-col gap-1.5 rounded-xl border border-border/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    {t.persona_id ? (
                      <PersonaNombreLink personaId={t.persona_id} className="min-w-0 truncate text-sm font-semibold">
                        {t.nombre_completo}
                      </PersonaNombreLink>
                    ) : (
                      <span className="truncate text-sm font-semibold text-foreground">{t.nombre_completo}</span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">{fechaLegible(t.fecha_creacion.slice(0, 10))}</span>
                  </div>
                  <p className="text-sm text-foreground/90">{t.texto}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
