import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Crown, Home, Mail, MapPin, Pencil, Plus, UserRound, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import { useAuthStore } from '@/store/auth.store';
import { useRolUI } from '@/hooks/useRolUI';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import {
  useAsignarCargoCdp,
  useCargoVigenteCdp,
  useCargos,
  useDomicilioCdp,
  useQuitarCargoCdp,
} from '@/hooks/useCasasDePaz';
import { useInvitarLider } from '@/hooks/useInvitacionLider';
import { AsignarCargoDialog } from './AsignarCargoDialog';
import { DomicilioAnfitrionDialog } from './DomicilioAnfitrionDialog';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

function fmtFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function iniciales(nombreCompleto: string) {
  const palabras = nombreCompleto.trim().split(/\s+/);
  return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase();
}

function AvatarPersona({ nombre, color }: { nombre: string; color: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
    >
      {iniciales(nombre) || <UserRound className="h-4 w-4" />}
    </div>
  );
}

/**
 * Vista enfocada del líder/sublíder de Casa de Paz: solo la información y los
 * sublíderes de su propia CdP, sin la navegación de Redes/CdP pensada para
 * Supervisor. Un sublíder puede ver esta lista pero no designar/eliminar
 * (spec de roles, Rol 1).
 */
export function GestionSubliderVista() {
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const rolUI = useRolUI();
  const esLider = rolUI === 'LIDER_CDP';

  const { data: misCasas, isLoading: cargandoCasas } = useMisCasasDePaz(personaId);
  const [casaDePazId, setCasaDePazId] = useState<string>();
  const cdpActiva = casaDePazId ?? misCasas?.[0]?.casa_de_paz_id;
  const nombreCdpActiva = misCasas?.find((c) => c.casa_de_paz_id === cdpActiva)?.nombre;

  const [mostrarAsignar, setMostrarAsignar] = useState(false);
  const [mostrarAnfitrion, setMostrarAnfitrion] = useState(false);
  const [mostrarDomicilio, setMostrarDomicilio] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState<{ cargoId: string; nombre: string } | null>(null);

  const { data: cargos = [] } = useCargos();
  const { data: lider = [], isLoading: cargandoLider } = useCargoVigenteCdp(cdpActiva, 'LIDER_CDP');
  const { data: sublideres = [], isLoading: cargandoSublideres } = useCargoVigenteCdp(cdpActiva, 'SUBLIDER_CDP');
  const { data: anfitrion = [], isLoading: cargandoAnfitrion } = useCargoVigenteCdp(cdpActiva, 'ANFITRION');
  const { data: domicilio } = useDomicilioCdp(cdpActiva);

  const asignarCargoCdp = useAsignarCargoCdp(iglesiaActivaId);
  const quitarCargoCdp = useQuitarCargoCdp();
  const invitarLider = useInvitarLider();

  function manejarError(e: unknown, generico: string) {
    const error = e as { message?: string } | null;
    const mensaje = typeof error?.message === 'string' ? error.message : '';
    if (mensaje.includes('CDP_CARGO_DUPLICADO')) toast.error('Esa persona ya es sublíder de esta Casa de Paz');
    else if (mensaje.includes('CDP_CARGO_IGLESIA_DISTINTA') || mensaje.includes('CARGO_IGLESIA_DISTINTA')) toast.error('Esa persona no pertenece a esta iglesia');
    else if (mensaje.includes('INVITACION_LIDER_SIN_PERMISO')) toast.error('No tenés permiso para invitar acá');
    else if (mensaje.includes('Ya existe una cuenta con ese correo')) toast.error(mensaje);
    else toast.error(generico);
  }

  async function manejarAsignar(persona: PersonaBusqueda) {
    if (!cdpActiva) return;
    const cargo = cargos.find((c) => c.codigo === 'SUBLIDER_CDP');
    if (!cargo) return;
    try {
      await asignarCargoCdp.mutateAsync({ cdpId: cdpActiva, personaId: persona.id, codigo: 'SUBLIDER_CDP', cargoId: cargo.id });
      toast.success(`${persona.nombre_completo} asignado como sublíder`);
    } catch (e) {
      manejarError(e, 'No se pudo asignar el sublíder');
    }
  }

  async function manejarAsignarAnfitrion(persona: PersonaBusqueda) {
    if (!cdpActiva) return;
    const cargo = cargos.find((c) => c.codigo === 'ANFITRION');
    if (!cargo) return;
    try {
      await asignarCargoCdp.mutateAsync({ cdpId: cdpActiva, personaId: persona.id, codigo: 'ANFITRION', cargoId: cargo.id });
      toast.success(`${persona.nombre_completo} asignado como anfitrión`);
      setMostrarAnfitrion(false);
    } catch (e) {
      manejarError(e, 'No se pudo asignar el anfitrión');
    }
  }

  function manejarInvitar(correo: string) {
    if (!cdpActiva) return;
    invitarLider.mutate(
      { correo, rol: 'SUBLIDER_CDP', redId: null, casaDePazId: cdpActiva },
      {
        onSuccess: () => toast.success(`Invitación enviada a ${correo}`),
        onError: (e) => manejarError(e, 'No se pudo invitar'),
      }
    );
  }

  // Quitar un sublíder pide confirmación explícita: el click en la X solo
  // abre este diálogo, y hace falta un segundo click para ejecutar la baja.
  function manejarQuitar(cargoId: string, nombre: string) {
    setConfirmarQuitar({ cargoId, nombre });
  }

  function confirmarQuitarSublider() {
    if (!confirmarQuitar) return;
    quitarCargoCdp.mutate(confirmarQuitar.cargoId, {
      onSuccess: () => {
        toast.success(`${confirmarQuitar.nombre} ya no es sublíder`);
        setConfirmarQuitar(null);
      },
      onError: (e) => {
        manejarError(e, 'No se pudo quitar el sublíder');
        setConfirmarQuitar(null);
      },
    });
  }

  function manejarQuitarAnfitrion(cargoId: string) {
    quitarCargoCdp.mutate(cargoId, {
      onSuccess: () => toast.success('Anfitrión quitado'),
      onError: (e) => manejarError(e, 'No se pudo quitar el anfitrión'),
    });
  }

  if (cargandoCasas) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!misCasas || misCasas.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Gestión de Sublíder"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder, así que no hay sublíderes que gestionar."
      />
    );
  }

  const liderActual = lider[0];
  const anfitrionActual = anfitrion[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Gestión de Sublíder</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {nombreCdpActiva ? `Sublíderes de ${nombreCdpActiva}` : 'Sublíderes de tu Casa de Paz'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {misCasas.length > 1 && (
            <Select value={cdpActiva} onValueChange={setCasaDePazId}>
              <SelectTrigger className="w-full sm:w-56 rounded-xl border-border/60 bg-muted/40 text-sm">
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
          {esLider && (
            <Button onClick={() => setMostrarAsignar(true)} className="gap-2 rounded-xl shadow-sm shadow-primary/20 active:scale-[0.98]">
              <Plus className="h-4 w-4" />
              Asignar sublíder
            </Button>
          )}
        </div>
      </div>

      {/* Líder */}
      <div className="glass-card rounded-2xl p-5">
        <SeccionIconHeader icon={Crown} color="var(--chart-3)" titulo="Líder de la Casa de Paz" size="sm" />
        <div className="mt-3">
          {cargandoLider ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : liderActual ? (
            <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
              <AvatarPersona nombre={liderActual.nombre_completo} color="var(--chart-3)" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{liderActual.nombre_completo}</p>
                {liderActual.correo && (
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    {liderActual.correo}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta Casa de Paz todavía no tiene líder asignado.</p>
          )}
        </div>
      </div>

      {/* Sublíderes */}
      <div className="glass-card-elevated rounded-2xl p-6">
        <SeccionIconHeader
          icon={Users}
          color="var(--chart-2)"
          titulo="Sublíderes actuales"
          descripcion={`${sublideres.length} sublíder${sublideres.length === 1 ? '' : 'es'} activo${sublideres.length === 1 ? '' : 's'}`}
        />
        <div className="mt-4">
          {cargandoSublideres ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : sublideres.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <UserRound className="h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Todavía no hay sublíderes asignados.</p>
              {esLider && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMostrarAsignar(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Asignar el primero
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {sublideres.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarPersona nombre={s.nombre_completo} color="var(--chart-2)" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{s.nombre_completo}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Sublíder desde {fmtFecha(s.fecha_inicio)}
                          {s.correo && ` · ${s.correo}`}
                        </p>
                      </div>
                    </div>
                    {esLider && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                        aria-label="Quitar sublíder"
                        disabled={quitarCargoCdp.isPending}
                        onClick={() => manejarQuitar(s.id, s.nombre_completo)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Anfitrión */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <SeccionIconHeader icon={Home} color="var(--chart-4)" titulo="Anfitrión" descripcion="Quién presta la casa para la reunión" size="sm" />
          {esLider && (
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setMostrarAnfitrion(true)}>
              <Pencil className="h-3.5 w-3.5" />
              {anfitrionActual ? 'Cambiar' : 'Asignar'}
            </Button>
          )}
        </div>
        <div className="mt-3">
          {cargandoAnfitrion ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : anfitrionActual ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <AvatarPersona nombre={anfitrionActual.nombre_completo} color="var(--chart-4)" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{anfitrionActual.nombre_completo}</p>
                  {anfitrionActual.correo && (
                    <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      {anfitrionActual.correo}
                    </p>
                  )}
                  {domicilio ? (
                    <div className="mt-1.5 flex items-start gap-1 text-[12px] text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <div>
                        <p>
                          {[domicilio.calle, domicilio.numero].filter(Boolean).join(' ') || 'Sin calle registrada'}
                          {domicilio.ciudad_nombre && `, ${domicilio.ciudad_nombre}`}
                        </p>
                        {domicilio.zona && <p>{domicilio.zona}</p>}
                        {domicilio.referencia && <p>Ref: {domicilio.referencia}</p>}
                      </div>
                    </div>
                  ) : (
                    esLider && <p className="mt-1.5 text-[12px] text-muted-foreground">Sin domicilio registrado.</p>
                  )}
                </div>
              </div>
              {esLider && (
                <Button variant="ghost" size="sm" className="shrink-0 gap-1.5" onClick={() => setMostrarDomicilio(true)}>
                  <MapPin className="h-3.5 w-3.5" />
                  {domicilio ? 'Editar domicilio' : 'Agregar domicilio'}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no se asignó un anfitrión para esta Casa de Paz.</p>
          )}
        </div>
      </div>

      {esLider && cdpActiva && (
        <AsignarCargoDialog
          open={mostrarAsignar}
          onOpenChange={setMostrarAsignar}
          titulo="Asignar sublíder"
          exclusivo={false}
          iglesiaId={iglesiaActivaId}
          vigentes={sublideres}
          cargandoVigentes={cargandoSublideres}
          asignando={asignarCargoCdp.isPending}
          onAsignar={manejarAsignar}
          onQuitar={(id) => manejarQuitar(id, 'este sublíder')}
          invitable
          invitando={invitarLider.isPending}
          onInvitar={manejarInvitar}
        />
      )}

      {esLider && cdpActiva && (
        <AsignarCargoDialog
          open={mostrarAnfitrion}
          onOpenChange={setMostrarAnfitrion}
          titulo={`Anfitrión de ${nombreCdpActiva ?? 'la Casa de Paz'}`}
          exclusivo
          iglesiaId={iglesiaActivaId}
          vigentes={anfitrion}
          cargandoVigentes={cargandoAnfitrion}
          asignando={asignarCargoCdp.isPending}
          onAsignar={manejarAsignarAnfitrion}
          onQuitar={manejarQuitarAnfitrion}
        />
      )}

      {esLider && cdpActiva && iglesiaActivaId && (
        <DomicilioAnfitrionDialog
          open={mostrarDomicilio}
          onOpenChange={setMostrarDomicilio}
          cdpId={cdpActiva}
          iglesiaId={iglesiaActivaId}
          domicilio={domicilio}
        />
      )}

      <ConfirmarQuitarDialog
        open={!!confirmarQuitar}
        onOpenChange={(open) => !open && setConfirmarQuitar(null)}
        titulo="Quitar sublíder"
        descripcion={confirmarQuitar ? `¿Seguro que querés quitar a ${confirmarQuitar.nombre} como sublíder de esta Casa de Paz?` : undefined}
        procesando={quitarCargoCdp.isPending}
        onConfirmar={confirmarQuitarSublider}
      />
    </div>
  );
}
