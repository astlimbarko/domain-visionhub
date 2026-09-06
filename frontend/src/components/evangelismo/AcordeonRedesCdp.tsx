import { ChevronDown, ChevronUp, Home, MapPin, Share2 } from 'lucide-react';
import { PersonaNombreLink } from '@/components/personas/PersonaNombreLink';
import { ListaPersonasDia, type PersonaDelDia } from '@/components/evangelismo/ListaPersonasDia';

const AZUL = '#0D6EFD';

export interface CdpConActividad {
  cdpId: string;
  etiqueta: string;
  liderId: string | null;
  liderNombre: string | null;
  total: number;
  personas: PersonaDelDia[];
}

export interface RedConActividad {
  redId: string;
  redNombre: string;
  total: number;
  cdps: CdpConActividad[];
}

interface Props {
  datos: RedConActividad[];
  expandidas: Set<string>;
  onAlternar: (redId: string) => void;
}

/** Acordeón Red -> Casa de Paz -> personas, reutilizado tanto para "Detalle
 * del día" como para "Resumen semanal" -- ambos parten del mismo shape
 * (RedConActividad[]), solo cambia qué rango de fechas se usó para armarlo. */
export function AcordeonRedesCdp({ datos, expandidas, onAlternar }: Props) {
  return (
    <>
      {datos.map((red) => {
        const expandida = expandidas.has(red.redId);
        return (
          <div key={red.redId} className="rounded-xl border border-border/60 bg-muted/20">
            <button
              type="button"
              onClick={() => onAlternar(red.redId)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Share2 className="h-3.5 w-3.5 shrink-0" style={{ color: AZUL }} />
                {red.redNombre}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{red.total}</span>
              </span>
              {expandida ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </button>
            {expandida && (
              <div className="flex flex-col gap-3 border-t border-border/60 px-3 py-3">
                {red.cdps.map((c) => (
                  <div key={c.cdpId} className="flex flex-col gap-1.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Home className="h-3.5 w-3.5 shrink-0" style={{ color: AZUL }} />
                      {c.etiqueta}
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{c.total}</span>
                    </p>
                    <p className="flex items-center gap-1.5 pl-5 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      Líder: {c.liderId && c.liderNombre ? <PersonaNombreLink personaId={c.liderId}>{c.liderNombre}</PersonaNombreLink> : (c.liderNombre ?? 'Sin líder')}
                    </p>
                    <div className="pl-5">
                      <ListaPersonasDia personas={c.personas} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
