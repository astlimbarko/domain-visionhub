import { useEffect, useState } from 'react';
import { EyeOff, Plus, Search, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import { useRolUI } from '@/hooks/useRolUI';
import { useMisRoles } from '@/hooks/useDashboard';
import { useBuscarPersonas } from '@/hooks/usePersonas';
import { CrearPersonaDialog } from '@/components/personas/CrearPersonaDialog';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';
import { PersonasDeRedVista } from '@/components/personas/PersonasDeRedVista';

function CargandoPersonas() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

/**
 * Líder de Red: no administra personas, solo las visualiza. Ve el roster de las
 * Casas de Paz de su Red (con procedencia y marca de fusión), no la búsqueda
 * global de toda la iglesia. Si lidera varias redes, elige cuál mirar.
 */
function PersonasDeRed() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const { data: roles } = useMisRoles(iglesiaActivaId);
  const redes = roles?.redes_lider ?? [];
  const [redId, setRedId] = useState<string>();
  const redActiva = redId ?? redes[0]?.id;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        {redes.length > 1 && (
          <Select value={redActiva} onValueChange={setRedId}>
            <SelectTrigger className="w-full rounded-2xl sm:w-56">
              <SelectValue placeholder="Elegí una red" />
            </SelectTrigger>
            <SelectContent>
              {redes.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {redActiva && <PersonasDeRedVista key={redActiva} redId={redActiva} />}
    </div>
  );
}

/** Búsqueda global de personas de la iglesia (Supervisor, Pastor, Líder/Sublíder de CdP). */
function BusquedaPersonas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const [textoInput, setTextoInput] = useState('');
  const [texto, setTexto] = useState('');
  const [incluirOcultas, setIncluirOcultas] = useState(false);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string>();

  useEffect(() => { const t = setTimeout(() => setTexto(textoInput), 300); return () => clearTimeout(t); }, [textoInput]);
  const { data: resultados = [], isLoading, isFetching } = useBuscarPersonas(iglesiaActivaId, texto, incluirOcultas);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button onClick={() => setMostrarCrear(true)} className="gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nueva persona
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input className="h-11 rounded-2xl border-border bg-muted/50 pl-10 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus-visible:bg-background"
            placeholder="Buscar por nombre, CI o correo..." value={textoInput} onChange={(e) => setTextoInput(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Switch checked={incluirOcultas} onCheckedChange={setIncluirOcultas} /> Incluir ocultas
        </label>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />)}</div>
      ) : resultados.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card py-16 shadow-sm">
          <UserRound className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-[13px] text-muted-foreground">{texto.trim() ? 'Sin resultados.' : 'No hay personas registradas.'}</p>
        </div>
      ) : (
        <div className={`flex flex-col gap-1.5 transition-opacity duration-200 ${isFetching ? 'opacity-50' : ''}`}>
          {resultados.map((p) => (
            <button key={p.id} type="button"
              className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-all hover:bg-muted/60 active:scale-[0.998]"
              onClick={() => setPersonaSeleccionadaId(p.id)}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <UserRound className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground">
                    <span className="truncate">{p.nombre_completo}</span>
                    {p.oculto && <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.edad !== null ? `${p.edad} años` : 'Edad no registrada'}{p.ci && ` · CI ${p.ci}`}{p.casa_de_paz_etiqueta && ` · ${p.casa_de_paz_etiqueta}`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.telefono_principal && <span className="hidden text-[11px] text-muted-foreground sm:inline">{p.telefono_principal}</span>}
                {p.estado_sigla && <Badge variant="secondary" className="rounded-full text-[10px]">{p.estado_sigla}</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}

      <CrearPersonaDialog open={mostrarCrear} onOpenChange={setMostrarCrear} iglesiaId={iglesiaActivaId} onCreada={(id) => setPersonaSeleccionadaId(id)} />
      <FichaPersonaSheet personaId={personaSeleccionadaId} onOpenChange={(open) => !open && setPersonaSeleccionadaId(undefined)} />
    </div>
  );
}

/**
 * El Líder de Red visualiza el roster de su Red (solo lectura); el resto de los
 * roles con acceso usan la búsqueda global de la iglesia. Cada vista maneja sus
 * propios hooks, igual que pages/CasasDePaz.tsx.
 */
export function Personas() {
  const rolUI = useRolUI();
  if (rolUI === null) return <CargandoPersonas />;
  if (rolUI === 'LIDER_RED') return <PersonasDeRed />;
  return <BusquedaPersonas />;
}
