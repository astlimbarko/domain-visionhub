// harness/23: selector reusable de Casa de Paz para las "puertas de entrada"
// (añadir nueva persona en Altar / Bautismo / RSIL / Membresía). 3 modos:
//  - INVITADOR: por afinidad; se elige la persona que lo invitó (real) y de
//    ahí se deriva su CdP.
//  - LISTA: se elige la CdP directamente de la lista de la iglesia.
//  - ASIGNAR: ninguna; el caso va a la sección de designaciones de CdP (lo
//    asigna el líder de Afirmación más adelante).
// Componente controlado: recibe valores + onChange + iglesiaId.
import { cn } from '@/lib/utils';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BuscadorPersona } from '@/components/casas-de-paz/BuscadorPersona';
import { useCasasDePazAfirmacion } from '@/hooks/useAfirmacion';
import type { PersonaBusqueda } from '@/types/casas-de-paz.types';

export type CdpModo = '' | 'INVITADOR' | 'LISTA' | 'ASIGNAR';

export interface DatosCasaDePaz {
  cdpModo: CdpModo;
  invitadorPersonaId: string;
  invitadorNombre: string;
  casaDePazId: string;
  casaDePazNombre: string;
}

export const DATOS_CASA_DE_PAZ_VACIO: DatosCasaDePaz = {
  cdpModo: '',
  invitadorPersonaId: '',
  invitadorNombre: '',
  casaDePazId: '',
  casaDePazNombre: '',
};

interface Props {
  valores: DatosCasaDePaz;
  onChange: (valores: DatosCasaDePaz) => void;
  iglesiaId: string;
}

export function SelectorCasaDePaz({ valores, onChange, iglesiaId }: Props) {
  const { data: casasDePaz = [] } = useCasasDePazAfirmacion(valores.cdpModo === 'LISTA' ? iglesiaId : undefined);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>¿Cómo se define su Casa de Paz?</Label>
        <Select
          value={valores.cdpModo}
          onValueChange={(v) =>
            onChange({ ...DATOS_CASA_DE_PAZ_VACIO, cdpModo: v as CdpModo })
          }
        >
          <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="INVITADOR">Por quién lo invitó (afinidad)</SelectItem>
            <SelectItem value="LISTA">Elegir de la lista</SelectItem>
            <SelectItem value="ASIGNAR">Ninguna — asignar después</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {valores.cdpModo === 'INVITADOR' &&
        (valores.invitadorNombre ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
            <span className="truncate text-sm font-medium">{valores.invitadorNombre}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...valores, invitadorPersonaId: '', invitadorNombre: '' })}>
              Cambiar
            </Button>
          </div>
        ) : (
          <BuscadorPersona
            iglesiaId={iglesiaId}
            onSeleccionar={(p: PersonaBusqueda) => onChange({ ...valores, invitadorPersonaId: p.id, invitadorNombre: p.nombre_completo })}
          />
        ))}

      {valores.cdpModo === 'LISTA' && (
        <Select
          value={valores.casaDePazId}
          onValueChange={(v) => {
            const c = casasDePaz.find((x) => x.casa_de_paz_id === v);
            onChange({ ...valores, casaDePazId: v, casaDePazNombre: c?.casa_de_paz_etiqueta ?? '' });
          }}
        >
          <SelectTrigger className={cn('w-full', CAMPO_ESTILO)}><SelectValue placeholder="Elegí la Casa de Paz" /></SelectTrigger>
          <SelectContent>
            {casasDePaz.map((c) => <SelectItem key={c.casa_de_paz_id} value={c.casa_de_paz_id}>{c.casa_de_paz_etiqueta}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {valores.cdpModo === 'ASIGNAR' && (
        <p className="rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          Esta persona quedará <span className="font-medium text-foreground">sin Casa de Paz</span> y su caso irá a la sección de designaciones, para que el líder de Afirmación le asigne una más adelante.
        </p>
      )}
    </div>
  );
}
