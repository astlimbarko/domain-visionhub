import { useEffect, useState } from 'react';
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
import { useBuscarCuentas } from '@/hooks/useAdmin';
import type { RolSistema } from '@/types/auth.types';
import type { CuentaBusqueda, IglesiaAdmin } from '@/types/admin.types';

// El Super Admin es un rol tecnico: solo puede crear otros Super Admin y el
// Pastor/Supervisor de cada iglesia. Lideres de Red/CdP se asignan desde
// Casas de Paz por el Pastor o Supervisor de esa iglesia, no desde aca
// (decision del owner, 2026-07-19 -- "acotar Super Admin").
const ROLES: { value: RolSistema; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'PASTOR', label: 'Pastor' },
  { value: 'SUPERVISOR_VISION_ACCION', label: 'Supervisor de Visión en Acción' },
];

/** KAN-173: datos mínimos de Persona, opcionales, para crearla ahí mismo si
 * la cuenta todavía no tiene una ficha en la iglesia elegida (el gate de
 * "completar membresía" al iniciar sesión no vuelve a pedirla una vez que
 * la cuenta ya tiene Persona en OTRA iglesia -- ver fn_crear_persona_si_falta). */
export interface PersonaMinima {
  primerNombre: string;
  primerApellido: string;
  sexo: 'M' | 'F';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesias: IglesiaAdmin[];
  invitando: boolean;
  asignando: boolean;
  /** Tema oscuro del diálogo (hoy solo lo usa el panel de Super Admin). */
  oscuro?: boolean;
  /** KAN-155: preconfigura el cargo/iglesia (ej. "Asignar Pastor ahora" al
   * terminar de crear una iglesia) -- el usuario igual puede cambiarlos. */
  rolInicial?: RolSistema;
  iglesiaIdInicial?: string;
  onInvitar: (correo: string, rol: RolSistema, iglesiaId: string | null, pin?: string, persona?: PersonaMinima) => void;
  onAsignarExistente: (usuarioId: string, rol: RolSistema, iglesiaId: string | null, pin?: string, persona?: PersonaMinima) => void;
}

export function InvitarUsuarioDialog({
  open,
  onOpenChange,
  iglesias,
  invitando,
  asignando,
  oscuro,
  rolInicial,
  iglesiaIdInicial,
  onInvitar,
  onAsignarExistente,
}: Props) {
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const [modo, setModo] = useState<'invitar' | 'buscar'>('invitar');
  const [correo, setCorreo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [usuarioElegido, setUsuarioElegido] = useState<CuentaBusqueda | null>(null);
  const [rol, setRol] = useState<RolSistema | ''>(rolInicial ?? '');
  const [iglesiaId, setIglesiaId] = useState(iglesiaIdInicial ?? '');
  const [pin, setPin] = useState('');
  const [agregarPersona, setAgregarPersona] = useState(false);
  const [primerNombre, setPrimerNombre] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('');

  useEffect(() => {
    if (open) {
      setRol(rolInicial ?? '');
      setIglesiaId(iglesiaIdInicial ?? '');
    }
  }, [open, rolInicial, iglesiaIdInicial]);

  const necesitaIglesia = rol !== '' && rol !== 'SUPER_ADMIN';
  const pinValido = !esSuperAdmin || /^[0-9]{6}$/.test(pin);
  const procesando = invitando || asignando;
  // Si se activó la sección opcional, nombre/apellido/sexo pasan a ser
  // obligatorios para no crear una Persona a medias.
  const personaValida = !agregarPersona || (primerNombre.trim() !== '' && primerApellido.trim() !== '' && sexo !== '');
  const persona: PersonaMinima | undefined =
    agregarPersona && personaValida ? { primerNombre: primerNombre.trim(), primerApellido: primerApellido.trim(), sexo: sexo as 'M' | 'F' } : undefined;

  // Alta de doble vía (REQ-C-1/C-2): busca entre TODAS las cuentas
  // existentes (cualquier rol) -- no solo cargos administrativos.
  const { data: resultadosBusqueda = [] } = useBuscarCuentas(modo === 'buscar' ? busqueda : '');

  const puedeEnviar =
    modo === 'invitar'
      ? correo.trim().includes('@') && rol !== '' && (!necesitaIglesia || !!iglesiaId) && pinValido && personaValida
      : !!usuarioElegido && rol !== '' && (!necesitaIglesia || !!iglesiaId) && pinValido && personaValida;

  function limpiar() {
    setCorreo('');
    setBusqueda('');
    setUsuarioElegido(null);
    setRol('');
    setIglesiaId('');
    setPin('');
    setAgregarPersona(false);
    setPrimerNombre('');
    setPrimerApellido('');
    setSexo('');
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
      onInvitar(correo.trim().toLowerCase(), rol as RolSistema, necesitaIglesia ? iglesiaId : null, esSuperAdmin ? pin : undefined, persona);
    } else if (usuarioElegido) {
      onAsignarExistente(usuarioElegido.usuario_id, rol as RolSistema, necesitaIglesia ? iglesiaId : null, esSuperAdmin ? pin : undefined, persona);
    }
    limpiar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-sm', oscuro && 'dark')}>
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
                            key={u.usuario_id}
                            type="button"
                            onClick={() => setUsuarioElegido(u)}
                            className="rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                          >
                            {u.correo}
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
          {necesitaIglesia && (
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={agregarPersona} onChange={(e) => setAgregarPersona(e.target.checked)} />
                Agregar nombre de la persona para esta iglesia
              </label>
              <p className="text-xs text-muted-foreground">
                Opcional. Si la cuenta ya tiene ficha en otra iglesia, el sistema no le va a
                volver a pedir que la complete acá -- quedaría "sin persona asociada" hasta
                que se la cargues así.
              </p>
              {agregarPersona && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="persona_nombre">Nombre</Label>
                      <Input id="persona_nombre" value={primerNombre} onChange={(e) => setPrimerNombre(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="persona_apellido">Apellido</Label>
                      <Input id="persona_apellido" value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Sexo</Label>
                    <Select value={sexo} onValueChange={(v) => setSexo(v as 'M' | 'F')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegí" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
