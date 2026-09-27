// KAN-481: primer proceso de Afirmacion. Boceto de referencia en
// basura_no_leer/afirmacion1.png (pestaña Buscar) y afirmacion2.png
// (pestaña Nuevo) -- pestaña Datos sin boceto, criterio propio (ver nota
// abajo). Mobile-first a proposito (deducido del boceto en celular);
// tablet/desktop heredan el mismo layout con mas aire via max-width.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, CheckCircle2, Save, Search, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useEsLiderAfirmacion } from '@/hooks/useEsLiderAfirmacion';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import {
  DatosBasicosPersonaFields,
  DATOS_BASICOS_PERSONA_VACIO,
  datosBasicosPersonaValidos,
  type DatosBasicosPersonaValores,
} from '@/components/personas/DatosBasicosPersonaFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { componerTelefono } from '@/utils/paises-telefono';
import { crearPersona, agregarTelefono, agregarDireccion } from '@/services/persona.service';
import { useHistorialProcesoAfirmacion, useRegistrarProcesoAfirmacion } from '@/hooks/useAfirmacion';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

const ID_TIPO_TELEFONO_CELULAR = '878224d1-afb2-4d67-acbb-5478e00a68fb';
const HOY = () => new Date().toISOString().slice(0, 10);

// Marca de agua decorativa: logo oficial de Centro de Vida
// (frontend/public/logo_centro_de_vida.svg) con opacidad baja en la esquina
// inferior derecha. Tope fijo de tamaño (pedido explícito del owner,
// 2026-09-27): en pantallas anchas no debe crecer más que en el boceto
// original (celular) -- discreta, no protagonista.
function PalomaMarcaDeAgua() {
  return (
    <img
      src="/logo_centro_de_vida.svg"
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute -right-10 -bottom-10 h-[300px] max-h-[300px] w-[300px] max-w-[300px] opacity-[0.07] dark:opacity-[0.1]"
    />
  );
}

/** Paso de confirmación compartido entre "Buscar" (persona existente) y
 * "Nuevo" (recién creada) -- misma UI, un solo lugar para el registro. */
function ConfirmarAltar({
  persona,
  onCancelar,
  onRegistrado,
}: {
  persona: { id: string; nombre_completo: string };
  onCancelar: () => void;
  onRegistrado: () => void;
}) {
  const [fecha, setFecha] = useState(HOY());
  const registrar = useRegistrarProcesoAfirmacion();

  function confirmar() {
    registrar.mutate(
      { personaId: persona.id, procesoCodigo: 'ALTAR', fecha },
      {
        onSuccess: () => {
          toast.success(`Altar registrado para ${persona.nombre_completo}.`);
          onRegistrado();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo registrar el Altar'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0071E3]/12 text-[#0071E3]">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{persona.nombre_completo}</p>
          <p className="text-xs text-muted-foreground">Registrar que pasó al Altar</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="altar_fecha">Fecha</Label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="altar_fecha" type="date" max={HOY()} value={fecha} onChange={(e) => setFecha(e.target.value)} className={cnPl()} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancelar} disabled={registrar.isPending}>
          Cancelar
        </Button>
        <Button type="button" className="flex-1 gap-1.5" onClick={confirmar} disabled={registrar.isPending}>
          <CheckCircle2 className="h-4 w-4" />
          {registrar.isPending ? 'Registrando...' : 'Registrar Altar'}
        </Button>
      </div>
    </div>
  );
}

function cnPl() {
  return `pl-8 ${CAMPO_ESTILO}`;
}

export function AfirmacionAltar() {
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const iglesias = useAuthStore((s) => s.iglesias);
  const esLiderAfirmacion = useEsLiderAfirmacion();
  const esOperativo = iglesias.find((i) => i.id === iglesiaActivaId)?.es_operativo ?? false;
  const esPastor = iglesias.find((i) => i.id === iglesiaActivaId)?.es_pastor ?? false;
  const puedeVerTodos = esOperativo || esPastor || esLiderAfirmacion;

  const [tab, setTab] = useState('buscar');
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{ id: string; nombre_completo: string } | null>(null);

  const [formNuevo, setFormNuevo] = useState<DatosBasicosPersonaValores>(DATOS_BASICOS_PERSONA_VACIO);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  async function handleCrearYContinuar() {
    if (!iglesiaActivaId || !datosBasicosPersonaValidos(formNuevo)) return;
    setGuardandoNuevo(true);
    try {
      const persona = await crearPersona({
        iglesia_id: iglesiaActivaId,
        primer_nombre: formNuevo.primerNombre.trim(),
        segundo_nombre: formNuevo.segundoNombre.trim() || null,
        primer_apellido: formNuevo.primerApellido.trim(),
        segundo_apellido: formNuevo.segundoApellido.trim() || null,
        sexo: formNuevo.sexo as 'M' | 'F',
        fecha_nacimiento: formNuevo.fechaNacimiento || null,
      });

      const telefono = componerTelefono(formNuevo.telefonoPais, formNuevo.telefonoNumero);
      if (telefono) {
        await agregarTelefono(iglesiaActivaId, persona.id, ID_TIPO_TELEFONO_CELULAR, telefono, null, true);
      }
      if (formNuevo.direccion.trim()) {
        await agregarDireccion(iglesiaActivaId, persona.id, { calle: formNuevo.direccion.trim() }, true);
      }

      toast.success('Persona creada.');
      setFormNuevo(DATOS_BASICOS_PERSONA_VACIO);
      setPersonaSeleccionada({ id: persona.id, nombre_completo: `${formNuevo.primerNombre} ${formNuevo.primerApellido}`.trim() });
      setTab('buscar');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la persona');
    } finally {
      setGuardandoNuevo(false);
    }
  }

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl p-1">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
        style={{ background: 'linear-gradient(180deg, color-mix(in oklab, #0071E3 4%, transparent) 0%, color-mix(in oklab, #0071E3 10%, transparent) 100%)' }}
      />
      <div className="relative overflow-hidden rounded-3xl px-4 py-2 sm:px-6">
        <PalomaMarcaDeAgua />
        <Tabs value={tab} onValueChange={setTab} className="relative">
          <TabsList className="mx-auto max-w-md">
            <TabsTrigger value="buscar" className="flex-1 gap-1.5">
              <Search className="h-4 w-4" /> Buscar
            </TabsTrigger>
            <TabsTrigger value="nuevo" className="flex-1 gap-1.5">
              <UserPlus className="h-4 w-4" /> Nuevo
            </TabsTrigger>
            <TabsTrigger value="datos" className="flex-1 gap-1.5">
              <Save className="h-4 w-4" /> Datos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
            {!personaSeleccionada ? (
              <div className="flex flex-col items-center gap-6 py-4 text-center sm:items-start sm:text-left">
                <div className="flex flex-col items-center gap-2 sm:items-start">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--brand-navy)] bg-white p-3 shadow-sm dark:bg-card">
                    <img src="/logo_centro_de_vida.svg" alt="Centro de Vida" className="h-full w-full" />
                  </span>
                  <h1 className="text-2xl font-black tracking-tight text-[var(--brand-navy)]">ALTAR</h1>
                  <p className="text-sm text-muted-foreground">Registro y seguimiento de personas</p>
                </div>

                <div className="w-full">
                  <BuscadorPersona
                    iglesiaId={iglesiaActivaId}
                    onSeleccionar={(p: PersonaBusqueda) => setPersonaSeleccionada({ id: p.id, nombre_completo: p.nombre_completo })}
                  />
                </div>

                <Button
                  type="button"
                  className="w-full gap-2 bg-[#34c759] py-6 text-base text-white hover:bg-[#2fb350]"
                  onClick={() => setTab('nuevo')}
                >
                  <UserPlus className="h-5 w-5" /> Añadir nueva persona
                </Button>

                <div className="w-full rounded-2xl border border-border/60 bg-card/70 p-4 text-left">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071E3]/12 text-[#0071E3]">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Recomendaciones</p>
                      <p className="text-xs text-muted-foreground">para tomar datos en el altar</p>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1.5 pl-1 text-[13px] text-muted-foreground">
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0071E3]" /> Trata a cada persona con amabilidad y respeto.
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0071E3]" /> Explicá brevemente para qué se piden sus datos.
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0071E3]" /> Ayudala si tiene dudas y revisá la información.
                    </li>
                  </ul>
                  <p className="mt-3 text-center text-xs text-[#0071E3] italic">¡Gracias por servir!</p>
                </div>
              </div>
            ) : (
              <ConfirmarAltar
                persona={personaSeleccionada}
                onCancelar={() => setPersonaSeleccionada(null)}
                onRegistrado={() => setPersonaSeleccionada(null)}
              />
            )}
          </TabsContent>

          <TabsContent value="nuevo" className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
            <button
              type="button"
              onClick={() => setTab('buscar')}
              className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] tracking-wide text-[#0071E3] uppercase">Altar</span>
                <span className="text-base font-bold text-foreground">Nueva persona</span>
              </span>
            </button>
            <DatosBasicosPersonaFields valores={formNuevo} onChange={setFormNuevo} />
            <Button
              type="button"
              className="mt-4 w-full gap-2 py-6 text-base"
              disabled={!datosBasicosPersonaValidos(formNuevo) || guardandoNuevo}
              onClick={handleCrearYContinuar}
            >
              <Save className="h-5 w-5" /> {guardandoNuevo ? 'Guardando...' : 'Guardar'}
            </Button>
          </TabsContent>

          <TabsContent value="datos" className="mx-auto w-full max-w-md sm:max-w-3xl xl:max-w-4xl">
            <DatosAltar iglesiaId={iglesiaActivaId} puedeVerTodos={puedeVerTodos} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** Pestaña "Datos": sin boceto -- criterio propio. Colaborador raso ve solo
 * lo suyo (el RPC ya lo fuerza); Afirmación/operativo/Pastor ve todo, con
 * selector para filtrar por colaborador puntual, y en pantallas grandes
 * como tabla (columna "Colaborador") en vez de tarjetas. */
function DatosAltar({ iglesiaId, puedeVerTodos }: { iglesiaId: string; puedeVerTodos: boolean }) {
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>('TODOS');
  const { data: historial = [], isLoading } = useHistorialProcesoAfirmacion(
    iglesiaId,
    'ALTAR',
    colaboradorFiltro === 'TODOS' ? undefined : colaboradorFiltro,
  );

  const colaboradores = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of historial) {
      if (r.registrado_por && r.registrado_por_nombre) mapa.set(r.registrado_por, r.registrado_por_nombre);
    }
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre }));
  }, [historial]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{historial.length}</span> registro{historial.length === 1 ? '' : 's'} de Altar
        </p>
        {puedeVerTodos && colaboradores.length > 1 && (
          <Select value={colaboradorFiltro} onValueChange={setColaboradorFiltro}>
            <SelectTrigger className={`w-56 ${CAMPO_ESTILO}`}>
              <SelectValue placeholder="Ver de..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Ver de: Todos</SelectItem>
              {colaboradores.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {historial.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay registros de Altar.
        </div>
      ) : puedeVerTodos ? (
        <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Persona</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fecha</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Colaborador</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-3 py-2.5">{r.nombre_completo}</td>
                  <td className="px-3 py-2.5 tabular-nums">{new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-BO')}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.registrado_por_nombre ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className={puedeVerTodos ? 'flex flex-col gap-2 md:hidden' : 'flex flex-col gap-2'}>
        {historial.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071E3]/12 text-[11px] font-semibold text-[#0071E3]">
              {r.nombre_completo.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.nombre_completo}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-BO')}
                {puedeVerTodos && r.registrado_por_nombre && ` · ${r.registrado_por_nombre}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
