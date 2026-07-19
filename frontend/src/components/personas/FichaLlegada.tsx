import { useState } from 'react';
import { toast } from 'sonner';
import { LogIn, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import { useAgregarLlegada, useMotivosLlegada } from '@/hooks/usePersonas';
import type { PersonaFicha } from '@/types/persona.types';

interface Props {
  personaId: string;
  iglesiaId: string;
  llegadas: PersonaFicha['llegadas'];
  puedeEditar: boolean;
}

export function FichaLlegada({ personaId, iglesiaId, llegadas, puedeEditar }: Props) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [motivoId, setMotivoId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [invitadoPor, setInvitadoPor] = useState<{ id: string; nombre_completo: string } | null>(null);
  const [invitadoTxt, setInvitadoTxt] = useState('');
  const [comentarios, setComentarios] = useState('');

  const { data: motivos = [] } = useMotivosLlegada();
  const agregar = useAgregarLlegada(personaId, iglesiaId);

  function limpiar() {
    setMotivoId('');
    setFecha(new Date().toISOString().slice(0, 10));
    setInvitadoPor(null);
    setInvitadoTxt('');
    setComentarios('');
  }

  function handleAgregar() {
    if (!motivoId || !fecha) return;
    agregar.mutate(
      {
        motivoLlegadaId: motivoId,
        fechaIngreso: fecha,
        invitadoPorId: invitadoPor?.id ?? null,
        invitadoPorTxt: invitadoPor ? null : invitadoTxt.trim() || null,
        comentarios: comentarios.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Llegada registrada.');
          limpiar();
          setMostrarForm(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo registrar la llegada'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {llegadas.length === 0 && !mostrarForm && <p className="text-sm text-muted-foreground">Sin llegadas registradas.</p>}
      {llegadas.map((l) => (
        <div key={l.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
          <LogIn className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">
              {l.motivo_nombre} · {new Date(l.fecha_ingreso).toLocaleDateString('es-BO')}
            </p>
            {(l.invitado_por_nombre || l.invitado_por_txt) && (
              <p className="text-xs text-muted-foreground">Invitado por {l.invitado_por_nombre ?? l.invitado_por_txt}</p>
            )}
            {l.comentarios && <p className="text-xs text-muted-foreground">{l.comentarios}</p>}
          </div>
        </div>
      ))}

      {puedeEditar && !mostrarForm && (
        <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setMostrarForm(true)}>
          <Plus className="h-4 w-4" />
          Registrar llegada
        </Button>
      )}

      {mostrarForm && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Motivo</Label>
              <Select value={motivoId} onValueChange={setMotivoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          {invitadoPor ? (
            <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm">
              <span>Invitado por: {invitadoPor.nombre_completo}</span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setInvitadoPor(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Invitado por (persona registrada)</Label>
              <BuscadorPersona iglesiaId={iglesiaId} onSeleccionar={setInvitadoPor} excluirIds={[personaId]} />
              <Label className="mt-1 text-xs">o texto libre, si no está registrado</Label>
              <Input value={invitadoTxt} onChange={(e) => setInvitadoTxt(e.target.value)} placeholder="Ej. Una vecina" />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Comentarios</Label>
            <Textarea rows={2} value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={handleAgregar} disabled={agregar.isPending || !motivoId || !fecha}>
              Guardar
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setMostrarForm(false); limpiar(); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
