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
  descripcion: string;
  icono: LucideIcon;
  /** false => tarjeta "Próximamente" hasta que exista la pantalla (Matías). */
  disponible: boolean;
}

// Catálogo de colaboraciones por departamento. Hoy solo Afirmación, con sus 4
// tareas -- el código habilita todas (harness/22, sin granularidad por tarea).
const COLABORACIONES_POR_DEPARTAMENTO: Record<string, ColaboracionItem[]> = {
  AFIRMACION: [
    { codigo: 'ALTAR', label: 'Altar', descripcion: 'Registrar personas que pasan al altar', icono: Church, disponible: true },
    { codigo: 'BAUTISMO', label: 'Bautismo', descripcion: 'Registrar bautismos', icono: Droplets, disponible: false },
    { codigo: 'RSIL', label: 'Retiro de Sanidad Interior', descripcion: 'Registrar el retiro', icono: HeartPulse, disponible: false },
    { codigo: 'MEMBRESIA', label: 'Membresía', descripcion: 'Membresía desde 0', icono: ClipboardList, disponible: false },
  ],
};

function fondoIcono(color: string) {
  return { backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color };
}

// Barra superior propia, sin sidebar -- mismo tono oscuro que usa
// EstructuraOrganizacional para pantallas fuera de AppShell.
function EncabezadoColaborar({ iglesiaNombre, texto, pausado }: { iglesiaNombre?: string; texto?: string; pausado?: boolean }) {
  return (
    <header className="z-20 border-b border-white/10 bg-[#0a0e1a] px-4 py-3 sm:px-6">
      <div className="flex items-center gap-4">
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

function AvisoResponsabilidad() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3.5">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <p className="text-[13px] leading-relaxed text-foreground">
        <span className="font-semibold text-destructive">Sos responsable de los datos que cargues acá.</span>{' '}
        Este acceso es temporal y acotado a Afirmación -- solo podés registrar personas nuevas durante esta colaboración.
        Escribí los datos con cuidado antes de guardar.
      </p>
    </div>
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
      className="flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted/40"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={fondoIcono(color)}>
        <Building2 className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">{nombre}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {colaboraciones.map((c) => c.label).join(' · ')}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
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
        'flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors',
        c.disponible ? 'hover:bg-muted/40' : 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={fondoIcono(color)}>
        <Icono className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{c.label}</p>
        <p className="text-xs text-muted-foreground">{c.descripcion}</p>
      </div>
      {c.disponible ? (
        <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
      ) : (
        <Badge variant="outline" className="shrink-0 self-center text-[10px]">Próximamente</Badge>
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

  // Niveles 1 y 2: el aviso + las tarjetas se centran como UN grupo en el
  // espacio disponible (no el aviso pegado arriba y las tarjetas flotando
  // abajo) -- así en desktop/tablet queda balanceado, mismo criterio "prolijo"
  // que la pantalla de Altar.

  // Nivel 2: colaboraciones del departamento.
  if (departamentoAbierto === dep) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-5 py-4">
        <AvisoResponsabilidad />
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setDepartamentoAbierto(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div>
            <h2 className="text-lg font-bold tracking-tight">{nombreDep}</h2>
            <p className="text-sm text-muted-foreground">Elegí la colaboración que vas a registrar.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>
    );
  }

  // Nivel 1: departamento.
  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-4">
      <AvisoResponsabilidad />
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Tus colaboraciones</h2>
          <p className="text-sm text-muted-foreground">Elegí el área en la que vas a colaborar.</p>
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

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
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
