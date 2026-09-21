/**
 * KAN-405: pantalla "Colaborar" -- accesible para cualquier rol logueado.
 * Pedido explícito del owner (2026-09-21, en vivo): mientras el permiso de
 * Colaborador está activo, la persona NO ve el panel/sidebar de su rol
 * normal -- es una pantalla propia, separada, sin AppShell (mismo patrón
 * que EstructuraOrganizacional: barra superior oscura propia, se
 * autoprotege con isAuthenticated). Ve SOLO 3 cosas:
 *   1. El formulario de membresía (alta) -- se monta como caja negra
 *      (`<RegistrarPersonaAfirmacion iglesiaId={...} />`, misma interfaz
 *      pública de siempre). El owner está rediseñando ese componente en
 *      paralelo (paginado -> una sola página + borrador autoguardado) en
 *      otra sesión -- a propósito NO se toca ese archivo ni sus internos
 *      desde acá, para no pisarse. La capacidad de "reabrir y corregir lo
 *      que uno mismo cargó" (pedida originalmente) queda para un fast-follow
 *      una vez que ese rediseño esté estable -- fn_editar_persona_afirmacion/
 *      fn_obtener_persona_editar_afirmacion (20260921100700_kan405_edicion_
 *      propia_colaborador.sql) ya están listas del lado del backend.
 *   2. Su propio historial -- de solo lectura por ahora (a quién registró y
 *      cuántos son).
 *   3. Avisos de responsabilidad/seguridad sobre lo que está haciendo.
 * Nada de Casas de Paz/Redes ni ningún otro módulo -- alcance acotado a
 * propósito.
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Handshake, ShieldAlert, UserPlus, History, Clock, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/utils/constants';
import { useMiColaboracionActiva, useMiHistorialColaborador, useRedimirCodigoColaborador } from '@/hooks/useColaborador';
import { useCuentaRegresiva } from '@/hooks/useCuentaRegresiva';
import { RegistrarPersonaAfirmacion } from '@/components/afirmacion/RegistrarPersonaAfirmacion';

function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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

// KAN-405 seguimiento: de solo lectura por ahora -- ver nota de arriba
// (edición en pausa hasta que el rediseño de RegistrarPersonaAfirmacion
// esté estable).
function MiHistorial() {
  const { data: historial = [], isLoading } = useMiHistorialColaborador(true);

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Registraste <span className="font-semibold text-foreground">{historial.length}</span> persona{historial.length === 1 ? '' : 's'} en esta colaboración.
      </p>
      {historial.length === 0 ? (
        <p className="rounded-2xl border border-border/50 bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no cargaste a nadie.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {historial.map((h) => (
            <div key={h.persona_id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3.5 py-2.5 text-sm">
              <span className="truncate font-medium">{h.nombre_completo}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{fmtFechaHora(h.fecha_creacion)}</span>
            </div>
          ))}
        </div>
      )}
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
        <AvisoResponsabilidad />

        {pausado ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-12 text-center">
            <Pause className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              El líder pausó tu colaboración. Vas a recuperar el acceso apenas la reanude.
            </p>
            <div className="mt-4 w-full max-w-md text-left">
              <MiHistorial />
            </div>
          </div>
        ) : (
          <Tabs defaultValue="formulario">
            <TabsList>
              <TabsTrigger value="formulario"><UserPlus />Cargar persona</TabsTrigger>
              <TabsTrigger value="historial"><History />Mi historial</TabsTrigger>
            </TabsList>
            <TabsContent value="formulario">
              <div className="glass-card-elevated rounded-2xl p-5 sm:p-6">
                <RegistrarPersonaAfirmacion iglesiaId={colaboracion.iglesia_id} />
              </div>
            </TabsContent>
            <TabsContent value="historial">
              <section className="overflow-hidden rounded-2xl border border-border/60 bg-card p-5">
                <MiHistorial />
              </section>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
