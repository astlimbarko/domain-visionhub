import { useMemo, useState } from 'react';
import { AlertTriangle, Cake, Check, ChevronDown, MessageCircle, Search, User, UserRound, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SeccionIconHeader } from '@/components/shared/SeccionIconHeader';
import { useHistorialAsistencia } from '@/hooks/useReporte';
import { fechaLegible } from '@/utils/calendario-fechas';
import { cn } from '@/lib/utils';
import type { MiembroAsistencia } from '@/types/reporte.types';

interface Props {
  casaDePazId: string | undefined;
}

const UMBRAL_URGENCIA = 2;
// Con una CdP grande (100+ miembros) mostrar la lista entera de una es lo
// contrario a "búsqueda rápida" -- se listan los más urgentes primero (el
// orden ya viene así) y se corta ahí; buscar por nombre o tocar "solo
// urgentes" siempre muestra el resultado completo, sin el límite.
const LIMITE_INICIAL = 12;

function iniciales(nombreCompleto: string) {
  const palabras = nombreCompleto.trim().split(/\s+/);
  return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase();
}

// Paleta fija para los avatares -- cada persona siempre cae en el mismo color
// (hash del persona_id, no random), pero entre miembros distintos varía en
// vez de repetir un solo tono para toda la lista. Sin rojo/ámbar/verde: esos
// quedan reservados para las señales de asistencia/urgencia.
const PALETA_AVATAR = ['#ec4899', '#8b5cf6', '#6366f1', '#06b6d4', '#f97316', '#14b8a6'];

function colorAvatar(personaId: string) {
  let hash = 0;
  for (let i = 0; i < personaId.length; i++) hash = (hash * 31 + personaId.charCodeAt(i)) % PALETA_AVATAR.length;
  return PALETA_AVATAR[Math.abs(hash)];
}

/** Cuenta las faltas mas recientes seguidas, contando desde la reunion mas nueva hacia atras. */
function faltasConsecutivas(asistio: boolean[]) {
  let n = 0;
  for (const presente of asistio) {
    if (presente) break;
    n++;
  }
  return n;
}

/**
 * Bolivia es el unico locale que usa el resto de la app (ver `es-BO` en
 * GestionSubliderVista), y los numeros locales se guardan sin codigo de
 * pais -- se antepone 591 solo cuando el numero todavia no lo trae.
 */
function numeroWhatsapp(numero: string) {
  const digitos = numero.replace(/\D/g, '');
  return digitos.startsWith('591') || digitos.length > 8 ? digitos : `591${digitos}`;
}

export function HistorialAsistencia({ casaDePazId }: Props) {
  const { data, isLoading } = useHistorialAsistencia(casaDePazId);
  const [busqueda, setBusqueda] = useState('');
  const [soloUrgentes, setSoloUrgentes] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const miembrosOrdenados = useMemo(() => {
    const miembros = data?.miembros ?? [];
    return miembros
      .map((m) => ({ ...m, faltas: faltasConsecutivas(m.asistio) }))
      .sort((a, b) => b.faltas - a.faltas || a.nombre_completo.localeCompare(b.nombre_completo));
  }, [data]);

  const totalUrgentes = miembrosOrdenados.filter((m) => m.faltas >= UMBRAL_URGENCIA).length;

  const miembrosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return miembrosOrdenados.filter((m) => {
      if (soloUrgentes && m.faltas < UMBRAL_URGENCIA) return false;
      if (texto && !m.nombre_completo.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [miembrosOrdenados, busqueda, soloUrgentes]);

  // Buscar por nombre o filtrar "solo urgentes" ya achica la lista por su cuenta,
  // así que el límite solo aplica a la vista por defecto (sin filtro activo).
  const hayFiltroActivo = busqueda.trim() !== '' || soloUrgentes;
  const miembrosVisibles = hayFiltroActivo || mostrarTodos ? miembrosFiltrados : miembrosFiltrados.slice(0, LIMITE_INICIAL);
  const restantes = miembrosFiltrados.length - miembrosVisibles.length;

  // El historial completo va del mas viejo al mas nuevo (lectura natural, izquierda a derecha)
  // para el detalle expandido; los reuniones ya vienen del backend de la mas nueva a la mas vieja.
  const reunionesRecientesPrimero = data?.reuniones ?? [];

  return (
    <div className="glass-card-elevated rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SeccionIconHeader
          icon={Users}
          color="var(--muted-foreground)"
          titulo="Miembros"
          descripcion={
            totalUrgentes > 0
              ? `${totalUrgentes} miembro${totalUrgentes === 1 ? '' : 's'} con 2+ faltas seguidas`
              : 'Tocá un miembro para ver su ficha completa'
          }
          size="sm"
        />
        {data && data.miembros.length > 0 && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <div className="relative flex-1 sm:w-48 sm:flex-none">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar miembro..."
                className="h-9 rounded-xl border-border/60 bg-background pl-8 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setSoloUrgentes((v) => !v)}
              className={cn(
                'shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all',
                soloUrgentes
                  ? 'border-destructive bg-destructive text-white shadow-sm shadow-destructive/25'
                  : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              Solo urgentes
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      ) : !data || data.miembros.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Esta Casa de Paz todavía no tiene miembros registrados.</p>
      ) : data.reuniones.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no hay reuniones reportadas para armar un historial.</p>
      ) : miembrosFiltrados.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Ningún miembro coincide con ese filtro.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {miembrosVisibles.map((m) => (
            <FilaMiembro key={m.persona_id} miembro={m} reuniones={reunionesRecientesPrimero} />
          ))}
          {restantes > 0 && (
            <button
              type="button"
              onClick={() => setMostrarTodos(true)}
              className="mt-1 rounded-xl border border-dashed border-border/70 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              Mostrar {restantes} miembro{restantes === 1 ? '' : 's'} más
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilaMiembro({
  miembro,
  reuniones,
}: {
  miembro: MiembroAsistencia & { faltas: number };
  reuniones: { id: string; fecha_reunion: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  // El resumen compacto se lee de izquierda a derecha en orden cronologico
  // (reuniones/asistio vienen del backend de la mas nueva a la mas vieja).
  const puntosCronologicos = useMemo(() => {
    const asistioCronologico = [...miembro.asistio].reverse();
    return [...reuniones].reverse().map((r, i) => ({ reunion: r, asistio: asistioCronologico[i] }));
  }, [reuniones, miembro.asistio]);
  const urgente = miembro.faltas >= UMBRAL_URGENCIA;
  const whatsapp = miembro.telefono ? numeroWhatsapp(miembro.telefono) : null;
  const colorPersona = colorAvatar(miembro.persona_id);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-colors',
        urgente ? 'border-destructive/40 bg-destructive/5' : 'border-border/60 bg-muted/20'
      )}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full flex-col gap-3 p-3 text-left sm:flex-row sm:items-center"
        aria-expanded={abierto}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ backgroundColor: `color-mix(in oklab, ${colorPersona} 16%, transparent)`, color: colorPersona }}
          >
            {iniciales(miembro.nombre_completo) || <UserRound className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-medium">{miembro.nombre_completo}</span>
              {urgente && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
                  <AlertTriangle className="h-3 w-3" />
                  {miembro.faltas} faltas seguidas
                </span>
              )}
            </div>
            {/* Punto lleno = asistió, punto hueco = faltó -- se lee sin depender del color. */}
            <div className="mt-1.5 flex items-center gap-1">
              {puntosCronologicos.map(({ reunion, asistio }) => (
                <span
                  key={reunion.id}
                  title={`${fechaLegible(reunion.fecha_reunion)}: ${asistio ? 'Asistió' : 'Faltó'}`}
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    asistio ? 'bg-[var(--chart-2)]' : 'border-[1.5px] border-muted-foreground/30'
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Escribir a ${miembro.nombre_completo} por WhatsApp`}
              title="Enviar WhatsApp"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366] transition-colors hover:bg-[#25D366]/25"
            >
              <MessageCircle className="h-4.5 w-4.5" />
            </a>
          )}
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-180')} />
        </div>
      </button>

      {abierto && (
        <div className="flex flex-col gap-4 border-t border-border/60 bg-background/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {miembro.sexo === 'M' ? 'Masculino' : 'Femenino'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium">
              <Cake className="h-3.5 w-3.5 text-muted-foreground" />
              {miembro.edad != null ? `${miembro.edad} años` : 'Edad no registrada'}
            </span>
          </div>

          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#25D366]/30 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar mensaje por WhatsApp
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">Esta persona no tiene un teléfono principal registrado.</p>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Historial de reuniones</p>
            <div className="flex flex-col gap-1">
              {reuniones.map((r, i) => {
                const presente = miembro.asistio[i];
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm even:bg-muted/30">
                    <span className="truncate">{fechaLegible(r.fecha_reunion)}</span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                        presente ? 'bg-[var(--chart-2)]/15 text-[var(--chart-2)]' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {presente ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {presente ? 'Asistió' : 'Faltó'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
