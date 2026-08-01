import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  GitBranch,
  GitMerge,
  Home,
  KeyRound,
  Mail,
  MoreHorizontal,
  Network,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { TEAL, AZUL, MORADO, AMBAR } from '@/components/dashboard/DashboardUI';
import { solicitarRecuperacionContrasena } from '@/services/auth.service';
import { obtenerUrlBase } from '@/utils/app-url';
import { ROUTES } from '@/utils/constants';
import { useAuthStore } from '@/store/auth.store';
import { useMisRoles } from '@/hooks/useDashboard';
import {
  useAsignarCargoCdp,
  useAsignarCargoRed,
  useCargoVigenteCdp,
  useCargoVigenteRed,
  useCargos,
  useCdps,
  useCrearCdp,
  useEliminarCdp,
  useQuitarCargoCdp,
  useQuitarCargoRed,
  useRedes,
  useToggleActivoCdp,
} from '@/hooks/useCasasDePaz';
import { useDeshacerFusionCdp, useFusionarCdp, useFusionesCdp } from '@/hooks/useFusion';
import { useMultiplicarCdp, useMultiplicacionesCdp } from '@/hooks/useMultiplicacion';
import { useInvitacionesLider, useInvitarLider, useReenviarInvitacionLider } from '@/hooks/useInvitacionLider';
import { AsignarCargoDialog } from '@/components/casas-de-paz/AsignarCargoDialog';
import { CrearCdpDialog } from '@/components/casas-de-paz/CrearCdpDialog';
import { FusionarCdpDialog } from '@/components/casas-de-paz/FusionarCdpDialog';
import { MultiplicarCdpDialog } from '@/components/casas-de-paz/MultiplicarCdpDialog';
import { ConfirmarCambioDialog } from '@/components/shared/ConfirmarCambioDialog';
import { ConfirmarQuitarDialog } from '@/components/shared/ConfirmarQuitarDialog';
import type { CargoCdpCodigo, CargoRedCodigo, PersonaBusqueda } from '@/types/casas-de-paz.types';

/** Cuántas Casas de Paz se muestran antes de "Mostrar más" (escala a redes grandes). */
const LOTE = 10;

interface CargoDialogoRed { codigo: CargoRedCodigo; titulo: string; exclusivo: boolean; }
interface CargoDialogoCdp { cdpId: string; codigo: CargoCdpCodigo; titulo: string; exclusivo: boolean; }
type FiltroEstado = 'TODAS' | 'ACTIVAS' | 'INACTIVAS';

function IconoBadge({ color, icon: Icon, size = 'md' }: { color: string; icon: typeof Home; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl';
  const ic = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${dim}`}
      style={{
        background: `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 72%, #000) 100%)`,
        boxShadow: `0 8px 16px -6px color-mix(in oklab, ${color} 65%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.35)`,
      }}
    >
      <Icon className={`${ic} text-white`} strokeWidth={2.2} />
    </span>
  );
}

/**
 * Gestión de Casas de Paz del Líder de Red — acotada a SU red y pensada para
 * escalar: buscador, filtro por estado y "Mostrar más" para que una red con
 * decenas de Casas de Paz siga siendo navegable. Las acciones de cada Casa de
 * Paz viven en un menú (…) para mantener las filas compactas.
 */
export function GestionRedVista() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: roles, isLoading: cargandoRoles } = useMisRoles(iglesiaActivaId);
  const redes = roles?.redes_lider ?? [];

  const [redId, setRedId] = useState<string>();
  const redActiva = redId ?? redes[0]?.id;

  const { data: todasRedes = [] } = useRedes(iglesiaActivaId);
  const redInfo = todasRedes.find((r) => r.id === redActiva);

  const { data: cargos = [] } = useCargos();
  const { data: cdps = [], isLoading: cargandoCdps } = useCdps(iglesiaActivaId, redActiva);
  const cdpIds = cdps.map((c) => c.id);
  const activas = cdps.filter((c) => c.activo).length;

  const { data: fusiones = [] } = useFusionesCdp(iglesiaActivaId);
  const { data: multiplicaciones = [] } = useMultiplicacionesCdp(iglesiaActivaId);
  const { data: invitaciones = [] } = useInvitacionesLider(iglesiaActivaId);

  const fusionesRed = fusiones.filter((f) => cdpIds.includes(f.destino_id) || cdpIds.includes(f.origen_id));
  const multiplicacionesRed = multiplicaciones.filter((m) => cdpIds.includes(m.origen_id) || cdpIds.includes(m.nueva_id));
  const invitacionesRed = invitaciones.filter((inv) => inv.red_id === redActiva || (inv.casa_de_paz_id !== null && cdpIds.includes(inv.casa_de_paz_id)));

  // Búsqueda / filtro / paginación de Casas de Paz.
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('TODAS');
  const [visibles, setVisibles] = useState(LOTE);

  const cdpsFiltradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return cdps.filter((c) => {
      if (q && !c.etiqueta.toLowerCase().includes(q) && !(c.anfitrion_nombre ?? '').toLowerCase().includes(q)) return false;
      if (filtro === 'ACTIVAS' && !c.activo) return false;
      if (filtro === 'INACTIVAS' && c.activo) return false;
      return true;
    });
  }, [cdps, texto, filtro]);
  const cdpsVisibles = cdpsFiltradas.slice(0, visibles);

  const [mostrarCrearCdp, setMostrarCrearCdp] = useState(false);
  const [mostrarFusionar, setMostrarFusionar] = useState(false);
  const [mostrarMultiplicar, setMostrarMultiplicar] = useState(false);
  const [deshacerCdpId, setDeshacerCdpId] = useState<string>();
  const [cdpAEliminar, setCdpAEliminar] = useState<{ id: string; etiqueta: string }>();
  const [dialogoRed, setDialogoRed] = useState<CargoDialogoRed | null>(null);
  const [dialogoCdp, setDialogoCdp] = useState<CargoDialogoCdp | null>(null);

  const crearCdp = useCrearCdp(iglesiaActivaId);
  const toggleActivoCdp = useToggleActivoCdp();
  const eliminarCdp = useEliminarCdp();
  const asignarCargoRed = useAsignarCargoRed(iglesiaActivaId);
  const asignarCargoCdp = useAsignarCargoCdp(iglesiaActivaId);
  const quitarCargoRed = useQuitarCargoRed();
  const quitarCargoCdp = useQuitarCargoCdp();
  const fusionarCdp = useFusionarCdp();
  const deshacerFusionCdp = useDeshacerFusionCdp();
  const multiplicarCdp = useMultiplicarCdp();
  const invitarLider = useInvitarLider();
  const reenviarInvitacionLider = useReenviarInvitacionLider();

  const { data: vigentesRed = [], isLoading: cargandoVigentesRed } = useCargoVigenteRed(dialogoRed ? redActiva : undefined, dialogoRed?.codigo ?? 'LIDER_RED');
  const { data: vigentesCdp = [], isLoading: cargandoVigentesCdp } = useCargoVigenteCdp(dialogoCdp?.cdpId, dialogoCdp?.codigo ?? 'LIDER_CDP');

  function manejarError(e: unknown, generico: string) {
    const mensaje = (e as { message?: string } | null)?.message ?? '';
    if (mensaje.includes('CDP_INEXISTENTE')) toast.error('Esa casa de paz ya no existe');
    else if (mensaje.includes('CDP_CARGO_DUPLICADO')) toast.error('Ya hay alguien en ese cargo');
    else if (mensaje.includes('CARGO_IGLESIA_DISTINTA') || mensaje.includes('CDP_CARGO_IGLESIA_DISTINTA')) toast.error('Esa persona no pertenece a esta iglesia');
    else if (mensaje.includes('permission denied') || mensaje.includes('row-level security') || mensaje.includes('SIN_PERMISO')) toast.error('No tenés permiso para hacer este cambio');
    else if (mensaje.includes('PIN_INCORRECTO')) toast.error('El PIN es incorrecto');
    else if (mensaje.includes('FUSION_VENTANA_VENCIDA')) toast.error('Ya se subió un reporte después de la fusión: no se puede deshacer');
    else if (mensaje.includes('FUSION_YA_DESHECHA')) toast.error('Esta fusión ya fue deshecha');
    else if (mensaje.includes('MULTIPLICACION_SIN_MIEMBROS') || mensaje.includes('MULTIPLICACION_MIEMBROS_INVALIDOS')) toast.error('Elegí al menos una persona que se vaya a la nueva Casa de Paz');
    else if (mensaje.includes('Ya existe una cuenta con ese correo')) toast.error(mensaje);
    else toast.error(generico);
  }

  function manejarInvitarCdp(correo: string) {
    if (!dialogoCdp) return;
    invitarLider.mutate(
      { correo, rol: dialogoCdp.codigo as 'LIDER_CDP' | 'SUBLIDER_CDP', redId: null, casaDePazId: dialogoCdp.cdpId },
      { onSuccess: () => toast.success(`Invitación enviada a ${correo}`), onError: (e) => manejarError(e, 'No se pudo invitar') }
    );
  }
  function manejarReenviar(id: string) {
    reenviarInvitacionLider.mutate(id, { onSuccess: () => toast.success('Invitación reenviada'), onError: (e) => manejarError(e, 'No se pudo reenviar') });
  }
  function manejarRestablecer(correo: string) {
    solicitarRecuperacionContrasena(correo, `${obtenerUrlBase()}${ROUTES.COMPLETAR_CUENTA}`)
      .then(() => toast.success(`Enlace enviado a ${correo}`))
      .catch(() => toast.error('No se pudo enviar el enlace'));
  }
  function fusionarVarios(origenIds: string[], destinoId: string, motivo: string, pin?: string) {
    (async () => {
      for (const origenId of origenIds) await fusionarCdp.mutateAsync({ origenId, destinoId, motivo, pin });
      toast.success('Fusión realizada');
      setMostrarFusionar(false);
    })().catch((e) => manejarError(e, 'No se pudo fusionar'));
  }
  function manejarMultiplicar(params: { origenId: string; nombreNueva?: string; personaIds: string[]; liderNuevoId?: string; motivo: string; pin?: string }) {
    multiplicarCdp.mutate(params, {
      onSuccess: () => { toast.success('Casa de Paz multiplicada'); setMostrarMultiplicar(false); },
      onError: (e) => manejarError(e, 'No se pudo multiplicar'),
    });
  }
  function manejarToggleActivo(cdpId: string, activo: boolean) {
    toggleActivoCdp.mutate({ cdpId, activo }, {
      onSuccess: () => toast.success(activo ? 'Casa de Paz activada' : 'Casa de Paz desactivada'),
      onError: (e) => manejarError(e, 'No se pudo cambiar el estado'),
    });
  }
  function manejarEliminarCdp() {
    if (!cdpAEliminar) return;
    eliminarCdp.mutate(cdpAEliminar.id, {
      onSuccess: () => {
        toast.success('Casa de Paz eliminada');
        setCdpAEliminar(undefined);
      },
      onError: (e) => manejarError(e, 'No se pudo eliminar la casa de paz'),
    });
  }
  async function manejarAsignarRed(persona: PersonaBusqueda) {
    if (!dialogoRed || !redActiva) return;
    const cargo = cargos.find((c) => c.codigo === dialogoRed.codigo);
    if (!cargo) return;
    try {
      await asignarCargoRed.mutateAsync({ redId: redActiva, personaId: persona.id, codigo: dialogoRed.codigo, cargoId: cargo.id });
      toast.success(`${persona.nombre_completo} asignado`);
    } catch (e) { manejarError(e, 'No se pudo asignar el cargo'); }
  }
  async function manejarAsignarCdp(persona: PersonaBusqueda) {
    if (!dialogoCdp) return;
    const cargo = cargos.find((c) => c.codigo === dialogoCdp.codigo);
    if (!cargo) return;
    try {
      await asignarCargoCdp.mutateAsync({ cdpId: dialogoCdp.cdpId, personaId: persona.id, codigo: dialogoCdp.codigo, cargoId: cargo.id });
      toast.success(`${persona.nombre_completo} asignado`);
    } catch (e) { manejarError(e, 'No se pudo asignar el cargo'); }
  }

  if (cargandoRoles) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Encabezado + selector solo de SUS redes ───────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Gestión de Casas de Paz</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Administrá solo las Casas de Paz de tu Red.</p>
        </div>
        {redes.length > 1 && (
          <Select value={redActiva} onValueChange={(v) => { setRedId(v); setVisibles(LOTE); }}>
            <SelectTrigger className="w-full rounded-2xl sm:w-56"><SelectValue placeholder="Elegí una red" /></SelectTrigger>
            <SelectContent>{redes.map((r) => (<SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>))}</SelectContent>
          </Select>
        )}
      </div>

      {/* ── Identidad de la Red (hero) ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-6" style={{ background: 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-soft) 100%)' }}>
        <div className="pointer-events-none absolute -top-16 -right-12 h-52 w-52 rounded-full opacity-30 blur-3xl" style={{ background: TEAL }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: `linear-gradient(135deg, ${TEAL}, color-mix(in oklab, ${TEAL} 70%, #000))`, boxShadow: `0 10px 22px -8px color-mix(in oklab, ${TEAL} 70%, transparent)` }}>
              <Network className="h-7 w-7 text-white" strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-white/55 uppercase">Tu Red</p>
              <h2 className="font-heading text-2xl leading-tight font-bold tracking-tight text-white">{redInfo?.nombre ?? '—'}</h2>
              <p className="mt-1 text-[13px] text-white/70">Líder: {redInfo?.lider_nombre ?? '—'} · {activas} activa{activas === 1 ? '' : 's'} de {cdps.length} Casa{cdps.length === 1 ? '' : 's'} de Paz</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { codigo: 'SUBLIDER_RED', label: 'Sublíderes', exclusivo: false },
              { codigo: 'ENCARGADO_DEPARTAMENTOS_RED', label: 'Enc. Departamentos', exclusivo: true },
              { codigo: 'ENCARGADO_MINISTERIO_RED', label: 'Enc. Ministerio', exclusivo: true },
            ] as const).map((c) => (
              <Button key={c.codigo} variant="secondary" size="sm" className="rounded-full bg-white/12 text-white hover:bg-white/20"
                onClick={() => setDialogoRed({ codigo: c.codigo, titulo: `${c.label} de ${redInfo?.nombre ?? 'la Red'}`, exclusivo: c.exclusivo })}>
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Casas de Paz de la Red (foco principal, escalable) ─────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader
          icon={Home}
          color={TEAL}
          titulo="Casas de Paz"
          descripcion={`${activas} activa(s) de ${cdps.length} en tu Red`}
          accion={
            <Button size="sm" className="shrink-0 gap-1.5 rounded-xl" disabled={!redActiva} onClick={() => setMostrarCrearCdp(true)}>
              <Plus className="h-4 w-4" /> Nueva
            </Button>
          }
        />
        <div className="flex flex-col gap-3 p-5">
          {/* Buscador + filtro (clave para redes con muchas Casas de Paz) */}
          {cdps.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input className="h-10 rounded-xl border-border bg-muted/50 pl-10 text-[14px]" placeholder="Buscar Casa de Paz o anfitrión..." value={texto} onChange={(e) => { setTexto(e.target.value); setVisibles(LOTE); }} />
              </div>
              <Select value={filtro} onValueChange={(v) => { setFiltro(v as FiltroEstado); setVisibles(LOTE); }}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  <SelectItem value="ACTIVAS">Activas</SelectItem>
                  <SelectItem value="INACTIVAS">Inactivas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {cargandoCdps ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          ) : cdps.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Home className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Tu Red todavía no tiene Casas de Paz. Creá la primera con “Nueva”.</p>
            </div>
          ) : cdpsFiltradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ninguna Casa de Paz coincide con la búsqueda.</p>
          ) : (
            <>
              {/* Filas compactas: acciones en el menú (…) para que escale a muchas CdP */}
              {cdpsVisibles.map((cdp) => (
                <div key={cdp.id} className={`flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-2.5 transition-colors hover:border-primary/30 ${cdp.activo ? 'bg-card/70' : 'bg-muted/40'}`}>
                  <IconoBadge color={cdp.activo ? TEAL : '#8e8e93'} icon={Home} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-semibold text-foreground">
                      <span className="truncate">{cdp.etiqueta}</span>
                      {!cdp.activo && <Badge variant="outline" className="rounded-full border-muted-foreground/40 text-[10px] text-muted-foreground">Inactiva</Badge>}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      {cdp.miembros_count} miembros · {cdp.sublideres_count} sublíder(es)
                      {cdp.anfitrion_nombre && ` · Anfitrión: ${cdp.anfitrion_nombre}`}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0 rounded-lg text-muted-foreground hover:text-foreground" aria-label="Acciones">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => setDialogoCdp({ cdpId: cdp.id, codigo: 'LIDER_CDP', titulo: `Líder de ${cdp.etiqueta}`, exclusivo: true })}>Líder</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDialogoCdp({ cdpId: cdp.id, codigo: 'SUBLIDER_CDP', titulo: `Sublíderes de ${cdp.etiqueta}`, exclusivo: false })}>Sublíderes</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDialogoCdp({ cdpId: cdp.id, codigo: 'ANFITRION', titulo: `Anfitrión de ${cdp.etiqueta}`, exclusivo: true })}>Anfitrión</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => manejarToggleActivo(cdp.id, !cdp.activo)} className={cdp.activo ? 'text-destructive focus:text-destructive' : ''}>
                        <Power className="mr-2 h-4 w-4" /> {cdp.activo ? 'Desactivar' : 'Activar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setCdpAEliminar({ id: cdp.id, etiqueta: cdp.etiqueta })}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {cdpsFiltradas.length > visibles && (
                <Button variant="outline" className="mt-1 w-full rounded-xl" onClick={() => setVisibles((v) => v + LOTE)}>
                  Mostrar más ({cdpsFiltradas.length - visibles} restantes)
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Operaciones especiales (solo entre CdP de la red) ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={GitMerge} color={AZUL} titulo="Fusionar Casas de Paz" descripcion="Uní dos Casas de Paz en una; se conserva todo el historial" />
          <div className="flex flex-col gap-3 p-5">
            <Button variant="outline" className="w-fit gap-1.5 rounded-xl" disabled={activas < 2} onClick={() => setMostrarFusionar(true)}>
              <GitMerge className="h-4 w-4" /> Fusionar
            </Button>
            {fusionesRed.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin fusiones todavía.</p>
            ) : (
              fusionesRed.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate"><span className="text-muted-foreground">{f.origen_etiqueta}</span> → <span className="font-medium">{f.destino_etiqueta}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{new Date(f.fecha_fusion).toLocaleDateString('es-BO')} · {f.motivo}{f.deshecha_en && ` · Deshecha`}</p>
                  </div>
                  {f.puede_deshacer && (
                    <Button variant="ghost" size="sm" className="w-fit shrink-0 gap-1.5" onClick={() => setDeshacerCdpId(f.id)}><Undo2 className="h-4 w-4" /> Deshacer</Button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={GitBranch} color={MORADO} titulo="Multiplicar Casa de Paz" descripcion="Dividí una Casa de Paz y llevá miembros a una nueva" />
          <div className="flex flex-col gap-3 p-5">
            <Button variant="outline" className="w-fit gap-1.5 rounded-xl" disabled={activas === 0} onClick={() => setMostrarMultiplicar(true)}>
              <GitBranch className="h-4 w-4" /> Multiplicar
            </Button>
            {multiplicacionesRed.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin multiplicaciones todavía.</p>
            ) : (
              multiplicacionesRed.map((m) => (
                <div key={m.id} className="rounded-xl border border-border/70 px-3 py-2 text-sm">
                  <p className="truncate"><span className="text-muted-foreground">{m.origen_etiqueta}</span> → <span className="font-medium">{m.nueva_etiqueta}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{new Date(m.fecha_multiplicacion).toLocaleDateString('es-BO')} · {m.cantidad_movidos} persona(s) · {m.motivo}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Invitaciones (acotadas a la red) ───────────────────────────────────── */}
      {invitacionesRed.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <TarjetaHeader icon={Mail} color={AMBAR} titulo="Invitaciones a líderes" descripcion="De las Casas de Paz de tu Red" />
          <div className="flex flex-col gap-2 p-5">
            {invitacionesRed.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{inv.correo}</p>
                  <p className="truncate text-xs text-muted-foreground">{inv.casa_de_paz_etiqueta ?? inv.red_nombre} · {new Date(inv.fecha_creacion).toLocaleDateString('es-BO')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {inv.estado === 'PENDIENTE' ? (
                    <>
                      <Badge variant="outline" className="border-amber-500 text-amber-600">Pendiente</Badge>
                      <Button variant="ghost" size="sm" className="gap-1.5" disabled={reenviarInvitacionLider.isPending} onClick={() => manejarReenviar(inv.id)}><RefreshCw className="h-3.5 w-3.5" /> Reenviar</Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="border-emerald-500 text-emerald-600">Completada</Badge>
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => manejarRestablecer(inv.correo)}><KeyRound className="h-3.5 w-3.5" /> Restablecer contraseña</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Diálogos ───────────────────────────────────────────────────────────── */}
      <CrearCdpDialog
        open={mostrarCrearCdp}
        onOpenChange={setMostrarCrearCdp}
        redNombre={redInfo?.nombre}
        iglesiaId={iglesiaActivaId}
        creando={crearCdp.isPending}
        onCrear={(datos) => {
          if (!redActiva) return;
          crearCdp.mutate({ redId: redActiva, datos }, {
            onSuccess: () => { toast.success('Casa de Paz creada'); setMostrarCrearCdp(false); },
            onError: (e) => manejarError(e, 'No se pudo crear la casa de paz'),
          });
        }}
      />

      {dialogoRed && (
        <AsignarCargoDialog
          open={!!dialogoRed}
          onOpenChange={(open) => !open && setDialogoRed(null)}
          titulo={dialogoRed.titulo}
          exclusivo={dialogoRed.exclusivo}
          iglesiaId={iglesiaActivaId}
          vigentes={vigentesRed}
          cargandoVigentes={cargandoVigentesRed}
          asignando={asignarCargoRed.isPending}
          onAsignar={manejarAsignarRed}
          onQuitar={(id) => quitarCargoRed.mutate(id, { onError: (e) => manejarError(e, 'No se pudo quitar el cargo') })}
        />
      )}

      {dialogoCdp && (
        <AsignarCargoDialog
          open={!!dialogoCdp}
          onOpenChange={(open) => !open && setDialogoCdp(null)}
          titulo={dialogoCdp.titulo}
          exclusivo={dialogoCdp.exclusivo}
          iglesiaId={iglesiaActivaId}
          vigentes={vigentesCdp}
          cargandoVigentes={cargandoVigentesCdp}
          asignando={asignarCargoCdp.isPending}
          onAsignar={manejarAsignarCdp}
          onQuitar={(id) => quitarCargoCdp.mutate(id, { onError: (e) => manejarError(e, 'No se pudo quitar el cargo') })}
          invitable={dialogoCdp.codigo === 'LIDER_CDP' || dialogoCdp.codigo === 'SUBLIDER_CDP'}
          invitando={invitarLider.isPending}
          onInvitar={manejarInvitarCdp}
        />
      )}

      <FusionarCdpDialog open={mostrarFusionar} onOpenChange={setMostrarFusionar} cdps={cdps.filter((c) => c.activo)} procesando={fusionarCdp.isPending} onFusionar={fusionarVarios} />
      <MultiplicarCdpDialog open={mostrarMultiplicar} onOpenChange={setMostrarMultiplicar} cdps={cdps.filter((c) => c.activo)} procesando={multiplicarCdp.isPending} onMultiplicar={manejarMultiplicar} />

      <ConfirmarCambioDialog
        open={!!deshacerCdpId}
        onOpenChange={(open) => !open && setDeshacerCdpId(undefined)}
        titulo="Deshacer fusión de Casas de Paz"
        descripcion="La Casa de Paz absorbida vuelve a estar activa y sus miembros regresan."
        procesando={deshacerFusionCdp.isPending}
        onConfirmar={(motivo, pin) => {
          if (!deshacerCdpId) return;
          deshacerFusionCdp.mutate({ fusionId: deshacerCdpId, motivo, pin }, {
            onSuccess: () => { toast.success('Fusión deshecha'); setDeshacerCdpId(undefined); },
            onError: (e) => manejarError(e, 'No se pudo deshacer la fusión'),
          });
        }}
      />

      <ConfirmarQuitarDialog
        open={!!cdpAEliminar}
        onOpenChange={(open) => !open && setCdpAEliminar(undefined)}
        titulo="Eliminar Casa de Paz"
        descripcion={
          cdpAEliminar
            ? `¿Seguro que querés eliminar "${cdpAEliminar.etiqueta}"? Se desactiva y deja de aparecer en el sistema. Esta acción no se puede deshacer.`
            : undefined
        }
        procesando={eliminarCdp.isPending}
        onConfirmar={manejarEliminarCdp}
        textoConfirmar="Sí, eliminar"
        textoProcesando="Eliminando..."
      />
    </div>
  );
}
