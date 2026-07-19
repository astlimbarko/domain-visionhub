import { useEffect, useState } from 'react';
import { EyeOff, Plus, Search, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/store/auth.store';
import { useBuscarPersonas } from '@/hooks/usePersonas';
import { CrearPersonaDialog } from '@/components/personas/CrearPersonaDialog';
import { FichaPersonaSheet } from '@/components/personas/FichaPersonaSheet';

export function Personas() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  const [textoInput, setTextoInput] = useState('');
  const [texto, setTexto] = useState('');
  const [incluirOcultas, setIncluirOcultas] = useState(false);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string>();

  useEffect(() => {
    const t = setTimeout(() => setTexto(textoInput), 300);
    return () => clearTimeout(t);
  }, [textoInput]);

  const { data: resultados = [], isLoading, isFetching } = useBuscarPersonas(iglesiaActivaId, texto, incluirOcultas);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Personas</h1>
          <p className="text-sm text-muted-foreground">Identidad, censo, familia y llegada de cada miembro.</p>
        </div>
        <Button onClick={() => setMostrarCrear(true)} className="gap-1.5 w-fit">
          <Plus className="h-4 w-4" />
          Nueva persona
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nombre, CI o correo..."
            value={textoInput}
            onChange={(e) => setTextoInput(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={incluirOcultas} onCheckedChange={setIncluirOcultas} />
          Incluir ocultas
        </label>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : resultados.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {texto.trim() ? 'Sin resultados para esa búsqueda.' : 'Todavía no hay personas registradas.'}
        </p>
      ) : (
        <div className={`flex flex-col gap-2 ${isFetching ? 'opacity-60' : ''}`}>
          {resultados.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer rounded-2xl transition-colors hover:bg-accent"
              onClick={() => setPersonaSeleccionadaId(p.id)}
            >
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <UserRound className="h-4.5 w-4.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 font-medium">
                      {p.nombre_completo}
                      {p.oculto && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.edad !== null ? `${p.edad} años` : 'Edad no registrada'}
                      {p.ci && ` · CI ${p.ci}`}
                      {p.casa_de_paz_etiqueta && ` · ${p.casa_de_paz_etiqueta}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.telefono_principal && <span className="hidden text-xs text-muted-foreground sm:inline">{p.telefono_principal}</span>}
                  {p.estado_sigla && <Badge variant="outline">{p.estado_sigla}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CrearPersonaDialog
        open={mostrarCrear}
        onOpenChange={setMostrarCrear}
        iglesiaId={iglesiaActivaId}
        onCreada={(id) => setPersonaSeleccionadaId(id)}
      />

      <FichaPersonaSheet
        personaId={personaSeleccionadaId}
        onOpenChange={(open) => !open && setPersonaSeleccionadaId(undefined)}
      />
    </div>
  );
}
