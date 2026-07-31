import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CampoOtp } from '@/components/shared/CampoOtp';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { RolSistema } from '@/types/auth.types';
import type { IglesiaAdmin, UsuarioListado } from '@/types/admin.types';

// El Super Admin es un rol tecnico: solo puede crear otros Super Admin y el
// Pastor/Supervisor de cada iglesia. Lideres de Red/CdP se asignan desde
// Casas de Paz por el Pastor o Supervisor de esa iglesia, no desde aca
// (decision del owner, 2026-07-19 -- "acotar Super Admin").
const ROLES: { value: RolSistema; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'PASTOR', label: 'Pastor' },
  { value: 'SUPERVISOR_VISION_ACCION', label: 'Supervisor de Visión en Acción' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesias: IglesiaAdmin[];
  /** Alta de doble vía (15-gestion-administrativa, REQ-C-1/C-2): quien ya
   * tiene cuenta en el sistema no necesita una invitación nueva. */
  usuariosExistentes: UsuarioListado[];
  invitando: boolean;
  asignando: boolean;
  onInvitar: (correo: string, rol: RolSistema, iglesiaId: string | null, pin?: string) => void;
  onAsignarExistente: (usuarioId: string, rol: RolSistema, iglesiaId: string | null, pin?: string) => void;
}

export function InvitarUsuarioDialog({
  open,
  onOpenChange,
  iglesias,
  usuariosExistentes,
  invitando,
  asignando,
  onInvitar,
  onAsignarExistente,
}: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [modo, setModo] = useState<'invitar' | 'buscar'>('invitar');
  const [correo, setCorreo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [usuarioElegido, setUsuarioElegido] = useState<UsuarioListado | null>(null);
  const [rol, setRol] = useState<RolSistema | ''>('');
  const [iglesiaId, setIglesiaId] = useState('');
  const [pin, setPin] = useState('');

  const necesitaIglesia = rol !== '' && rol !== 'SUPER_ADMIN';
  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const procesando = invitando || asignando;

  const resultadosBusqueda =
    modo === 'buscar' && busqueda.trim().length >= 2
      ? usuariosExistentes.filter((u) => u.correo.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 6)
      : [];

  const puedeEnviar =
    modo === 'invitar'
      ? correo.trim().includes('@') && rol !== '' && (!necesitaIglesia || !!iglesiaId) && pinValido
      : !!usuarioElegido && rol !== '' && (!necesitaIglesia || !!iglesiaId) && pinValido;

  function limpiar() {
    setCorreo('');
    setBusqueda('');
    setUsuarioElegido(null);
    setRol('');
    setIglesiaId('');
    setPin('');
  }

  function handleCambiarModo(nuevo: 'invitar' | 'buscar') {
    setModo(nuevo);
    setCorreo('');
    setBusqueda('');
    setUsuarioElegido(null);
  }

  function handleConfirmar() {
    if (!puedeEnviar) return;
    if (modo === 'invitar') {
      onInvitar(correo.trim().toLowerCase(), rol as RolSistema, necesitaIglesia ? iglesiaId : null, esSuperAdmin ? pin : undefined);
    } else if (usuarioElegido) {
      onAsignarExistente(usuarioElegido.usuario_id, rol as RolSistema, necesitaIglesia ? iglesiaId : null, esSuperAdmin ? pin : undefined);
    }
    limpiar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar usuario</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => handleCambiarModo('invitar')}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                modo === 'invitar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              Invitar por correo
            </button>
            <button
              type="button"
              onClick={() => handleCambiarModo('buscar')}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                modo === 'buscar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              Buscar existente
            </button>
          </div>

          {modo === 'invitar' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="correo_invitar">Correo</Label>
              <Input id="correo_invitar" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@gmail.com" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="buscar_usuario">Buscar por correo</Label>
              {usuarioElegido ? (
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                  <span className="truncate text-sm">{usuarioElegido.correo}</span>
                  <button type="button" onClick={() => setUsuarioElegido(null)} className="text-xs text-muted-foreground hover:text-foreground">
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    id="buscar_usuario"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Escribí al menos 2 letras del correo"
                  />
                  {busqueda.trim().length >= 2 && (
                    <div className="flex flex-col gap-1 rounded-xl border border-border p-1">
                      {resultadosBusqueda.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">Nadie con cuenta coincide con esa búsqueda.</p>
                      ) : (
                        resultadosBusqueda.map((u) => (
                          <button
                            key={u.usuario_rol_id}
                            type="button"
                            onClick={() => setUsuarioElegido(u)}
                            className="flex flex-col items-start rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                          >
                            <span className="truncate font-medium">{u.correo}</span>
                            <span className="text-xs text-muted-foreground">
                              {u.rol}
                              {u.iglesia_nombre && ` · ${u.iglesia_nombre}`}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Cargo en el sistema</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as RolSistema)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí un cargo" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {necesitaIglesia && (
            <div className="flex flex-col gap-1.5">
              <Label>Iglesia</Label>
              <Select value={iglesiaId} onValueChange={setIglesiaId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí una iglesia" />
                </SelectTrigger>
                <SelectContent>
                  {iglesias.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {esSuperAdmin && <CampoOtp value={pin} onChange={setPin} />}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleConfirmar} disabled={procesando || !puedeEnviar}>
            {procesando ? 'Guardando...' : modo === 'invitar' ? 'Invitar' : 'Asignar cargo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
