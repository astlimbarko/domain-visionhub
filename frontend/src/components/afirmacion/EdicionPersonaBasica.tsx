// Modo EDICIÓN de las puertas rápidas de Afirmación (Altar / Bautismo / RSIL).
// Reemplaza al modal FichaPersonaSheet: al tocar una persona en la pestaña
// "Registro" se vuelve al formulario de "Nuevo" pero precargado y en modo
// edición. Arranca BLOQUEADO (fieldset disabled) -- un botón rojo "Editar"
// desbloquea los campos. El fondo de la pantalla ya cambia a un tinte ámbar
// (lo pone cada página) para que se distinga de un alta nueva.
//
// La precarga, el guardado (actualizarPersonaBasicaAfirmacion) y el estado
// viven en cada página (son copias independientes a propósito); acá solo la
// UI compartida del bloque de edición, para no triplicar markup idéntico.
import { ArrowLeft, Pencil, Save } from 'lucide-react';
import { AMBAR } from '@/components/dashboard/DashboardUI';
import { Button } from '@/components/ui/button';
import {
  DatosBasicosPersonaFields,
  datosBasicosPersonaValidos,
  type DatosBasicosPersonaValores,
} from '@/components/personas/DatosBasicosPersonaFields';

interface Props {
  /** Acento del proceso (hex), para el eyebrow del encabezado. */
  acento: string;
  /** Nombre de la persona que se está editando (para el banner). */
  nombre: string;
  valores: DatosBasicosPersonaValores;
  onChange: (v: DatosBasicosPersonaValores) => void;
  /** true = campos bloqueados (solo lectura). El botón "Editar" lo pasa a false. */
  bloqueado: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onGuardar: () => void;
  guardando: boolean;
}

export function EdicionPersonaBasica({ acento, nombre, valores, onChange, bloqueado, onEditar, onCancelar, onGuardar, guardando }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onCancelar}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="flex flex-col leading-tight text-left">
          <span className="text-[11px] tracking-wide uppercase" style={{ color: acento }}>Editar persona</span>
          <span className="truncate text-base font-bold text-foreground">{nombre}</span>
        </span>
      </button>

      {/* Banner de edición: ámbar, para reforzar que NO es un alta nueva. */}
      <div
        className="flex flex-col gap-1 rounded-2xl border px-4 py-3 text-sm"
        style={{
          borderColor: `color-mix(in oklab, ${AMBAR} 35%, transparent)`,
          background: `color-mix(in oklab, ${AMBAR} 12%, transparent)`,
        }}
      >
        <span className="font-semibold">{bloqueado ? 'Editando una persona existente' : 'Modo edición activado'}</span>
        <span className="text-[13px] text-muted-foreground">
          {bloqueado
            ? 'Los datos están bloqueados. Tocá "Editar" para corregirlos. Se actualiza la misma persona, no se crea una nueva.'
            : 'Corregí lo que necesites y guardá los cambios.'}
        </span>
      </div>

      {/* fieldset disabled bloquea TODOS los controles internos de una sola vez
          (inputs, selects, checkboxes) sin tocar DatosBasicosPersonaFields. */}
      <fieldset disabled={bloqueado} className="m-0 flex flex-col gap-4 border-0 p-0">
        <DatosBasicosPersonaFields valores={valores} onChange={onChange} />
      </fieldset>

      {bloqueado ? (
        <Button
          type="button"
          onClick={onEditar}
          className="mt-1 w-full gap-2 bg-destructive py-6 text-base text-white hover:bg-destructive/90"
        >
          <Pencil className="h-5 w-5" /> Editar
        </Button>
      ) : (
        <div className="mt-1 flex gap-2">
          <Button type="button" variant="outline" className="flex-1 py-6 text-base" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1 gap-2 py-6 text-base"
            disabled={!datosBasicosPersonaValidos(valores) || guardando}
            onClick={onGuardar}
          >
            <Save className="h-5 w-5" /> {guardando ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </div>
  );
}
