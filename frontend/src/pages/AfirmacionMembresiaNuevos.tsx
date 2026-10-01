// KAN-488 (harness/21): pantalla "Membresía (Nuevos)" -- una sola página con
// scroll, para registrar la membresía de gente nueva (distinta de la membresía
// por link). Autoguardado en la tabla borrador (BD, 1 por usuario), restaura
// con aviso al volver, y botón Limpiar con confirmación. El guardado final a
// las tablas reales queda pendiente (depende de cerrar cómo se asigna la CdP,
// harness/23). Reusable desde el portal de Colaborar via prop `iglesiaId`.
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Save, Eraser, Check, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
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
  type DatosMembresiaNuevos,
} from '@/types/membresia-nuevos.types';
import {
  guardarBorradorMembresia,
  obtenerBorradorMembresia,
  eliminarBorradorMembresia,
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

export function AfirmacionMembresiaNuevos({ iglesiaId: iglesiaIdProp }: { iglesiaId?: string } = {}) {
  const iglesiaDelStore = useAuthStore((s) => s.iglesiaActivaId);
  const iglesiaId = iglesiaIdProp ?? iglesiaDelStore;

  const [datos, setDatos] = useState<DatosMembresiaNuevos>(DATOS_MEMBRESIA_NUEVOS_VACIO);
  const [estado, setEstado] = useState<EstadoGuardado>('inactivo');
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);
  const hidratado = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restaurar borrador al montar (solo si tiene contenido real -- lección
  // KAN-443: un formulario en blanco no debe disparar "se restauró tu borrador").
  useEffect(() => {
    if (!iglesiaId || hidratado.current) return;
    hidratado.current = true;
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

  function handleGuardar() {
    // KAN-488: el guardado final a las tablas reales (persona + detalle +
    // teléfono + dirección + estado SSVA + Casa de Paz) queda pendiente hasta
    // cerrar con el owner cómo se asigna la CdP (invitador/afinidad vs
    // "Asignar", harness/23). El autoguardado del borrador SÍ funciona.
    toast.info('Guardado final pendiente de conectar (definición de Casa de Paz).');
  }

  if (!iglesiaId) {
    return <p className="text-sm text-muted-foreground">Elegí una iglesia para continuar.</p>;
  }

  const puedeGuardar = membresiaNuevosValida(datos);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membresía (Nuevos)</h1>
          <p className="text-sm text-muted-foreground">Registrar la membresía de una persona nueva.</p>
        </div>
        <IndicadorGuardado estado={estado} />
      </div>

      <MembresiaNuevosFields valores={datos} onChange={setDatos} iglesiaId={iglesiaId} />

      <div className="sticky bottom-0 z-10 flex gap-2 border-t border-border/60 bg-background/95 py-3 backdrop-blur">
        <Button type="button" variant="outline" className="gap-1.5" onClick={() => setConfirmarLimpiar(true)}>
          <Eraser className="h-4 w-4" /> Limpiar
        </Button>
        <Button type="button" className="flex-1 gap-1.5 py-6 text-base" disabled={!puedeGuardar} onClick={handleGuardar}>
          <Save className="h-5 w-5" /> Guardar membresía
        </Button>
      </div>

      <Dialog open={confirmarLimpiar} onOpenChange={setConfirmarLimpiar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Limpiar el formulario?</DialogTitle>
            <DialogDescription>
              Se borrará todo lo cargado y el borrador guardado, para empezar de cero. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleLimpiar}>
              Sí, limpiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
