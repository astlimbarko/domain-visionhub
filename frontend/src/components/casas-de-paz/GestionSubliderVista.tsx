import { useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  CalendarClock,
  CalendarDays,
  Clock,
  Copy,
  ExternalLink,
  Home,
  Link2,
  MapPin,
  Network,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import { useAuthStore } from '@/store/auth.store';
import { useRolUI } from '@/hooks/useRolUI';
import { useMisCasasDePaz } from '@/hooks/useCalendario';
import {
  useAsignarCargoCdp,
  useCargoVigenteCdp,
  useCargos,
  useCdpPerfil,
  useDomicilioCdp,
  useQuitarCargoCdp,
} from '@/hooks/useCasasDePaz';
import { useInvitarLider } from '@/hooks/useInvitacionLider';
import { AsignarCargoDialog } from './AsignarCargoDialog';
import { DomicilioAnfitrionDialog } from './DomicilioAnfitrionDialog';
import { EditarReunionCdpDialog, DIAS_SEMANA } from './EditarReunionCdpDialog';
import { ProximamentePlaceholder } from '@/components/shared/ProximamentePlaceholder';
import { HeroDato, TarjetaHeader, GRADIENTE_HERO, DEGRADADO_IDENTIDAD } from '@/components/shared/SeccionPerfil';
import type { DomicilioCdp, PersonaBusqueda } from '@/types/casas-de-paz.types';

/** Colores de avatar que rotan por posición, para dar variedad como en el diseño. */
const COLORES_AVATAR = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)'];

function fmtFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function iniciales(nombreCompleto: string) {
  const palabras = nombreCompleto.trim().split(/\s+/);
  return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase();
}

/** Dirección de reunión en una sola línea: calle+número, ciudad, zona. */
function lineaDireccion(d: DomicilioCdp) {
  const calle = [d.calle, d.numero].filter(Boolean).join(' ');
  return [calle || null, d.ciudad_nombre || null, d.zona ? `Zona: ${d.zona}` : null]
    .filter(Boolean)
    .join(', ');
}

function AvatarPersona({ nombre, color, size = 'md' }: { nombre: string; color: string; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-[13px]';
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full font-bold`}
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
  const [mostrarReunion, setMostrarReunion] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState<{ cargoId: string; nombre: string } | null>(null);

  const { data: perfil } = useCdpPerfil(cdpActiva);
  const { data: cargos = [] } = useCargos();
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

  // Quitar un sublíder pide confirmación explícita: el click en Quitar solo
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

  function copiarEnlace(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success('Enlace copiado'),
      () => toast.error('No se pudo copiar el enlace')
    );
  }

  if (cargandoCasas) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (!misCasas || misCasas.length === 0) {
    return (
      <ProximamentePlaceholder
        titulo="Perfil de Casa de Paz"
        descripcion="Todavía no tenés una Casa de Paz asignada como líder o sublíder."
      />
    );
  }

  const anfitrionActual = anfitrion[0];
  const direccion = domicilio ? lineaDireccion(domicilio) : null;

  return (
    <div className="flex flex-col gap-6">
      {misCasas.length > 1 && (
        <div className="flex justify-end">
          <Select value={cdpActiva} onValueChange={setCasaDePazId}>
            <SelectTrigger size="sm" className="w-full text-sm sm:w-56">
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
        </div>
      )}

      {/* ============ Encabezado ============ */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-[var(--brand-navy)]/25 sm:p-8"
        style={{ background: GRADIENTE_HERO }}
      >
        <div className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-black/25" style={{ background: DEGRADADO_IDENTIDAD }}>
                <Home className="h-8 w-8 text-white" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-white/60">Casa de Paz</span>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{nombreCdpActiva ?? 'Casa de Paz'}</h1>
                  {perfil?.red_nombre && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[13px] font-medium backdrop-blur-sm">
                      <Network className="h-3.5 w-3.5" /> Red: {perfil.red_nombre}
                    </span>
                  )}
                </div>
                {direccion && (
                  <p className="flex items-start gap-1.5 text-[13px] text-white/70">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {direccion}
                  </p>
                )}
              </div>
            </div>
            {esLider && cdpActiva && (
              <Button
                onClick={() => setMostrarReunion(true)}
                className="h-10 shrink-0 gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-white backdrop-blur-sm hover:bg-white/20"
              >
                <CalendarClock className="h-4 w-4" />
                Editar reunión
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-4">
            <HeroDato icon={Network} label="Red" valor={perfil?.red_nombre ?? 'Sin red'} />
            <HeroDato
              icon={ShieldCheck}
              label="Estado"
              valor={perfil ? (perfil.activo ? 'Activa' : 'Inactiva') : '—'}
              dot={perfil ? (perfil.activo ? 'var(--chart-2)' : 'var(--chart-5)') : undefined}
              valorClase={perfil ? (perfil.activo ? 'text-[var(--chart-2)]' : 'text-white/70') : 'text-white'}
            />
            <HeroDato
              icon={CalendarDays}
              label="Día de reunión"
              valor={perfil?.dia_reunion != null ? DIAS_SEMANA[perfil.dia_reunion] : 'Sin definir'}
              dot={perfil?.dia_reunion != null ? 'var(--chart-4)' : undefined}
              valorClase={perfil?.dia_reunion != null ? 'text-[var(--chart-4)]' : 'text-white/70'}
            />
            <HeroDato
              icon={Clock}
              label="Hora de reunión"
              valor={perfil?.hora_reunion ? perfil.hora_reunion.slice(0, 5) : 'Sin definir'}
              dot={perfil?.hora_reunion ? 'var(--chart-3)' : undefined}
              valorClase={perfil?.hora_reunion ? 'text-[var(--chart-3)]' : 'text-white/70'}
            />
          </div>
        </div>
      </div>

      {/* ============ Lugar de reunión ============ */}
      {/* Color de la sección: cambiar solo --acc (independiente del color de la Red). */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card" style={{ '--acc': 'var(--teal)' } as CSSProperties}>
        <TarjetaHeader
          icon={Home}
          color="var(--acc)"
          titulo="Lugar de reunión"
          descripcion="Información del lugar donde se realiza la Casa de Paz."
        />
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-3 lg:gap-0">
          {/* Anfitrión */}
          <div className="flex flex-col gap-3 lg:pr-6">
            {cargandoAnfitrion ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : anfitrionActual ? (
              <>
                <div className="flex items-center gap-3">
                  <AvatarPersona nombre={anfitrionActual.nombre_completo} color="var(--acc)" size="lg" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-muted-foreground">Anfitrión</p>
                    <p className="truncate text-[15px] font-bold text-foreground">{anfitrionActual.nombre_completo}</p>
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground">Persona que presta su hogar para la reunión.</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-muted-foreground">Anfitrión</p>
                    <p className="text-[15px] font-bold text-muted-foreground">Sin asignar</p>
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground">Todavía no se asignó un anfitrión para esta Casa de Paz.</p>
              </>
            )}
            {esLider && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit gap-1.5 border-[var(--acc)]/40 text-[var(--acc)] hover:bg-[var(--acc)]/10 hover:text-[var(--acc)]"
                onClick={() => setMostrarAnfitrion(true)}
              >
                <UserRound className="h-3.5 w-3.5" />
                {anfitrionActual ? 'Cambiar anfitrión' : 'Asignar anfitrión'}
              </Button>
            )}
          </div>

          {/* Dirección de reunión */}
          <div className="flex flex-col gap-3 border-t border-border/60 pt-6 lg:border-t-0 lg:border-l lg:px-6 lg:pt-0">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-[var(--acc)]" /> Dirección de reunión
            </p>
            {direccion ? (
              <p className="text-[13px] leading-relaxed text-foreground">{direccion}</p>
            ) : (
              <p className="text-[13px] text-muted-foreground">Sin dirección registrada.</p>
            )}
            {domicilio?.referencia && (
              <div>
                <p className="text-[12px] font-medium text-[var(--acc)]">Referencia (opcional)</p>
                <p className="text-[13px] text-foreground">{domicilio.referencia}</p>
              </div>
            )}
            {esLider && (
              <Button
                variant="outline"
                size="sm"
                className="mt-auto w-fit gap-1.5 border-[var(--acc)]/40 text-[var(--acc)] hover:bg-[var(--acc)]/10 hover:text-[var(--acc)]"
                onClick={() => setMostrarDomicilio(true)}
              >
                <MapPin className="h-3.5 w-3.5" />
                {domicilio ? 'Editar dirección' : 'Agregar dirección'}
              </Button>
            )}
          </div>

          {/* Ubicación en Google Maps */}
          <div className="flex flex-col gap-3 border-t border-border/60 pt-6 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <Link2 className="h-4 w-4 text-[var(--acc)]" /> Ubicación en Google Maps
            </p>
            {domicilio?.url_gps ? (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px]">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground">{domicilio.url_gps}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {esLider && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-[var(--acc)]/40 text-[var(--acc)] hover:bg-[var(--acc)]/10 hover:text-[var(--acc)]"
                      onClick={() => setMostrarDomicilio(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar enlace
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-[var(--acc)]/40 text-[var(--acc)] hover:bg-[var(--acc)]/10 hover:text-[var(--acc)]"
                    onClick={() => copiarEnlace(domicilio.url_gps!)}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-[var(--acc)]/40 text-[var(--acc)] hover:bg-[var(--acc)]/10 hover:text-[var(--acc)]"
                    asChild
                  >
                    <a href={domicilio.url_gps} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir en Maps
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">Sin enlace de Google Maps.</p>
                {esLider && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5 border-[var(--acc)]/40 text-[var(--acc)] hover:bg-[var(--acc)]/10 hover:text-[var(--acc)]"
                    onClick={() => setMostrarDomicilio(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Agregar enlace
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ============ Sublíderes ============ */}
      {/* Color de la sección: cambiar solo --acc (independiente del color de la Red). */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card" style={{ '--acc': 'var(--chart-3)' } as CSSProperties}>
        <TarjetaHeader
          icon={Users}
          color="var(--acc)"
          titulo="Sublíderes"
          descripcion="Personas que apoyan al líder en la Casa de Paz."
          accion={
            esLider && (
              <Button
                size="sm"
                className="h-9 gap-1.5 rounded-xl px-3.5 shadow-sm shadow-primary/20"
                onClick={() => setMostrarAsignar(true)}
              >
                <Plus className="h-4 w-4" />
                Asignar sublíder
              </Button>
            )
          }
        />
        <div className="p-5">
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
            <div className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {sublideres.map((s, i) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarPersona nombre={s.nombre_completo} color={COLORES_AVATAR[i % COLORES_AVATAR.length]} />
                      <p className="truncate text-sm font-bold text-foreground">{s.nombre_completo}</p>
                      <Badge className="shrink-0 border-0 bg-[var(--chart-2)]/15 text-[var(--chart-2)]">Activo</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" /> Asignado el {fmtFecha(s.fecha_inicio)}
                      </span>
                      {esLider && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={quitarCargoCdp.isPending}
                          onClick={() => manejarQuitar(s.id, s.nombre_completo)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Quitar
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>

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

      {esLider && cdpActiva && (
        <EditarReunionCdpDialog
          open={mostrarReunion}
          onOpenChange={setMostrarReunion}
          cdpId={cdpActiva}
          diaReunion={perfil?.dia_reunion ?? null}
          horaReunion={perfil?.hora_reunion ?? null}
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
