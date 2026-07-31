import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Home, ListChecks, MessageSquareText, Target, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { AMBAR, AZUL, MARINO, VERDE } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import { useCargoVigenteCdp } from '@/hooks/useCasasDePaz';
import { useCrearVisita } from '@/hooks/useVisitas';
import { aISO } from '@/utils/calendario-fechas';
import { ASPECTOS_VISITA, MOTIVOS_VISITA } from '@/types/visitas.types';
import type { AspectoVisita, MotivoVisita } from '@/types/visitas.types';
import type { CdpResumen } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redId: string;
  redNombre: string;
  iglesiaId: string;
  cdps: CdpResumen[];
}

export function VisitaFormDialog({ open, onOpenChange, redId, redNombre, iglesiaId, cdps }: Props) {
  const personaId = useAuthStore((s) => s.personaId);
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);

  const [casaDePazId, setCasaDePazId] = useState('');
  const [fechaVisita, setFechaVisita] = useState('');
  const [motivo, setMotivo] = useState<MotivoVisita | ''>('');
  const [aspectos, setAspectos] = useState<Set<AspectoVisita>>(new Set());
  const [otroDetalle, setOtroDetalle] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const { data: liderCdp = [] } = useCargoVigenteCdp(casaDePazId || undefined, 'LIDER_CDP');
  const crear = useCrearVisita(redId);

  useEffect(() => {
    if (!open) return;
    setCasaDePazId('');
    setFechaVisita(aISO(new Date()));
    setMotivo('');
    setAspectos(new Set());
    setOtroDetalle('');
    setObservaciones('');
  }, [open]);

  function toggleAspecto(valor: AspectoVisita, marcado: boolean) {
    setAspectos((prev) => {
      const next = new Set(prev);
      if (marcado) next.add(valor);
      else next.delete(valor);
      return next;
    });
  }

  const puedeGuardar = !!casaDePazId && !!fechaVisita && !!motivo && (!aspectos.has('OTRO') || otroDetalle.trim().length > 0);

  async function handleGuardar() {
    if (!puedeGuardar || !personaId || !motivo) return;
    try {
      await crear.mutateAsync({
        iglesiaId,
        casaDePazId,
        redId,
        liderRedId: personaId,
        motivo,
        aspectos: Array.from(aspectos),
        aspectoOtroDetalle: aspectos.has('OTRO') ? otroDetalle.trim() : undefined,
        observaciones: observaciones.trim() || undefined,
        fechaVisita,
      });
      toast.success('Visita registrada');
      onOpenChange(false);
    } catch {
      toast.error('No se pudo registrar la visita');
    }
  }

  const liderNombre = liderCdp[0]?.nombre_completo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Registro de Supervisión</DialogTitle>
          <SeccionIconHeader icon={ClipboardList} color={MARINO} titulo="Registro de Supervisión" descripcion="Formulario de visita del Líder de Red" />
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
          {/* 1. Encabezado */}
          <div className="flex flex-col gap-3">
            <SeccionIconHeader icon={Home} color={AZUL} titulo="1. Casa de Paz visitada" size="sm" />
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Casa de Paz</Label>
              <Select value={casaDePazId} onValueChange={setCasaDePazId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí la Casa de Paz visitada" />
                </SelectTrigger>
                <SelectContent>
                  {cdps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {casaDePazId && (
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Líder de Casa de Paz</p>
                    <p className="truncate font-medium">{liderNombre ?? 'Sin líder asignado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Home className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Red</p>
                    <p className="truncate font-medium">{redNombre}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Líder de Red que visita</p>
                    <p className="truncate font-medium">{nombreCompleto ?? '—'}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="visita_fecha" className="text-[10px] font-medium text-muted-foreground uppercase">Fecha de la visita</Label>
                  <Input id="visita_fecha" type="date" className="h-8 text-sm" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* 2. Motivo */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
            <SeccionIconHeader icon={Target} color={VERDE} titulo="2. Motivo de la visita" size="sm" />
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoVisita)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccione una opción" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_VISITA.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Aspectos */}
          <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
            <SeccionIconHeader icon={ListChecks} color={AMBAR} titulo="3. Aspectos que requieren atención" descripcion="Marcá uno o más" size="sm" />
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ASPECTOS_VISITA.map((a) => (
                <label key={a.value} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50">
                  <Checkbox checked={aspectos.has(a.value)} onCheckedChange={(v) => toggleAspecto(a.value, v === true)} />
                  {a.label}
                </label>
              ))}
            </div>
            {aspectos.has('OTRO') && (
              <div className="flex flex-col gap-1.5 pl-1">
                <Label htmlFor="visita_otro" className="text-[11px] font-medium text-muted-foreground">Si seleccionó "Otro", especifique</Label>
                <Input id="visita_otro" value={otroDetalle} onChange={(e) => setOtroDetalle(e.target.value)} placeholder="Ej. Falta de materiales de apoyo" />
              </div>
            )}
          </div>

          {/* 4. Observaciones */}
          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-4">
            <Label htmlFor="visita_observaciones" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <MessageSquareText className="h-3.5 w-3.5" /> Observaciones
            </Label>
            <Textarea
              id="visita_observaciones"
              rows={4}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Describa las observaciones realizadas durante la visita"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleGuardar} disabled={crear.isPending || !puedeGuardar} className="gap-1.5">
            {crear.isPending && <Spinner className="h-3.5 w-3.5" />}
            {crear.isPending ? 'Guardando...' : 'Guardar registro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
