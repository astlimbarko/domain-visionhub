// harness/24: proceso de Afirmación "RSIL" (Retiro de Sanidad Interior).
// Clon de AfirmacionBautismo.tsx (que a su vez es clon de AfirmacionAltar.tsx,
// KAN-481) -- mismas 3 pestañas (Buscar / Nuevo / Datos), mismo backend
// genérico de procesos (fn_afirmacion_*_proceso), mismo form de alta liviano
// (DatosBasicosPersonaFields) + SelectorCasaDePaz (harness/23).
// Diferencias respecto de Bautismo:
//   (a) proceso_codigo 'RSIL' en vez de 'BAUTISMO' -- el enum y el tipo
//       ProcesoAfirmacionCodigo YA traen 'RSIL' (creado en 20260927140000),
//       por eso acá no hay migración nueva ni cambios de esquema.
//   (b) acento lavanda #8b7dd8, distinto del celeste #30b0c7 de Bautismo y
//       del azul #0071E3 de Altar (un color suave por proceso, harness/24 Req 8),
//   (c) RSIL no lleva el botón "Llenar membresía" (ese puente es solo de
//       Bautismo: todo el que se bautiza hace su membresía; RSIL es otro proceso).
//
// ⚠️ NO editar AfirmacionAltar.tsx ni AfirmacionBautismo.tsx para tocar esto:
// son copias independientes a propósito. El rediseño visual unificado de
// Altar/Bautismo/RSIL (molde sin scroll, colores suaves por proceso) es
// trabajo aparte -- harness/24 Req 8.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, CheckCircle2, Save, Search, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useFichaPersonaStore } from '@/store/ficha-persona.store';
import { useEsLiderAfirmacion } from '@/hooks/useEsLiderAfirmacion';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import {
  DatosBasicosPersonaFields,
  DATOS_BASICOS_PERSONA_VACIO,
  datosBasicosPersonaValidos,
  type DatosBasicosPersonaValores,
} from '@/components/personas/DatosBasicosPersonaFields';
import {
  SelectorCasaDePaz,
  DATOS_CASA_DE_PAZ_VACIO,
  type DatosCasaDePaz,
} from '@/components/afirmacion/SelectorCasaDePaz';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { componerTelefono } from '@/utils/paises-telefono';
import { crearPersona, agregarTelefono, agregarDireccion } from '@/services/persona.service';
import { asignarEntradaCdp } from '@/services/membresia-borrador.service';
import { buscarPersonasSimilares, type DatosNombreBusquedaSimilitud } from '@/services/casas-de-paz.service';
import { ConfirmarPosibleDuplicadoDialog } from '@/components/shared/ConfirmarPosibleDuplicadoDialog';
import { useHistorialProcesoAfirmacion, useRegistrarProcesoAfirmacion } from '@/hooks/useAfirmacion';
import type { PersonaBusqueda, PersonaSimilar } from '@/types/casas-de-paz.types';

const ID_TIPO_TELEFONO_CELULAR = '878224d1-afb2-4d67-acbb-5478e00a68fb';
const HOY = () => new Date().toISOString().slice(0, 10);

// harness/24 Req 8: color suave de RSIL (lavanda), elegido 2026-10-01 por
// ser el tercer tono distinto de la paleta de procesos -- distinto del
// celeste #30b0c7 de Bautismo y del azul #0071E3 de Altar.
const ACENTO = '#8b7dd8';

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

// Ondas decorativas del fondo (calcadas del boceto afirmacion1.png/2.png,
// que las tiene en las 3 pestañas). Solo CSS/SVG, sin imagen nueva -- 2
// capas del mismo tono de marca para dar profundidad sin competir con el
// contenido.
function OndasDecorativas() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      className="pointer-events-none -mx-4 mt-8 h-24 w-[calc(100%+2rem)] sm:-mx-6 sm:h-36 sm:w-[calc(100%+3rem)] lg:h-48"
    >
      <path
        fill={ACENTO}
        opacity="0.1"
        d="M0,192L48,181.3C96,171,192,149,288,154.7C384,160,480,192,576,208C672,224,768,224,864,202.7C960,181,1056,139,1152,133.3C1248,128,1344,160,1392,176L1440,192L1440,320L0,320Z"
      />
      <path
        fill={ACENTO}
        opacity="0.16"
        d="M0,256L48,240C96,224,192,192,288,192C384,192,480,224,576,240C672,256,768,256,864,234.7C960,213,1056,171,1152,165.3C1248,160,1344,192,1392,208L1440,224L1440,320L0,320Z"
      />
    </svg>
  );
}

/** Paso de confirmación compartido entre "Buscar" (persona existente) y
 * "Nuevo" (recién creada) -- misma UI, un solo lugar para el registro. */
function ConfirmarRSIL({
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
      { personaId: persona.id, procesoCodigo: 'RSIL', fecha },
      {
        onSuccess: () => {
          toast.success(`RSIL registrado para ${persona.nombre_completo}.`);
          onRegistrado();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo registrar el RSIL'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8b7dd8]/12 text-[#8b7dd8]">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{persona.nombre_completo}</p>
          <p className="text-xs text-muted-foreground">Registrar que pasó por el RSIL</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rsil_fecha">Fecha</Label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="rsil_fecha" type="date" max={HOY()} value={fecha} onChange={(e) => setFecha(e.target.value)} className={cnPl()} />
        </div>
      </div>
      {/* RSIL no lleva botón "Llenar membresía" (a diferencia de Bautismo): ese
       * puente a la Membresía desde 0 es propio del bautismo. Acá solo el registro. */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancelar} disabled={registrar.isPending}>
          Cancelar
        </Button>
        <Button type="button" className="flex-1 gap-1.5" onClick={confirmar} disabled={registrar.isPending}>
          <CheckCircle2 className="h-4 w-4" />
          {registrar.isPending ? 'Registrando...' : 'Registrar RSIL'}
        </Button>
      </div>
    </div>
  );
}

function cnPl() {
  return `pl-8 ${CAMPO_ESTILO}`;
}

// harness/24 Req 7: reusable desde el portal de Colaborar -- igual que Altar,
// acepta `iglesiaId` por prop (el colaborador puede estar colaborando en una
// iglesia distinta de su iglesia activa del store) y `onVolver` muestra el
// botón "volver al portal" cuando va embebido.
export function AfirmacionRSIL({ iglesiaId, onVolver }: { iglesiaId?: string; onVolver?: () => void } = {}) {
  const iglesiaDelStore = useAuthStore((s) => s.iglesiaActivaId);
  const iglesiaActivaId = iglesiaId ?? iglesiaDelStore;
  const iglesias = useAuthStore((s) => s.iglesias);
  const esLiderAfirmacion = useEsLiderAfirmacion();
  const esOperativo = iglesias.find((i) => i.id === iglesiaActivaId)?.es_operativo ?? false;
  const esPastor = iglesias.find((i) => i.id === iglesiaActivaId)?.es_pastor ?? false;
  const puedeVerTodos = esOperativo || esPastor || esLiderAfirmacion;

  const [tab, setTab] = useState('buscar');
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{ id: string; nombre_completo: string } | null>(null);

  const [formNuevo, setFormNuevo] = useState<DatosBasicosPersonaValores>(DATOS_BASICOS_PERSONA_VACIO);
  // harness/23 Req 1: toda "puerta de entrada" captura la Casa de Paz de la
  // persona nueva con 3 modos (por invitador/afinidad, de la lista, o
  // ninguna -> designación).
  const [cdp, setCdp] = useState<DatosCasaDePaz>(DATOS_CASA_DE_PAZ_VACIO);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  // KAN-497 paso 12: busca coincidencias (nombre/teléfono/sexo -- CI no está
  // en este formulario) antes de crear, para no duplicar a alguien que ya
  // entró por otra puerta (Bautismo, Membresía, etc.).
  const [candidatosDuplicado, setCandidatosDuplicado] = useState<PersonaSimilar[]>([]);
  const [mostrarDuplicado, setMostrarDuplicado] = useState(false);

  function datosBusquedaNombre(): DatosNombreBusquedaSimilitud {
    return {
      primer_nombre: formNuevo.primerNombre,
      segundo_nombre: formNuevo.segundoNombre,
      primer_apellido: formNuevo.primerApellido,
      segundo_apellido: formNuevo.segundoApellido,
      telefono: componerTelefono(formNuevo.telefonoPais, formNuevo.telefonoNumero),
      sexo: formNuevo.sexo,
    };
  }

  async function crearPersonaNueva() {
    if (!iglesiaActivaId) return;
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

      // KAN-490: aplicar la Casa de Paz capturada (y el invitado_por). Si no se
      // eligió CdP, la persona queda sin asignar (va a designación).
      await asignarEntradaCdp(persona.id, iglesiaActivaId, cdp);

      toast.success('Persona creada.');
      setFormNuevo(DATOS_BASICOS_PERSONA_VACIO);
      setCdp(DATOS_CASA_DE_PAZ_VACIO);
      setPersonaSeleccionada({ id: persona.id, nombre_completo: `${formNuevo.primerNombre} ${formNuevo.primerApellido}`.trim() });
      setTab('buscar');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la persona');
    } finally {
      setGuardandoNuevo(false);
    }
  }

  async function handleCrearYContinuar() {
    if (!iglesiaActivaId || !datosBasicosPersonaValidos(formNuevo)) return;
    try {
      const similares = await buscarPersonasSimilares(iglesiaActivaId, datosBusquedaNombre());
      if (similares.length > 0) {
        setCandidatosDuplicado(similares);
        setMostrarDuplicado(true);
        return;
      }
    } catch {
      /* si la búsqueda falla, no bloquea el alta */
    }
    await crearPersonaNueva();
  }

  if (!iglesiaActivaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  return (
    <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl p-1">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
        style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${ACENTO} 4%, transparent) 0%, color-mix(in oklab, ${ACENTO} 10%, transparent) 100%)` }}
      />
      <div className="relative overflow-hidden rounded-3xl px-4 py-2 sm:px-6">
        <PalomaMarcaDeAgua />
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            className="relative mb-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al portal
          </button>
        )}
        <Tabs value={tab} onValueChange={setTab} className="relative">
          <TabsList className="mx-auto max-w-md flex-nowrap">
            <TabsTrigger value="buscar" className="flex-1 gap-1 px-2 text-xs sm:gap-1.5 sm:px-4 sm:text-[13.5px]">
              <Search className="h-4 w-4 shrink-0" /> <span className="truncate">Buscar</span>
            </TabsTrigger>
            <TabsTrigger value="nuevo" className="flex-1 gap-1 px-2 text-xs sm:gap-1.5 sm:px-4 sm:text-[13.5px]">
              <UserPlus className="h-4 w-4 shrink-0" /> <span className="truncate">Nuevo</span>
            </TabsTrigger>
            <TabsTrigger value="datos" className="flex-1 gap-1 px-2 text-xs sm:gap-1.5 sm:px-4 sm:text-[13.5px]">
              <Save className="h-4 w-4 shrink-0" /> <span className="truncate">Datos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
            {/* Mismo criterio de centrado vertical que Altar (2026-09-27): solo
             * en "Buscar" -- el panel del buscador es flotante (absolute) y no
             * suma altura al flujo. "Nuevo"/"Datos" pueden crecer mucho. */}
            <div className="flex min-h-[75vh] flex-col justify-center">
              {!personaSeleccionada ? (
                <div className="flex flex-col items-center gap-6 py-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--brand-navy)] bg-white p-1 shadow-sm dark:bg-card">
                      <img src="/logo_centro_de_vida.svg" alt="Centro de Vida" className="h-full w-full" />
                    </span>
                    <h1 className="text-2xl font-black tracking-tight text-[var(--brand-navy)]">RSIL</h1>
                    <p className="text-sm text-muted-foreground">Registro y seguimiento del Retiro de Sanidad Interior</p>
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8b7dd8]/12 text-[#8b7dd8]">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">Recomendaciones</p>
                        <p className="text-xs text-muted-foreground">para tomar datos del RSIL</p>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-1.5 pl-1 text-[13px] text-muted-foreground">
                      <li className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8b7dd8]" /> Trata a cada persona con amabilidad y respeto.
                      </li>
                      <li className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8b7dd8]" /> Explicá brevemente para qué se piden sus datos.
                      </li>
                      <li className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8b7dd8]" /> Ayudala si tiene dudas y revisá la información.
                      </li>
                    </ul>
                    <p className="mt-3 text-center text-xs text-[#8b7dd8] italic">¡Gracias por servir!</p>
                  </div>
                </div>
              ) : (
                <ConfirmarRSIL
                  persona={personaSeleccionada}
                  onCancelar={() => setPersonaSeleccionada(null)}
                  onRegistrado={() => setPersonaSeleccionada(null)}
                />
              )}
            </div>
          </TabsContent>

          {tab === 'buscar' && <OndasDecorativas />}

          <TabsContent value="nuevo" className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
            <button
              type="button"
              onClick={() => setTab('buscar')}
              className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] tracking-wide text-[#8b7dd8] uppercase">RSIL</span>
                <span className="text-base font-bold text-foreground">Nueva persona</span>
              </span>
            </button>
            <div className="flex flex-col gap-5">
              <DatosBasicosPersonaFields valores={formNuevo} onChange={setFormNuevo} />
              {/* KAN-490: Casa de Paz de la persona nueva (invitador + CdP). Se
               * guarda en handleCrearYContinuar via asignarEntradaCdp. */}
              <SelectorCasaDePaz valores={cdp} onChange={setCdp} iglesiaId={iglesiaActivaId} />
            </div>
            <Button
              type="button"
              className="mt-4 w-full gap-2 py-6 text-base"
              disabled={!datosBasicosPersonaValidos(formNuevo) || guardandoNuevo}
              onClick={handleCrearYContinuar}
            >
              <Save className="h-5 w-5" /> {guardandoNuevo ? 'Guardando...' : 'Guardar'}
            </Button>
            <ConfirmarPosibleDuplicadoDialog
              open={mostrarDuplicado}
              onOpenChange={setMostrarDuplicado}
              candidatos={candidatosDuplicado}
              nombreTentativo={`${formNuevo.primerNombre} ${formNuevo.primerApellido}`.trim()}
              onUsarExistente={(persona) => {
                setMostrarDuplicado(false);
                setFormNuevo(DATOS_BASICOS_PERSONA_VACIO);
                setPersonaSeleccionada({ id: persona.id, nombre_completo: persona.nombre_completo });
                setTab('buscar');
              }}
              onNoEsLaMisma={() => {
                setMostrarDuplicado(false);
                void crearPersonaNueva();
              }}
            />
          </TabsContent>

          <TabsContent value="datos" className="mx-auto w-full max-w-md sm:max-w-3xl xl:max-w-4xl">
            <DatosRSIL iglesiaId={iglesiaActivaId} puedeVerTodos={puedeVerTodos} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** Pestaña "Datos" -- mismo criterio que Altar (harness/24 Req 4): el
 * colaborador raso ve solo lo suyo (lo fuerza el RPC), Afirmación/operativo/
 * Pastor ven todo, con selector para filtrar por colaborador puntual y, en
 * pantallas grandes, tabla con columna "Colaborador" en vez de tarjetas. */
function DatosRSIL({ iglesiaId, puedeVerTodos }: { iglesiaId: string; puedeVerTodos: boolean }) {
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const { data: historialCrudo = [], isLoading } = useHistorialProcesoAfirmacion(
    iglesiaId,
    'RSIL',
    colaboradorFiltro === 'TODOS' ? undefined : colaboradorFiltro,
  );
  const abrirFicha = useFichaPersonaStore((s) => s.abrir);

  // KAN-497 paso 11: busca SOLO entre las personas que ya aparecen en esta
  // pestaña (RSIL) -- no en Altar, Bautismo ni Membresía.
  const historial = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return historialCrudo;
    return historialCrudo.filter((r) => r.nombre_completo.toLowerCase().includes(q));
  }, [historialCrudo, busqueda]);

  const colaboradores = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of historialCrudo) {
      if (r.registrado_por && r.registrado_por_nombre) mapa.set(r.registrado_por, r.registrado_por_nombre);
    }
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre }));
  }, [historialCrudo]);

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
          <span className="font-semibold text-foreground tabular-nums">{historial.length}</span> registro{historial.length === 1 ? '' : 's'} de RSIL
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

      {historialCrudo.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar persona en RSIL..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      )}

      {historialCrudo.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay registros de RSIL.
        </div>
      ) : historial.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          Sin resultados para esa búsqueda.
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
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-border/40 hover:bg-muted/40"
                  onClick={() => abrirFicha(r.persona_id, { permitirEdicionExtra: true })}
                >
                  <td className="px-3 py-2.5 font-medium">{r.nombre_completo}</td>
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
          <button
            type="button"
            key={r.id}
            onClick={() => abrirFicha(r.persona_id, { permitirEdicionExtra: true })}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-left hover:bg-muted/40"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8b7dd8]/12 text-[11px] font-semibold text-[#8b7dd8]">
              {r.nombre_completo.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.nombre_completo}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-BO')}
                {puedeVerTodos && r.registrado_por_nombre && ` · ${r.registrado_por_nombre}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}