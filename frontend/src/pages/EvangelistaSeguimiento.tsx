import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MapPin, MessageCircle, Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { EvangelistaSubHeader } from '@/components/evangelista/EvangelistaSubHeader';
import { useHistorialSeguimiento, useRegistrarSeguimiento } from '@/hooks/useEvangelistaPersonal';
import { EVANGELISTA_COLOR } from '@/utils/evangelista-colores';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/utils/constants';
import type { MedioSeguimiento } from '@/types/evangelista-personal.types';

const ICONO_MEDIO: Record<MedioSeguimiento, typeof MessageCircle> = {
  WHATSAPP: MessageCircle,
  LLAMADA: Phone,
  VISITA: MapPin,
};

const ETIQUETA_MEDIO: Record<MedioSeguimiento, string> = {
  WHATSAPP: 'WhatsApp',
  LLAMADA: 'Llamada',
  VISITA: 'Visita',
};

/**
 * KAN-432: historial de contactos de una persona evangelizada + registrar
 * uno nuevo. Sin mockup definitivo (requirements.md lo dejó para esta etapa,
 * "se define en la fase de technical design, con UI v2") -- pantalla propia
 * siguiendo el mismo lenguaje visual del resto del módulo.
 *
 * Abrir WhatsApp/llamada desde la app queda fuera de esta pantalla a
 * propósito por ahora (Requisito 7 AC4 ya exige que NUNCA registre solo --
 * el Evangelista siempre confirma acá manualmente); el enlace directo
 * necesitaría el teléfono de la persona, que `fn_evangelista_historial`
 * todavía no expone -- queda como mejora rápida para una próxima vuelta.
 */
export function EvangelistaSeguimiento() {
  const { evangelismoId } = useParams<{ evangelismoId: string }>();
  const location = useLocation();
  const nombreCompleto = (location.state as { nombreCompleto?: string } | null)?.nombreCompleto;
  const { data: contactos = [], isLoading } = useHistorialSeguimiento(evangelismoId);
  const registrar = useRegistrarSeguimiento(evangelismoId as string);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [medio, setMedio] = useState<MedioSeguimiento | ''>('');
  const [notas, setNotas] = useState('');

  async function manejarRegistrar() {
    if (!medio) return;
    try {
      await registrar.mutateAsync({ medio, notas });
      toast.success('Contacto registrado');
      setMedio('');
      setNotas('');
      setMostrarForm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar el contacto');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <EvangelistaSubHeader titulo={nombreCompleto ?? 'Seguimiento'} volverA={ROUTES.EVANGELISTA_HISTORIAL} />

      {!mostrarForm && (
        <Button
          className="h-11 gap-2 self-start rounded-xl text-white"
          style={{ background: `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})` }}
          onClick={() => setMostrarForm(true)}
        >
          <Plus className="h-4 w-4" />
          Registrar contacto
        </Button>
      )}

      {mostrarForm && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <Label>Medio *</Label>
            <Select value={medio} onValueChange={(v) => setMedio(v as MedioSeguimiento)}>
              <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="LLAMADA">Llamada</SelectItem>
                <SelectItem value="VISITA">Visita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" rows={3} placeholder="¿Cómo fue el contacto?" className={CAMPO_ESTILO} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMostrarForm(false)}>
              Cancelar
            </Button>
            <Button className="gap-1.5" disabled={!medio || registrar.isPending} onClick={manejarRegistrar}>
              {registrar.isPending && <Spinner className="h-3.5 w-3.5" />}
              {registrar.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">Historial de contactos</p>
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : contactos.length === 0 ? (
          <ProximamentePlaceholder titulo="Sin contactos todavía" descripcion="Registrá el primer contacto con esta persona." />
        ) : (
          contactos.map((c) => {
            const Icono = ICONO_MEDIO[c.medio];
            return (
              <div key={c.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: `linear-gradient(135deg, ${EVANGELISTA_COLOR.NARANJA_OSCURO}, ${EVANGELISTA_COLOR.NARANJA})` }}
                >
                  <Icono className="h-4 w-4" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-semibold text-foreground">{ETIQUETA_MEDIO[c.medio]}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(c.fecha_hora).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {c.notas && <p className="text-sm text-foreground">{c.notas}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
