/**
 * KAN-405 + KAN-485: pantalla "Colaborar" -- accesible para cualquier rol
 * logueado. Pantalla propia SIN AppShell/sidebar (barra oscura propia, se
 * autoprotege con isAuthenticated), mismo patrón que EstructuraOrganizacional.
 *
 * KAN-485 (portal intermedio, harness/22-colaborar-portal-departamentos):
 * al canjear el código, la persona NO cae directo en un formulario -- pasa
 * por un portal de 2 niveles hecho con tarjetas:
 *   1. Nivel 1: tarjeta del DEPARTAMENTO (hoy solo Afirmación; el diseño
 *      anticipa más departamentos a futuro).
 *   2. Nivel 2: tarjetas de COLABORACIÓN (Altar, Bautismo, RSIL, Membresía).
 *      El código habilita todas (sin granularidad por tarea).
 *   3. Al elegir una colaboración se abre su pantalla de proceso -- Altar ya
 *      existe (se reusa `AfirmacionAltar` con la iglesia de la colaboración);
 *      el resto queda "Próximamente" hasta que se construyan (Matías).
 * Cada colaboración tiene botón "volver al portal". El colaborador ve en los
 * listados solo lo que él registró (ya resuelto en Altar por RPC).
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  Handshake,
  Clock,
  Pause,
  ChevronRight,
  Church,
  Droplets,
  HeartPulse,
  ClipboardList,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';
import { useMiColaboracionActiva, useRedimirCodigoColaborador } from '@/hooks/useColaborador';
import { useCuentaRegresiva } from '@/hooks/useCuentaRegresiva';
import { DEPARTAMENTO_META } from '@/utils/departamentos';
import { AfirmacionAltar } from '@/pages/AfirmacionAltar';
// harness/24: Bautismo, clon de Altar embebido en el portal (Req 7).
import { AfirmacionBautismo } from '@/pages/AfirmacionBautismo';
// harness/24: RSIL, clon de Bautismo embebido en el portal (Req 7).
import { AfirmacionRSIL } from '@/pages/AfirmacionRSIL';
// KAN-488: Membresía desde 0, embebida en el portal igual que Altar/Bautismo/RSIL.
import { AfirmacionMembresiaNuevos } from '@/pages/AfirmacionMembresiaNuevos';
import type { MiColaboracionActiva } from '@/types/colaborador.types';

// Nombre visible de cada departamento (DEPARTAMENTO_META solo trae verbo+color).
const DEPARTAMENTO_NOMBRE: Record<string, string> = {
  AFIRMACION: 'Afirmación',
  EVANGELISMO: 'Evangelismo',
  DISCIPULADO: 'Discipulado',
  ENVIO: 'Envío',
};

interface ColaboracionItem {
  codigo: string;
  label: string;
  /** Nombre corto para la lista resumida de la tarjeta de departamento
   * (evita que se trunque). Si no se define, se usa `label`. */
  labelCorto?: string;
  descripcion: string;
  icono: LucideIcon;
  /** false => tarjeta "Próximamente" hasta que exista la pantalla (Matías). */
  disponible: boolean;
}

// Catálogo de colaboraciones por departamento. Hoy solo Afirmación, con sus 4
// tareas -- el código habilita todas (harness/22, sin granularidad por tarea).
const COLABORACIONES_POR_DEPARTAMENTO: Record<string, ColaboracionItem[]> = {
  AFIRMACION: [
    { codigo: 'ALTAR', label: 'Altar', descripcion: 'Registrar personas del altar', icono: Church, disponible: true },
    { codigo: 'BAUTISMO', label: 'Bautismo', descripcion: 'Registrar bautismos', icono: Droplets, disponible: true },
    { codigo: 'RSIL', label: 'Retiro de Sanidad Interior', labelCorto: 'RSIL', descripcion: 'Registrar el retiro', icono: HeartPulse, disponible: true },
    { codigo: 'MEMBRESIA', label: 'Membresía', descripcion: 'Membresía desde 0', icono: ClipboardList, disponible: true },
  ],
};

function fondoIcono(color: string) {
  return { backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color };
}

// Barra superior propia, sin sidebar -- mismo tono oscuro que usa
// EstructuraOrganizacional para pantallas fuera de AppShell.
function EncabezadoColaborar({ iglesiaNombre, texto, pausado }: { iglesiaNombre?: string; texto?: string; pausado?: boolean }) {
  return (
    <header className="z-20 border-b border-white/10 bg-[#0a0e1a] px-4 py-3.5 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
        <Link
          to={ROUTES.DASHBOARD}
          aria-label="Volver a mi panel"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex min-w-0 shrink items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain brightness-0 invert" />
          <span className="flex min-w-0 items-baseline gap-1.5 text-[15px] text-white">
            <span className="shrink-0 font-bold">Colaborar</span>
            {iglesiaNombre && <span className="truncate font-normal text-white/60">— {iglesiaNombre}</span>}
          </span>
        </div>
        {texto && (
          <Badge variant="outline" className="ml-auto gap-1.5 border-white/20 bg-white/5 text-[12px] font-semibold text-white">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums">{texto}</span>
            {pausado && <span className="text-white/60">(pausada)</span>}
          </Badge>
        )}
      </div>
    </header>
  );
}

// Aviso discreto (pedido del owner 2026-09-30): el mensaje es importante pero
// NO debe ser protagonista -- nota sutil de una línea con ícono chico, sin la
// caja roja llamativa de antes.
function AvisoResponsabilidad() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-muted-foreground">
      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
      <span>
        <span className="font-medium text-foreground/80">Sos responsable de los datos que cargues.</span>{' '}
        Acceso temporal, acotado a Afirmación.
      </span>
    </p>
  );
}

function FormularioCodigo() {
  const [codigo, setCodigo] = useState('');
  const redimir = useRedimirCodigoColaborador();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    redimir.mutate(codigo.trim(), {
      onSuccess: () => {
        toast.success('¡Listo! Ya sos Colaborador/a.');
        setCodigo('');
      },
      onError: (err: unknown) => {
        const mensaje = (err as { message?: string } | null)?.message ?? '';
        if (mensaje.includes('COLABORADOR_CODIGO_INVALIDO')) {
          toast.error('Ese código no existe o ya fue revocado.');
        } else {
          toast.error('No se pudo validar el código. Intentá de nuevo.');
        }
      },
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Handshake className="h-7 w-7 text-primary" />
      </div>
      <div className="text-center">
        <h1 className="text-lg font-bold tracking-tight">Colaborar</h1>
        <p className="text-sm text-muted-foreground">Ingresá el código que te compartió el líder del área.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <Input
          className={cn(CAMPO_ESTILO, 'text-center text-lg font-bold tracking-[0.3em] uppercase')}
          placeholder="CÓDIGO"
          maxLength={8}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          autoFocus
        />
        <Button type="submit" disabled={redimir.isPending || !codigo.trim()}>
          {redimir.isPending ? 'Validando...' : 'Entrar como Colaborador/a'}
        </Button>
      </form>
    </div>
  );
}

// ─── Portal de 2 niveles (KAN-485) ───────────────────────────────────────────

function TarjetaDepartamento({
  nombre,
  color,
  colaboraciones,
  onAbrir,
}: {
  nombre: string;
  color: string;
  colaboraciones: ColaboracionItem[];
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted/40 sm:gap-6 sm:rounded-3xl sm:p-8"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:h-20 sm:w-20 sm:rounded-3xl" style={fondoIcono(color)}>
        <Building2 className="h-7 w-7 sm:h-10 sm:w-10" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold sm:text-2xl">{nombre}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground sm:mt-1 sm:text-base">
          {colaboraciones.map((c) => c.labelCorto ?? c.label).join(' · ')}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground sm:h-7 sm:w-7" />
    </button>
  );
}

function TarjetaColaboracion({ c, color, onAbrir }: { c: ColaboracionItem; color: string; onAbrir: () => void }) {
  const Icono = c.icono;
  return (
    <button
      type="button"
      onClick={onAbrir}
      disabled={!c.disponible}
      className={cn(
        'relative flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors sm:gap-4 sm:p-5',
        c.disponible ? 'hover:bg-muted/40' : 'cursor-not-allowed opacity-60',
      )}
    >
      {/* Badge "Próximamente" en la esquina para que no le coma ancho al
          título (los nombres largos como RSIL quedaban apretados a su lado). */}
      {!c.disponible && (
        <Badge variant="outline" className="absolute top-2.5 right-2.5 text-[10px] sm:text-[11px]">Próximamente</Badge>
      )}
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12" style={fondoIcono(color)}>
        <Icono className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold sm:text-base', !c.disponible && 'pr-20 sm:pr-24')}>{c.label}</p>
        <p className="text-xs text-muted-foreground sm:text-[13px]">{c.descripcion}</p>
      </div>
      {c.disponible && (
        <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground sm:h-5 sm:w-5" />
      )}
    </button>
  );
}

function PortalColaborar({ colaboracion }: { colaboracion: MiColaboracionActiva }) {
  const dep = colaboracion.departamento_codigo;
  const color = DEPARTAMENTO_META[dep]?.color ?? '#0071E3';
  const nombreDep = DEPARTAMENTO_NOMBRE[dep] ?? dep;
  const colaboraciones = COLABORACIONES_POR_DEPARTAMENTO[dep] ?? [];

  const [departamentoAbierto, setDepartamentoAbierto] = useState<string | null>(null);
  const [colaboracionAbierta, setColaboracionAbierta] = useState<string | null>(null);

  // Nivel 3: pantalla del proceso (hoy solo Altar). Aviso arriba + Altar
  // top-aligned -- Altar es alto y trae su propio centrado interno.
  if (colaboracionAbierta === 'ALTAR') {
    return (
      <div className="flex flex-col gap-5">
        <AvisoResponsabilidad />
        <AfirmacionAltar iglesiaId={colaboracion.iglesia_id} onVolver={() => setColaboracionAbierta(null)} />
      </div>
    );
  }

  // harness/24: Bautismo, mismo tratamiento embebido que Altar.
  if (colaboracionAbierta === 'BAUTISMO') {
    return (
      <div className="flex flex-col gap-5">
        <AvisoResponsabilidad />
        <AfirmacionBautismo iglesiaId={colaboracion.iglesia_id} onVolver={() => setColaboracionAbierta(null)} />
      </div>
    );
  }

  // harness/24: RSIL, mismo tratamiento embebido que Altar/Bautismo.
  if (colaboracionAbierta === 'RSIL') {
    return (
      <div className="flex flex-col gap-5">
        <AvisoResponsabilidad />
        <AfirmacionRSIL iglesiaId={colaboracion.iglesia_id} onVolver={() => setColaboracionAbierta(null)} />
      </div>
    );
  }

  // KAN-488: Membresía desde 0, mismo tratamiento embebido.
  if (colaboracionAbierta === 'MEMBRESIA') {
    return (
      <div className="flex flex-col gap-5">
        <AvisoResponsabilidad />
        <AfirmacionMembresiaNuevos iglesiaId={colaboracion.iglesia_id} onVolver={() => setColaboracionAbierta(null)} />
      </div>
    );
  }

  // Niveles 1 y 2: el aviso + las tarjetas se centran como UN grupo en el
  // espacio disponible (no el aviso pegado arriba y las tarjetas flotando
  // abajo) -- así en desktop/tablet queda balanceado, mismo criterio "prolijo"
  // que la pantalla de Altar.

  // Nivel 2: colaboraciones del departamento. Grupo centrado; títulos también
  // centrados (misma alineación que el aviso). Tarjetas en 2 columnas a
  // partir de sm, más grandes en desktop.
  if (departamentoAbierto === dep) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-5 py-4">
        <button
          type="button"
          onClick={() => setDepartamentoAbierto(null)}
          className="flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <AvisoResponsabilidad />
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{nombreDep}</h2>
          <p className="text-sm text-muted-foreground sm:text-base">Elegí la colaboración que vas a registrar.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {colaboraciones.map((c) => (
            <TarjetaColaboracion
              key={c.codigo}
              c={c}
              color={color}
              onAbrir={() => c.disponible && setColaboracionAbierta(c.codigo)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Nivel 1: departamento. Acotado (max-w-lg) y centrado para que la única
  // tarjeta no se estire en desktop; títulos centrados.
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 py-4">
      <AvisoResponsabilidad />
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Tus colaboraciones</h2>
          <p className="text-sm text-muted-foreground sm:text-base">Elegí el área en la que vas a colaborar.</p>
        </div>
        <TarjetaDepartamento
          nombre={nombreDep}
          color={color}
          colaboraciones={colaboraciones}
          onAbrir={() => setDepartamentoAbierto(dep)}
        />
      </div>
    </div>
  );
}

export function Colaborar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: colaboracion, isLoading } = useMiColaboracionActiva();
  const { texto, vencido } = useCuentaRegresiva(colaboracion?.fecha_fin);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col bg-muted/40">
        <EncabezadoColaborar />
        <div className="p-6"><Skeleton className="h-64 w-full rounded-2xl" /></div>
      </div>
    );
  }

  if (!colaboracion || vencido) {
    return (
      <div className="flex min-h-svh flex-col bg-muted/40">
        <EncabezadoColaborar />
        <FormularioCodigo />
      </div>
    );
  }

  const pausado = colaboracion.estado === 'PAUSADO';

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <EncabezadoColaborar iglesiaNombre={colaboracion.iglesia_nombre} texto={texto} pausado={pausado} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 sm:p-6">
        {pausado ? (
          <>
            <AvisoResponsabilidad />
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-12 text-center">
              <Pause className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                El líder pausó tu colaboración. Vas a recuperar el acceso apenas la reanude.
              </p>
            </div>
          </>
        ) : (
          <PortalColaborar colaboracion={colaboracion} />
        )}
      </main>
    </div>
  );
}
