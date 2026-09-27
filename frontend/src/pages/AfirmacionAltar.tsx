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

// Marca de agua decorativa: solo el trazo de la paloma del ícono oficial
// de Afirmación (frontend/public/icono-afirmacion.svg), sin el círculo de
// fondo -- ver frontend-style/DEPARTAMENTO_META.AFIRMACION para el azul.
function PalomaMarcaDeAgua() {
  return (
    <svg
      viewBox="0 0 500 500"
      aria-hidden="true"
      className="pointer-events-none absolute -right-16 -bottom-16 h-[340px] w-[340px] text-[#0071E3] opacity-[0.07] dark:opacity-[0.1]"
    >
      <g transform="translate(58 115.5) scale(0.789474)">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M360,16 L353,16 L313,56 L292,52 L273,54 L255,62 L242,73 L238,72 L224,63 L211,59 L195,58 L171,64 L134,27 L128,26 L72,79 L34,118 L35,124 L71,162 L71,177 L74,192 L80,206 L86,215 L115,246 L116,252 L120,259 L125,264 L136,270 L132,280 L132,291 L138,304 L145,310 L155,314 L166,314 L172,312 L176,322 L182,329 L194,335 L203,335 L210,346 L222,355 L229,357 L243,355 L249,352 L259,340 L266,337 L274,345 L281,349 L296,350 L305,346 L312,339 L317,329 L335,329 L342,325 L349,318 L353,310 L354,304 L351,292 L359,289 L366,284 L370,279 L374,269 L373,255 L365,243 L392,217 L402,205 L410,192 L415,178 L416,155 L453,117 L454,113 L452,109Z M216,332 L227,323 L231,330 L243,340 L237,344 L229,344 L222,340Z M295,313 L302,319 L303,329 L295,337 L289,338 L284,336 L278,329Z M325,283 L338,296 L340,300 L339,309 L330,317 L321,317 L317,315 L305,303Z M355,253 L361,261 L361,267 L358,273 L349,279 L343,279 L339,277 L335,273Z M271,123 L273,128 L271,137 L266,142 L259,144 L254,142 L220,108 L215,106 L212,107 L209,110 L208,114 L218,125 L218,128 L160,184 L117,228 L100,211 L89,194 L85,180 L85,158 L50,120 L91,79 L130,43 L168,79 L192,71 L211,72 L225,78 L246,97Z M438,114 L403,149 L403,169 L401,178 L395,191 L388,201 L264,324 L253,328 L248,327 L240,320 L239,312 L241,308 L297,253 L298,247 L294,243 L287,244 L210,320 L203,323 L196,322 L188,316 L185,309 L188,300 L261,227 L261,221 L257,217 L251,218 L169,299 L165,301 L156,301 L153,300 L147,294 L145,290 L145,282 L148,276 L230,196 L231,189 L227,185 L222,185 L154,252 L148,256 L137,256 L129,249 L128,238 L131,232 L228,136 L244,151 L254,156 L265,156 L271,154 L277,150 L282,144 L286,132 L285,123 L282,116 L251,84 L251,82 L263,72 L282,65 L297,65 L317,71 L357,32Z"
        />
      </g>
    </svg>
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

          <TabsContent value="buscar" className="mx-auto w-full max-w-md sm:max-w-lg">
            {!personaSeleccionada ? (
              <div className="flex flex-col items-center gap-6 py-4 text-center sm:items-start sm:text-left">
                <div className="flex flex-col items-center gap-2 sm:items-start">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#0071E3]/30 bg-white text-[#0071E3] shadow-sm dark:bg-card">
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 3c3 2 6 2 6 2s0 4-2 6c1 3 0 6-4 8-4-2-5-5-4-8-2-2-2-6-2-6s3 0 6-2Z" />
                    </svg>
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight text-[#0071E3]">ALTAR</h1>
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

          <TabsContent value="nuevo" className="mx-auto w-full max-w-md sm:max-w-lg">
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

          <TabsContent value="datos" className="mx-auto w-full max-w-md sm:max-w-3xl">
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
