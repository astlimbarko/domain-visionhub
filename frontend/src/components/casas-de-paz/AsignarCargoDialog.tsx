import { useState } from 'react';
import { Mail, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BuscadorPersona } from './BuscadorPersona';
import type { CargoVigente, PersonaBusqueda } from '@/types/casas-de-paz.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  exclusivo: boolean;
  iglesiaId: string | undefined;
  vigentes: CargoVigente[];
  cargandoVigentes: boolean;
  asignando: boolean;
  onAsignar: (persona: PersonaBusqueda) => void;
  onQuitar: (cargoAsignacionId: string) => void;
  invitable?: boolean;
  invitando?: boolean;
  onInvitar?: (correo: string) => void;
}

export function AsignarCargoDialog({
  open,
  onOpenChange,
  titulo,
  exclusivo,
  iglesiaId,
  vigentes,
  cargandoVigentes,
  asignando,
  onAsignar,
  onQuitar,
  invitable = false,
  invitando = false,
  onInvitar,
}: Props) {
  const [modo, setModo] = useState<'buscar' | 'invitar'>('buscar');
  const [correoInvitar, setCorreoInvitar] = useState('');

  function enviarInvitacion() {
    if (!onInvitar || !correoInvitar.trim()) return;
    onInvitar(correoInvitar.trim().toLowerCase());
    setCorreoInvitar('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {exclusivo
              ? 'Asignar una persona nueva reemplaza automáticamente a la actual.'
              : 'Se puede asignar a varias personas a la vez.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {cargandoVigentes ? (
            <Skeleton className="h-8 w-full" />
          ) : vigentes.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {vigentes.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                  {v.nombre_completo}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onQuitar(v.id)} aria-label="Quitar">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin nadie asignado todavía.</p>
          )}

          {invitable && (
            <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
              <button
                type="button"
                onClick={() => setModo('buscar')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${
                  modo === 'buscar' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                Persona existente
              </button>
              <button
                type="button"
                onClick={() => setModo('invitar')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${
                  modo === 'invitar' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Invitar por correo
              </button>
            </div>
          )}

          {modo === 'buscar' && (
            <BuscadorPersona
              iglesiaId={iglesiaId}
              excluirIds={vigentes.map((v) => v.persona_id)}
              onSeleccionar={onAsignar}
            />
          )}

          {modo === 'invitar' && invitable && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-muted-foreground">
                Si esta persona todavía no existe en el sistema, mandale una invitación por correo. Al entrar por
                primera vez va a tener que completar el formulario de membresía antes de ver su panel.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={correoInvitar}
                  onChange={(e) => setCorreoInvitar(e.target.value)}
                />
                <Button type="button" onClick={enviarInvitacion} disabled={invitando || !correoInvitar.trim()}>
                  {invitando ? 'Enviando...' : 'Invitar'}
                </Button>
              </div>
            </div>
          )}

          {asignando && <p className="text-sm text-muted-foreground">Asignando...</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
