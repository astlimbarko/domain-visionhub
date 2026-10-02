// KAN-490 (harness/23 A): selector UNIFICADO de Casa de Paz para las "puertas
// de entrada" (añadir nueva persona en Altar / Bautismo / RSIL / Membresía).
// Flujo natural (decisiones del owner 2026-10-01):
//  1. ¿Quién lo invitó? -> buscar en el sistema O escribir un nombre libre
//     (o dejarlo vacío). El invitador real trae su propia CdP.
//  2. Casa de Paz:
//     - IF el invitador es del sistema y tiene CdP -> se AUTO-SUGIERE su CdP,
//       con opción de cambiarla (flexible: el invitado puede ir a otra).
//     - Si no, se elige con un buscador por nombre / líder / Red (incluye
//       satélites) -- SelectorCdpBuscable.
//  3. Si no hay CdP elegida -> queda "sin asignar": va a designación para que
//     el líder de Afirmación la resuelva.
// Componente controlado: valores + onChange + iglesiaId. El "modo" para guardar
// se deriva (ver cdpModoDerivado): hay invitador real -> INVITADOR; hay CdP
// explícita -> LISTA; nada -> ASIGNAR.
import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import { SelectorCdpBuscable } from '@/components/afirmacion/SelectorCdpBuscable';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';
import type { CdpAsistencia } from '@/services/membresia-borrador.service';

export type CdpModo = '' | 'INVITADOR' | 'LISTA' | 'ASIGNAR';

export interface DatosCasaDePaz {
  /** Invitador del sistema (persona real); '' si es nombre libre o no hay. */
  invitadorPersonaId: string;
  /** Nombre a mostrar del invitador (persona real o texto libre). */
  invitadorNombre: string;
  /** true = invitadorNombre es texto libre (no es una persona del sistema). */
  invitadorEsLibre: boolean;
  /** CdP elegida/sugerida; '' = sin CdP (-> asignar después). */
  casaDePazId: string;
  casaDePazNombre: string;
}

export const DATOS_CASA_DE_PAZ_VACIO: DatosCasaDePaz = {
  invitadorPersonaId: '',
  invitadorNombre: '',
  invitadorEsLibre: false,
  casaDePazId: '',
  casaDePazNombre: '',
};

/** Modo derivado para el guardado: INVITADOR si hay invitador real, LISTA si
 * hay CdP explícita sin invitador real, ASIGNAR si no hay CdP. */
export function cdpModoDerivado(d: DatosCasaDePaz): CdpModo {
  if (d.invitadorPersonaId) return 'INVITADOR';
  if (d.casaDePazId) return 'LISTA';
  return 'ASIGNAR';
}

/** Botón estándar "quitar": círculo gris suave con una X roja al centro. */
function BotonQuitar({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-destructive transition-colors hover:bg-destructive/15"
    >
      <X className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}

interface Props {
  valores: DatosCasaDePaz;
  onChange: (valores: DatosCasaDePaz) => void;
  iglesiaId: string;
}

export function SelectorCasaDePaz({ valores, onChange, iglesiaId }: Props) {
  // Modo local del input de invitador: buscar en sistema vs escribir libre.
  const [modoInvitador, setModoInvitador] = useState<'buscar' | 'libre'>('buscar');
  // ¿La CdP actual vino sugerida del invitador? (solo para el texto de ayuda).
  const [cdpSugerida, setCdpSugerida] = useState(false);

  function elegirInvitadorSistema(p: PersonaBusqueda) {
    // Auto-sugiere la CdP del invitador (si tiene), flexible: se puede cambiar.
    const tieneCdp = !!p.casa_de_paz_id;
    onChange({
      ...valores,
      invitadorPersonaId: p.id,
      invitadorNombre: p.nombre_completo,
      invitadorEsLibre: false,
      casaDePazId: tieneCdp ? (p.casa_de_paz_id as string) : valores.casaDePazId,
      casaDePazNombre: tieneCdp ? (p.casa_de_paz_nombre ?? '') : valores.casaDePazNombre,
    });
    setCdpSugerida(tieneCdp);
  }

  function limpiarInvitador() {
    onChange({ ...valores, invitadorPersonaId: '', invitadorNombre: '', invitadorEsLibre: false });
    setCdpSugerida(false);
  }

  function elegirCdp(c: CdpAsistencia | null) {
    onChange({
      ...valores,
      casaDePazId: c?.casa_de_paz_id ?? '',
      casaDePazNombre: c?.casa_de_paz_etiqueta ?? '',
    });
    setCdpSugerida(false);
  }

  const hayInvitador = !!valores.invitadorNombre;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. ¿Quién lo invitó? */}
      <div className="flex flex-col gap-1.5">
        <Label>¿Quién lo invitó? <span className="font-normal text-muted-foreground">(opcional)</span></Label>
        {hayInvitador ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
            <span className="truncate text-sm font-medium">
              {valores.invitadorNombre}
              {valores.invitadorEsLibre && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(no está en el sistema)</span>}
            </span>
            <BotonQuitar onClick={limpiarInvitador} label="Quitar invitador" />
          </div>
        ) : modoInvitador === 'buscar' ? (
          <>
            <BuscadorPersona iglesiaId={iglesiaId} onSeleccionar={elegirInvitadorSistema} />
            <button
              type="button"
              className="self-start text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setModoInvitador('libre')}
            >
              La persona no está en el sistema — escribir el nombre
            </button>
          </>
        ) : (
          <>
            <Input
              className={CAMPO_ESTILO}
              placeholder="Nombre de quien lo invitó"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) onChange({ ...valores, invitadorPersonaId: '', invitadorNombre: v, invitadorEsLibre: true });
                }
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) onChange({ ...valores, invitadorPersonaId: '', invitadorNombre: v, invitadorEsLibre: true });
              }}
            />
            <button
              type="button"
              className="self-start text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setModoInvitador('buscar')}
            >
              Buscar en el sistema
            </button>
          </>
        )}
      </div>

      {/* 2. Casa de Paz */}
      <div className="flex flex-col gap-1.5">
        <Label>Casa de Paz</Label>
        {valores.casaDePazId ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
              <span className="truncate text-sm font-medium">{valores.casaDePazNombre}</span>
              <BotonQuitar onClick={() => elegirCdp(null)} label="Quitar Casa de Paz" />
            </div>
            {cdpSugerida && (
              <p className="text-[11px] text-muted-foreground">
                Sugerida por su invitador. Podés cambiarla si va a otra Casa de Paz.
              </p>
            )}
          </div>
        ) : (
          <>
            <SelectorCdpBuscable
              iglesiaId={iglesiaId}
              valorId={valores.casaDePazId}
              valorEtiqueta={valores.casaDePazNombre}
              onSeleccionar={elegirCdp}
            />
            <p className="rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2 text-[11px] text-muted-foreground">
              Si no elegís una Casa de Paz, la persona queda <span className="font-medium text-foreground">sin asignar</span> y
              su caso va a designaciones, para que el líder de Afirmación le asigne una más adelante.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
