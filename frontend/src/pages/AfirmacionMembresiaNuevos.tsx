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
import { toast } from 'sonner';
import { Save, Check, Loader2, ArrowLeft, UserCheck } from 'lucide-react';
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
  membresiaNuevosValida,
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

type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado';

function IndicadorGuardado({ estado }: { estado: EstadoGuardado }) {
  if (estado === 'inactivo') return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      {estado === 'guardando' ? (
        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</>
      ) : (
        <><Check className="h-3.5 w-3.5 text-[#34c759]" /> Guardado</>
      )}
    </span>
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
  const [guardandoFinal, setGuardandoFinal] = useState(false);
  const [cargandoPersona, setCargandoPersona] = useState(false);
  const hidratado = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Precarga de una persona EXISTENTE: trae sus datos de la base al formulario,
  // para verificar/corregir y confirmar. No crea una nueva (se actualiza).
  async function precargarPersona(personaId: string) {
    setCargandoPersona(true);
    try {
      const d = await obtenerPersonaParaMembresia(personaId);
      setDatos(d);
      setEstado('inactivo');
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
  }, [iglesiaId]);

  // Autoguardado con debounce en la tabla borrador (no en las tablas reales).
  useEffect(() => {
    if (!iglesiaId || !hidratado.current) return;
    if (!hayContenidoRealMembresia(datos)) return;
    setEstado('guardando');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      guardarBorradorMembresia(iglesiaId, datos)
        .then(() => setEstado('guardado'))
        .catch(() => setEstado('inactivo'));
    }, 900);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [datos, iglesiaId]);

  async function handleLimpiar() {
    setConfirmarLimpiar(false);
    setDatos(DATOS_MEMBRESIA_NUEVOS_VACIO);
    setEstado('inactivo');
    if (iglesiaId) {
      try {
        await eliminarBorradorMembresia(iglesiaId);
      } catch {
        /* si falla el borrado del borrador, igual se limpió la pantalla */
      }
    }
    toast.success('Formulario limpio, listo para empezar de cero.');
  }

  async function handleGuardar() {
    if (!iglesiaId || guardandoFinal) return;
    setGuardandoFinal(true);
    try {
      const res = await guardarMembresiaNuevos(iglesiaId, datos);
      // El borrador ya cumplió su función; se borra para no restaurarlo después.
      try {
        await eliminarBorradorMembresia(iglesiaId);
      } catch {
        /* no bloquea: la membresía ya quedó guardada */
      }
      setDatos(DATOS_MEMBRESIA_NUEVOS_VACIO);
      setEstado('inactivo');
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

  const puedeGuardar = membresiaNuevosValida(datos);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-1">
      {onVolver && (
        <button
          type="button"
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al portal
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membresía (Nuevos)</h1>
          <p className="text-sm text-muted-foreground">
            {datos.personaExistenteId
              ? 'Completá y verificá los datos de esta persona.'
              : 'Registrar la membresía de una persona nueva.'}
          </p>
        </div>
        <IndicadorGuardado estado={estado} />
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
                  <span className="text-[11px] text-muted-foreground">Ficha {pct}% completa — rellená lo que falte y guardá.</span>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setDatos(DATOS_MEMBRESIA_NUEVOS_VACIO); setEstado('inactivo'); }}>
                Persona nueva
              </Button>
            </div>
          );
        })()
      ) : (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3">
          <span className="text-xs font-medium text-muted-foreground">¿La persona ya está registrada? Buscala para completar su membresía:</span>
          <BuscadorPersona iglesiaId={iglesiaId} onSeleccionar={(p: PersonaBusqueda) => precargarPersona(p.id)} />
        </div>
      )}

      <MembresiaNuevosFields valores={datos} onChange={setDatos} iglesiaId={iglesiaId} />

      <div className="sticky bottom-0 z-10 flex items-stretch gap-2 py-3">
        <Button
          type="button"
          variant="destructive"
          className="w-28 shrink-0 whitespace-normal px-2 text-center text-[13px] font-semibold leading-tight"
          onClick={() => setConfirmarLimpiar(true)}
        >
          Borrar y comenzar de nuevo
        </Button>
        <Button type="button" className="flex-1 gap-1.5 text-base" disabled={!puedeGuardar || guardandoFinal} onClick={handleGuardar}>
          {guardandoFinal ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {guardandoFinal ? 'Guardando…' : 'Guardar membresía'}
        </Button>
      </div>

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
    </div>
  );
}
