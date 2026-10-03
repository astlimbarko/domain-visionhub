// KAN-481: primer proceso de Afirmacion. Boceto de referencia en
// basura_no_leer/afirmacion1.png (pestaña Buscar) y afirmacion2.png
// (pestaña Nuevo) -- pestaña Datos sin boceto, criterio propio (ver nota
// abajo). Mobile-first a proposito (deducido del boceto en celular);
// tablet/desktop heredan el mismo layout con mas aire via max-width.
//
// ⚠️ HAY SPECS DE MODIFICACION PENDIENTES antes de seguir tocando esta
// pantalla o los demas procesos de Afirmacion. LEER PRIMERO:
//   - harness/21-altar-formulario-membresia-paralela/  (ampliar este form
//     a "membresia paralela": mas campos, ver/editar bloqueado->Editar,
//     pestaña Datos con hover, quitar boton "Ocultar de busquedas") -- lo
//     termina Matias.
//   - harness/20-afirmacion-procesos-y-colaborar/  (RSIL, Fiesta de
//     Bienvenida, Bautismo/Membresia + Colaborar por tarjetas; reusan el
//     patron de ver/editar de harness 21).
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, CheckCircle2, Save, Search, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import { EliminarRegistroProceso } from '@/components/afirmacion/EliminarRegistroProceso';
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
import { crearPersona, agregarTelefono, agregarDireccion, obtenerPersonaDatosBasicos, actualizarPersonaBasicaAfirmacion } from '@/services/persona.service';
import { AMBAR } from '@/components/dashboard/DashboardUI';
import { asignarEntradaCdp } from '@/services/membresia-borrador.service';
import { buscarPersonasSimilares, type DatosNombreBusquedaSimilitud } from '@/services/casas-de-paz.service';
import { ConfirmarPosibleDuplicadoDialog } from '@/components/shared/ConfirmarPosibleDuplicadoDialog';
import { SelectorCasaDePaz, DATOS_CASA_DE_PAZ_VACIO, type DatosCasaDePaz } from '@/components/afirmacion/SelectorCasaDePaz';
import { useHistorialProcesoAfirmacion, useRegistrarProcesoAfirmacion } from '@/hooks/useAfirmacion';
import { EdicionPersonaBasica } from '@/components/afirmacion/EdicionPersonaBasica';
import { ResumenProcesoAfirmacion } from '@/components/afirmacion/ResumenProcesoAfirmacion';
import type { PersonaBusqueda, PersonaSimilar } from '@/types/casas-de-paz.types';

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

// Ondas decorativas del fondo (calcadas del boceto afirmacion1.png/2.png,
// que las tiene en las 3 pestañas). Solo CSS/SVG, sin imagen nueva -- 2
// capas del mismo tono de marca para dar profundidad sin competir con el
// contenido. Cambio aislado a pedido del owner (2026-09-29) para revisarlo
// solo, antes de decidir si suma más ajustes visuales.
function OndasDecorativas() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      className="pointer-events-none -mx-4 mt-8 h-24 w-[calc(100%+2rem)] sm:-mx-6 sm:h-36 sm:w-[calc(100%+3rem)] lg:h-48"
    >
      <path
        fill="#0071E3"
        opacity="0.1"
        d="M0,192L48,181.3C96,171,192,149,288,154.7C384,160,480,192,576,208C672,224,768,224,864,202.7C960,181,1056,139,1152,133.3C1248,128,1344,160,1392,176L1440,192L1440,320L0,320Z"
      />
      <path
        fill="#0071E3"
        opacity="0.16"
        d="M0,256L48,240C96,224,192,192,288,192C384,192,480,224,576,240C672,256,768,256,864,234.7C960,213,1056,171,1152,165.3C1248,160,1344,192,1392,208L1440,224L1440,320L0,320Z"
      />
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

// KAN-485: reusable desde el portal de Colaborar -- un colaborador puede
// estar colaborando en una iglesia distinta de su iglesia activa del store,
// asi que se acepta `iglesiaId` por prop (default: la del store, uso normal
// dentro del sidebar de Afirmacion). `onVolver` muestra el boton "volver al
// portal" cuando se monta embebido en Colaborar.
export function AfirmacionAltar({ iglesiaId, onVolver }: { iglesiaId?: string; onVolver?: () => void } = {}) {
  const iglesiaDelStore = useAuthStore((s) => s.iglesiaActivaId);
  const iglesiaActivaId = iglesiaId ?? iglesiaDelStore;

  const [tab, setTab] = useState('buscar');
  const [personaSeleccionada, setPersonaSeleccionada] = useState<{ id: string; nombre_completo: string } | null>(null);

  const [formNuevo, setFormNuevo] = useState<DatosBasicosPersonaValores>(DATOS_BASICOS_PERSONA_VACIO);
  // KAN-490 (harness/23 Req 1): capturar la Casa de Paz también en Altar.
  const [cdp, setCdp] = useState<DatosCasaDePaz>(DATOS_CASA_DE_PAZ_VACIO);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  // KAN-497 paso 10: "Guardar" en Nuevo ya es la intención explícita de
  // registrar a esta persona en Altar -- antes, después de crear, igual había
  // que confirmar de nuevo en ConfirmarAltar (2 pasos para una sola acción).
  // La pestaña "Buscar" (persona existente) mantiene su único paso de
  // confirmación tal cual -- ahí sí hace falta elegir fecha/revisar antes de
  // registrar a alguien que no se acaba de cargar en el momento.
  const registrarAltar = useRegistrarProcesoAfirmacion();
  // KAN-497 paso 12: antes de crear una persona nueva, si ya existe alguien
  // parecido se pregunta -- mismo patrón ya usado en Bautismo/RSIL/Membresía.
  const [candidatosDuplicado, setCandidatosDuplicado] = useState<PersonaSimilar[]>([]);
  const [mostrarDuplicado, setMostrarDuplicado] = useState(false);
  // Modo EDICIÓN (reemplaza al modal FichaPersonaSheet): al tocar una persona en
  // la pestaña "Registro" se precarga su ficha básica en el form de "Nuevo",
  // bloqueada; "Editar" la desbloquea y "Guardar cambios" actualiza la misma
  // persona. `edicion` null = alta de persona nueva (flujo original intacto).
  const [edicion, setEdicion] = useState<{ personaId: string; nombre: string } | null>(null);
  const [edicionBloqueada, setEdicionBloqueada] = useState(true);

  async function abrirEdicion(personaId: string, nombre: string) {
    setEdicion({ personaId, nombre });
    setEdicionBloqueada(true);
    setTab('nuevo');
    try {
      setFormNuevo(await obtenerPersonaDatosBasicos(personaId));
    } catch {
      toast.error('No se pudieron cargar los datos de esa persona.');
      cerrarEdicion();
    }
  }

  function cerrarEdicion() {
    setEdicion(null);
    setEdicionBloqueada(true);
    setFormNuevo(DATOS_BASICOS_PERSONA_VACIO);
  }

  async function guardarEdicion() {
    if (!iglesiaActivaId || !edicion || !datosBasicosPersonaValidos(formNuevo)) return;
    setGuardandoNuevo(true);
    try {
      await actualizarPersonaBasicaAfirmacion(iglesiaActivaId, edicion.personaId, formNuevo);
      toast.success(`Datos actualizados: ${formNuevo.primerNombre} ${formNuevo.primerApellido}.`);
      cerrarEdicion();
      setTab('datos');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la persona');
    } finally {
      setGuardandoNuevo(false);
    }
  }

  // Salir de "Nuevo" cancela una edición en curso (no deja estado colgado).
  function cambiarTab(v: string) {
    if (v !== 'nuevo' && edicion) cerrarEdicion();
    setTab(v);
  }

  // CI no está en este formulario (DatosBasicosPersonaFields no lo pide acá,
  // igual que Bautismo/RSIL) -- la búsqueda queda en nombre + teléfono + sexo.
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

      // KAN-490: aplicar la Casa de Paz capturada (y el invitado_por).
      await asignarEntradaCdp(persona.id, iglesiaActivaId, cdp);

      const nombreCompleto = `${formNuevo.primerNombre} ${formNuevo.primerApellido}`.trim();
      try {
        await registrarAltar.mutateAsync({ personaId: persona.id, procesoCodigo: 'ALTAR', fecha: HOY() });
        toast.success(`Altar registrado para ${nombreCompleto}.`);
      } catch (e) {
        // La persona ya quedó creada -- se puede registrar el Altar después
        // buscándola en la pestaña "Buscar", no se pierde el alta.
        toast.error(e instanceof Error ? e.message : 'La persona se creó, pero no se pudo registrar el Altar. Buscala en "Buscar" para intentar de nuevo.');
      }
      setFormNuevo(DATOS_BASICOS_PERSONA_VACIO);
      setCdp(DATOS_CASA_DE_PAZ_VACIO);
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
      {/* Fondo distinto en modo edición (ámbar) vs alta nueva (azul del proceso)
          -- señal de un vistazo de si se está creando o editando. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
        style={{
          background: edicion
            ? `linear-gradient(180deg, color-mix(in oklab, ${AMBAR} 7%, transparent) 0%, color-mix(in oklab, ${AMBAR} 16%, transparent) 100%)`
            : 'linear-gradient(180deg, color-mix(in oklab, #0071E3 4%, transparent) 0%, color-mix(in oklab, #0071E3 10%, transparent) 100%)',
        }}
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
        <Tabs value={tab} onValueChange={cambiarTab} className="relative">
          <TabsList className="mx-auto max-w-md flex-nowrap">
            <TabsTrigger value="buscar" className="flex-1 gap-1 px-2 text-xs sm:gap-1.5 sm:px-4 sm:text-[13.5px]">
              <Search className="h-4 w-4 shrink-0" /> <span className="truncate">Buscar</span>
            </TabsTrigger>
            <TabsTrigger value="nuevo" className="flex-1 gap-1 px-2 text-xs sm:gap-1.5 sm:px-4 sm:text-[13.5px]">
              <UserPlus className="h-4 w-4 shrink-0" /> <span className="truncate">Nuevo</span>
            </TabsTrigger>
            <TabsTrigger value="datos" className="flex-1 gap-1 px-2 text-xs sm:gap-1.5 sm:px-4 sm:text-[13.5px]">
              <Save className="h-4 w-4 shrink-0" /> <span className="truncate">Registro</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
            {/* Centrado vertical (pedido explícito del owner, 2026-09-27): solo
             * acá -- el panel de resultados del buscador es flotante (absolute,
             * ver BuscadorPersona.tsx) y no suma altura al flujo, así que este
             * bloque nunca "crece" y siempre puede flotar en el medio sin
             * romper la usabilidad. Nuevo/Datos quedan como estaban (arriba,
             * scroll normal) porque sí pueden crecer mucho (formulario/tabla). */}
            <div className="flex min-h-[75vh] flex-col justify-center">
              {!personaSeleccionada ? (
                <div className="flex flex-col items-center gap-6 py-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--brand-navy)] bg-white p-1 shadow-sm dark:bg-card">
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
            </div>
          </TabsContent>

          {tab === 'buscar' && <OndasDecorativas />}

          <TabsContent value="nuevo" className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
            {edicion ? (
              <EdicionPersonaBasica
                acento="#0071E3"
                nombre={edicion.nombre}
                valores={formNuevo}
                onChange={setFormNuevo}
                bloqueado={edicionBloqueada}
                onEditar={() => setEdicionBloqueada(false)}
                onCancelar={() => { cerrarEdicion(); setTab('datos'); }}
                onGuardar={guardarEdicion}
                guardando={guardandoNuevo}
              />
            ) : (
            <>
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
            <div className="mt-4">
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
                setCdp(DATOS_CASA_DE_PAZ_VACIO);
                setPersonaSeleccionada({ id: persona.id, nombre_completo: persona.nombre_completo });
                setTab('buscar');
              }}
              onNoEsLaMisma={() => {
                setMostrarDuplicado(false);
                void crearPersonaNueva();
              }}
            />
            </>
            )}
          </TabsContent>

          <TabsContent value="datos" className="mx-auto w-full max-w-md sm:max-w-3xl xl:max-w-4xl">
            <DatosAltar iglesiaId={iglesiaActivaId} onEditar={abrirEdicion} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** Pestaña "Registro": todos los que entran acá (colaboradores incluidos) ven
 * TODOS los registros de la iglesia y quién tomó cada dato -- el RPC ya no
 * restringe al colaborador a lo suyo (cambio 2026-10-03). Se puede filtrar por
 * un colaborador puntual; en pantallas grandes es tabla (columna
 * "Colaborador"), en móvil tarjetas. Cada fila tiene botón para eliminar
 * duplicados (responsabilidad de los propios colaboradores). */
function DatosAltar({ iglesiaId, onEditar }: { iglesiaId: string; onEditar: (personaId: string, nombre: string) => void }) {
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const { data: historialCrudo = [], isLoading } = useHistorialProcesoAfirmacion(
    iglesiaId,
    'ALTAR',
    colaboradorFiltro === 'TODOS' ? undefined : colaboradorFiltro,
  );

  // KAN-497 paso 11: busca SOLO entre las personas que ya aparecen en esta
  // pestaña (Altar) -- no en Bautismo, RSIL ni Membresía.
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
          <span className="font-semibold text-foreground tabular-nums">{historial.length}</span> registro{historial.length === 1 ? '' : 's'} de Altar
        </p>
        {colaboradores.length > 1 && (
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
          <Input className="pl-8" placeholder="Buscar persona en Altar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      )}

      {historialCrudo.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay registros de Altar.
        </div>
      ) : historial.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          Sin resultados para esa búsqueda.
        </div>
      ) : (
        <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-10 px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">#</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Persona</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fecha</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Colaborador</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((r, i) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-border/40 hover:bg-muted/40"
                  onClick={() => onEditar(r.persona_id, r.nombre_completo)}
                >
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5 font-medium">{r.nombre_completo}</td>
                  <td className="px-3 py-1.5 tabular-nums">{new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-BO')}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.registrado_por_nombre ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <EliminarRegistroProceso registroId={r.id} nombre={r.nombre_completo} procesoCodigo="ALTAR" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-1.5 md:hidden">
        {historial.map((r, i) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2 hover:bg-muted/40"
          >
            <button
              type="button"
              onClick={() => onEditar(r.persona_id, r.nombre_completo)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071E3]/12 text-[11px] font-semibold text-[#0071E3] tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.nombre_completo}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-BO')}
                  {r.registrado_por_nombre && ` · ${r.registrado_por_nombre}`}
                </p>
              </div>
            </button>
            <EliminarRegistroProceso registroId={r.id} nombre={r.nombre_completo} procesoCodigo="ALTAR" />
          </div>
        ))}
      </div>

      <ResumenProcesoAfirmacion registros={historial} etiqueta="Altar" />
    </div>
  );
}
