// KAN-488 (harness/21): pantalla "Membresía (Nuevos)" -- una sola página con
// scroll, para registrar la membresía de gente nueva (distinta de la membresía
// por link). Autoguardado en la tabla borrador (BD, 1 por usuario), restaura
// con aviso al volver, y botón Limpiar con confirmación. El guardado final a
// las tablas reales (persona + detalle + dirección + CdP + estado SSVA) ya
// está implementado (fn_guardar_membresia_nuevos). Reusable desde el portal de
// Colaborar via props `iglesiaId` + `onVolver`.
// harness/21 Req 1: puede abrirse para una persona EXISTENTE (precargada) —
// desde el botón "Llenar membresía" de Bautismo (navigate con state.personaId)
// o buscándola en la pantalla. En ese modo se ACTUALIZA, no se crea una nueva.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Save, Loader2, ArrowLeft, Pencil, UserCheck, XCircle } from 'lucide-react';
import { TEAL, AMBAR } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { MembresiaNuevosFields } from '@/components/afirmacion/MembresiaNuevosFields';
import {
  DATOS_MEMBRESIA_NUEVOS_VACIO,
  hayContenidoRealMembresia,
  camposObligatoriosFaltantes,
  porcentajeCompletadoMembresia,
  type DatosMembresiaNuevos,
} from '@/types/membresia-nuevos.types';
import {
  guardarBorradorMembresia,
  obtenerBorradorMembresia,
  eliminarBorradorMembresia,
  guardarMembresiaNuevos,
  obtenerPersonaParaMembresia,
} from '@/services/membresia-borrador.service';
import { notificarMembresiaCompletada } from '@/services/membresia-extendida.service';
import { buscarPersonasSimilares } from '@/services/casas-de-paz.service';
import { registrarMembresiaNuevosAfirmacion } from '@/services/afirmacion.service';
import { RegistroMembresiaNuevos } from '@/components/afirmacion/RegistroMembresiaNuevos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmarPosibleDuplicadoDialog } from '@/components/shared/ConfirmarPosibleDuplicadoDialog';
import { componerTelefono } from '@/utils/paises-telefono';
import type { PersonaSimilar } from '@/types/casas-de-paz.types';
import { SelectorEventoActivoCompacto } from '@/components/afirmacion/SelectorEventoActivoCompacto';

type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado';

/**
 * Disco flotante de autoguardado (estándar del proyecto, igual que el Reporte
 * de CdP, KAN-435): abajo a la derecha, no clickeable, spinner mientras guarda
 * y disco al confirmar; se desvanece solo ~1.6s después de guardado.
 */
function DiscoAutoguardado({ mostrar, estado }: { mostrar: boolean; estado: EstadoGuardado }) {
  return (
    <AnimatePresence>
      {mostrar && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none fixed right-5 bottom-5 z-50 flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            backgroundColor: `color-mix(in oklab, ${TEAL} 22%, transparent)`,
            boxShadow: `0 0 18px 3px color-mix(in oklab, ${TEAL} 55%, transparent)`,
          }}
        >
          {estado === 'guardando' ? (
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: TEAL }} />
          ) : (
            <Save className="h-5 w-5" style={{ color: TEAL }} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AfirmacionMembresiaNuevos({ iglesiaId: iglesiaIdProp, onVolver }: { iglesiaId?: string; onVolver?: () => void } = {}) {
  const iglesiaDelStore = useAuthStore((s) => s.iglesiaActivaId);
  const iglesiaId = iglesiaIdProp ?? iglesiaDelStore;

  const location = useLocation();
  // harness/21 Req 1: la persona puede llegar precargada desde el botón "Llenar
  // membresía" de Bautismo (navigate con state.personaId).
  const personaDesdeNav = (location.state as { personaId?: string } | null)?.personaId ?? null;

  const [datos, setDatos] = useState<DatosMembresiaNuevos>(DATOS_MEMBRESIA_NUEVOS_VACIO);
  const [estado, setEstado] = useState<EstadoGuardado>('inactivo');
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);
  const [confirmarQuitarPersona, setConfirmarQuitarPersona] = useState(false);
  const [pestana, setPestana] = useState<'nuevo' | 'registro'>('nuevo');
  const [guardandoFinal, setGuardandoFinal] = useState(false);
  // KAN-497: aviso de posible persona ya existente antes de crear una nueva.
  const [mostrarDuplicado, setMostrarDuplicado] = useState(false);
  const [candidatosDuplicado, setCandidatosDuplicado] = useState<PersonaSimilar[]>([]);
  const [duplicadoDescartado, setDuplicadoDescartado] = useState(false);
  useEffect(() => {
    setDuplicadoDescartado(false);
  }, [datos.primerNombre, datos.segundoNombre, datos.primerApellido, datos.segundoApellido]);
  const [cargandoPersona, setCargandoPersona] = useState(false);
  // Modo edición: al precargar una persona existente, el formulario arranca
  // BLOQUEADO (igual que las otras 3 puertas) -- el botón rojo "Editar" lo
  // desbloquea. Alta de persona nueva: nunca bloqueado.
  const [bloqueado, setBloqueado] = useState(false);
  const [mostrarIndicador, setMostrarIndicador] = useState(false);
  const hidratado = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ocultarIndicadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Precarga de una persona EXISTENTE: trae sus datos de la base al formulario,
  // para verificar/corregir y confirmar. No crea una nueva (se actualiza).
  async function precargarPersona(personaId: string) {
    setCargandoPersona(true);
    try {
      const d = await obtenerPersonaParaMembresia(personaId);
      setDatos(d);
      setEstado('inactivo');
      setBloqueado(true);
      toast.info(`Completando la membresía de ${d.primerNombre} ${d.primerApellido}.`);
    } catch {
      toast.error('No se pudieron cargar los datos de esa persona.');
    } finally {
      setCargandoPersona(false);
    }
  }

  // Al montar: si viene una persona por navegación (desde Bautismo), precargarla
  // -- tiene prioridad sobre el borrador. Si no, restaurar el borrador (solo si
  // tiene contenido real -- lección KAN-443: un form en blanco no dispara aviso).
  useEffect(() => {
    if (!iglesiaId || hidratado.current) return;
    hidratado.current = true;
    if (personaDesdeNav) {
      precargarPersona(personaDesdeNav);
      return;
    }
    obtenerBorradorMembresia(iglesiaId)
      .then((b) => {
        if (b && hayContenidoRealMembresia(b)) {
          setDatos({ ...DATOS_MEMBRESIA_NUEVOS_VACIO, ...b });
          setEstado('guardado');
          toast.info('Se restauró tu borrador sin guardar.');
        }
      })
      .catch(() => {
        /* borrador inaccesible -- no bloquea el formulario */
      });
    // Solo al montar (guard hidratado.current); personaDesdeNav/precargarPersona
    // no van en deps a propósito para no re-disparar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iglesiaId]);

  // Autoguardado con debounce en la tabla borrador (no en las tablas reales).
  // Muestra el disco flotante mientras guarda y lo desvanece ~1.6s después.
  useEffect(() => {
    if (!iglesiaId || !hidratado.current) return;
    if (!hayContenidoRealMembresia(datos)) {
      // Formulario vacío: no hay nada que guardar. Sin ocultar el disco acá, si
      // estaba en "guardando" (el usuario borró todo antes de los 900 ms) queda
      // girando para siempre -- la limpieza de arriba canceló el temporizador.
      if (ocultarIndicadorRef.current) clearTimeout(ocultarIndicadorRef.current);
      setEstado('inactivo');
      setMostrarIndicador(false);
      return;
    }
    setEstado('guardando');
    setMostrarIndicador(true);
    if (ocultarIndicadorRef.current) clearTimeout(ocultarIndicadorRef.current);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      guardarBorradorMembresia(iglesiaId, datos)
        .then(() => {
          setEstado('guardado');
          ocultarIndicadorRef.current = setTimeout(() => setMostrarIndicador(false), 1600);
        })
        .catch(() => {
          setEstado('inactivo');
          setMostrarIndicador(false);
        });
    }, 900);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [datos, iglesiaId]);

  async function handleLimpiar() {
    setConfirmarLimpiar(false);
    setDatos(DATOS_MEMBRESIA_NUEVOS_VACIO);
    setEstado('inactivo');
    setBloqueado(false);
    if (iglesiaId) {
      try {
        await eliminarBorradorMembresia(iglesiaId);
      } catch {
        /* si falla el borrado del borrador, igual se limpió la pantalla */
      }
    }
    toast.success('Formulario limpio, listo para empezar de cero.');
  }

  // KAN-497: si la persona todavía no está precargada (es "nueva" para este
  // form), antes de crearla se busca si ya existe alguien con ese nombre --
  // típicamente un bautizado registrado desde Bautismo, que ya tiene persona
  // creada. Sin este chequeo se insertaba una segunda persona igual.
  async function handleGuardar() {
    if (!iglesiaId || guardandoFinal) return;
    const faltan = camposObligatoriosFaltantes(datos);
    if (faltan.length > 0) {
      toast.error(`Faltan campos obligatorios: ${faltan.join(', ')}.`);
      return;
    }
    if (!datos.personaExistenteId && !duplicadoDescartado) {
      try {
        // KAN-497 paso 12: CI y teléfono exactos pesan más que el nombre
        // (ver fn_buscar_personas_similares) -- acá sí hay CI, a diferencia
        // de Bautismo/RSIL.
        const similares = await buscarPersonasSimilares(iglesiaId, {
          primer_nombre: datos.primerNombre,
          segundo_nombre: datos.segundoNombre,
          primer_apellido: datos.primerApellido,
          segundo_apellido: datos.segundoApellido,
          ci: datos.ciNoRecuerda ? undefined : datos.ci,
          telefono: componerTelefono(datos.telefonoPais, datos.telefonoNumero),
          sexo: datos.sexo,
        });
        if (similares.length > 0) {
          setCandidatosDuplicado(similares);
          setMostrarDuplicado(true);
          return;
        }
      } catch {
        /* si la búsqueda falla, no bloquea el alta -- mismo criterio que el borrador */
      }
    }
    await guardarFinal();
  }

  async function guardarFinal() {
    if (!iglesiaId || guardandoFinal) return;
    setGuardandoFinal(true);
    try {
      const res = await guardarMembresiaNuevos(iglesiaId, datos);
      // KAN-497 paso 7: deja registrado quién cargó / actualizó a la persona.
      // No bloquea el guardado: la membresía ya quedó en la base.
      try {
        await registrarMembresiaNuevosAfirmacion(res.persona_id, iglesiaId);
      } catch {
        toast.error('La membresía se guardó, pero no se pudo registrar quién la cargó.');
      }
      // Correo de bienvenida (KAN-493): no-op si la persona no tiene correo o
      // ya se le envió; nunca bloquea el alta (la función traga sus errores).
      void notificarMembresiaCompletada(res.persona_id);
      // El borrador ya cumplió su función; se borra para no restaurarlo después.
      try {
        await eliminarBorradorMembresia(iglesiaId);
      } catch {
        /* no bloquea: la membresía ya quedó guardada */
      }
      setDatos(DATOS_MEMBRESIA_NUEVOS_VACIO);
      setEstado('inactivo');
      setDuplicadoDescartado(false);
      setBloqueado(false);
      const verbo = res.actualizada ? 'actualizada' : 'guardada';
      if (res.sin_casa_de_paz) {
        toast.success(`Membresía ${verbo}: ${res.nombre_completo}. Quedó sin Casa de Paz — aparecerá en designaciones.`);
      } else {
        toast.success(`Membresía ${verbo}: ${res.nombre_completo}.`);
      }
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : '';
      if (mensaje.includes('AFIRMACION_SIN_PERMISO')) {
        toast.error('No tenés permiso para registrar membresías en esta iglesia.');
      } else if (mensaje.includes('MEMBRESIA_DATOS_INCOMPLETOS')) {
        toast.error('Faltan datos obligatorios: nombre, apellido y sexo.');
      } else if (mensaje.includes('MEMBRESIA_CDP_INVALIDA')) {
        toast.error('La Casa de Paz elegida no es válida. Elegí otra.');
      } else {
        toast.error('No se pudo guardar la membresía. Intentá de nuevo.');
      }
    } finally {
      setGuardandoFinal(false);
    }
  }

  if (!iglesiaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  // El botón se habilita con el mínimo real (nombre/apellido/sexo); si faltan
  // otros obligatorios, handleGuardar lo avisa con la lista puntual en vez de
  // dejar el botón gris sin explicación.
  const puedeGuardar = datos.primerNombre.trim() !== '' && datos.primerApellido.trim() !== '' && datos.sexo !== '';
  // Editando a una persona existente: fondo ámbar sutil (igual que las otras 3
  // puertas) para distinguir de un alta nueva de un vistazo.
  const enEdicion = !!datos.personaExistenteId;

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-6 overflow-hidden rounded-3xl p-1">
      {enEdicion && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
          style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${AMBAR} 7%, transparent) 0%, color-mix(in oklab, ${AMBAR} 16%, transparent) 100%)` }}
        />
      )}
      {onVolver && (
        <button
          type="button"
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al portal
        </button>
      )}
      <Tabs value={pestana} onValueChange={(v) => setPestana(v as 'nuevo' | 'registro')} className="flex flex-col gap-6">
        <TabsList className="self-start">
          <TabsTrigger value="nuevo">Nuevo</TabsTrigger>
          <TabsTrigger value="registro">Registro</TabsTrigger>
        </TabsList>
        <TabsContent value="registro" className="mt-0">
          <RegistroMembresiaNuevos
            iglesiaId={iglesiaId}
            onEditar={(id) => {
              setPestana('nuevo');
              void precargarPersona(id);
            }}
          />
        </TabsContent>
        <TabsContent value="nuevo" className="mt-0 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Formulario de membresía</h1>
          <p className="text-sm text-muted-foreground">
            {datos.personaExistenteId
              ? 'Completá y verificá los datos de esta persona.'
              : 'Registrar la membresía de una persona nueva.'}
          </p>
        </div>
      </div>

      {/* harness/21 Req 1: banner de "persona existente" o buscador para
          precargar a alguien ya registrado. */}
      {cargandoPersona ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos de la persona…
        </div>
      ) : datos.personaExistenteId ? (
        (() => {
          const pct = porcentajeCompletadoMembresia(datos);
          const color = pct >= 80 ? '#34c759' : pct >= 50 ? '#30b0c7' : '#ff9500';
          return (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                {/* Anillo de completitud (conic-gradient) con el % al centro. */}
                <div
                  className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, color-mix(in oklab, ${color} 16%, transparent) 0deg)` }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card">
                    <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-sm">
                    <UserCheck className="h-4 w-4 text-[#30d158]" />
                    Completando a <span className="font-semibold">{datos.primerNombre} {datos.primerApellido}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {bloqueado
                      ? 'Datos bloqueados — tocá "Editar" para corregirlos. Se actualiza la misma persona.'
                      : `Ficha ${pct}% completa — rellená lo que falte y guardá.`}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {bloqueado && (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => setBloqueado(false)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                )}
                {/* KAN-497 seguimiento: quitar la persona elegida por error. Solo
                 * desvincula a la persona; los demás campos del formulario se
                 * mantienen. Pide confirmación antes. */}
                <button
                  type="button"
                  aria-label="Quitar a esta persona"
                  title="Quitar a esta persona"
                  onClick={() => setConfirmarQuitarPersona(true)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3">
          <span className="text-xs font-medium text-muted-foreground">¿La persona ya está registrada? Buscala para completar su membresía:</span>
          <BuscadorPersona iglesiaId={iglesiaId} onSeleccionar={(p: PersonaBusqueda) => precargarPersona(p.id)} />
        </div>
      )}

      {/* fieldset disabled bloquea todos los campos de una sola vez en modo
          edición, hasta que se toque "Editar". */}
      <fieldset disabled={bloqueado} className="m-0 border-0 p-0">
        <MembresiaNuevosFields valores={datos} onChange={setDatos} iglesiaId={iglesiaId} />
      </fieldset>

      {/* Barra de acciones al final del formulario (scroll único). No es sticky
          a propósito: una barra sticky-bottom sin fondo opaco flota transparente
          sobre los campos (tapa contenido); con fondo opaco se ve la "franja
          blanca" que el owner pidió quitar. Al final del flujo evita ambos. */}
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="destructive"
          className="h-14 w-32 shrink-0 whitespace-normal bg-destructive px-2 text-center text-[13px] font-semibold leading-tight text-white hover:bg-destructive/90"
          onClick={() => setConfirmarLimpiar(true)}
        >
          Borrar y comenzar de nuevo
        </Button>
        <Button type="button" className="h-14 flex-1 gap-1.5 text-base" disabled={!puedeGuardar || guardandoFinal || bloqueado} onClick={handleGuardar}>
          {guardandoFinal ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {guardandoFinal ? 'Guardando…' : 'Guardar membresía'}
        </Button>
      </div>

      <Dialog open={confirmarQuitarPersona} onOpenChange={setConfirmarQuitarPersona}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Quitar a esta persona?</DialogTitle>
            <DialogDescription>
              Se desvincula a {datos.primerNombre} {datos.primerApellido} de este formulario. Los demás datos quedan como están. Si la persona ya existe, al guardar el sistema te avisará antes de crear otra.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setDatos((prev) => ({ ...prev, personaExistenteId: '' }));
                setBloqueado(false);
                setConfirmarQuitarPersona(false);
              }}
            >
              Sí, quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarLimpiar} onOpenChange={setConfirmarLimpiar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Comenzar de nuevo?</DialogTitle>
            <DialogDescription>
              Se borrará todo lo cargado y el borrador guardado, para empezar de cero. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleLimpiar}>
              Sí, comenzar de nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>
      </Tabs>

      <ConfirmarPosibleDuplicadoDialog
        open={mostrarDuplicado}
        onOpenChange={setMostrarDuplicado}
        candidatos={candidatosDuplicado}
        nombreTentativo={[datos.primerNombre, datos.segundoNombre, datos.primerApellido, datos.segundoApellido].filter(Boolean).join(' ')}
        onUsarExistente={(persona) => {
          setMostrarDuplicado(false);
          precargarPersona(persona.id);
        }}
        onNoEsLaMisma={() => {
          setDuplicadoDescartado(true);
          setMostrarDuplicado(false);
          void guardarFinal();
        }}
      />

      <DiscoAutoguardado mostrar={mostrarIndicador} estado={estado} />
    </div>
  );
}
