/**
 * KAN-124: asistente paginado genérico y reutilizable. No es dueño de los
 * datos (cada página trae su propio contenido/estado) -- solo administra la
 * navegación (paso actual, barra de progreso, validación por página antes de
 * avanzar). Pensado para envolver los 3 flujos de alta de Membresía
 * (FormularioMembresiaPublico, MembresiaObligatoria, RegistrarPersonaAfirmacion),
 * todos con el mismo Page 1 (CamposMembresiaFields) + páginas de
 * CamposMembresiaExtendidaFields (KAN-123).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface PasoFormularioPaginado {
  id: string;
  titulo: string;
  contenido: ReactNode;
  /** Corre antes de avanzar a la página siguiente (o de finalizar, en la
   * última). Devolver false cancela el avance -- mismo patrón que el
   * `trigger()` parcial de react-hook-form. */
  validar?: () => boolean | Promise<boolean>;
}

interface Props {
  pasos: PasoFormularioPaginado[];
  onFinalizar: () => void | Promise<void>;
  enviando?: boolean;
  textoFinalizar?: string;
  pasoInicial?: number;
  onCambiarPaso?: (paso: number) => void;
  /** KAN-179: botón adicional (ej. "Saltar") en el mismo pie que Atrás/
   * Siguiente -- cuando se pasa, el pie queda centrado como grupo de a 3 en
   * vez de ir a los extremos. Sin esto, el pie no cambia (Atrás/Siguiente a
   * los extremos, como siempre). */
  accionExtra?: ReactNode;
  /** KAN-179: nota corta encima del pie de botones (ej. "podés saltar cuando
   * quieras") -- opcional, no afecta a los demás llamadores si no se pasa. */
  notaPie?: ReactNode;
}

export function FormularioPaginado({
  pasos,
  onFinalizar,
  enviando = false,
  textoFinalizar = 'Enviar',
  pasoInicial = 0,
  onCambiarPaso,
  accionExtra,
  notaPie,
}: Props) {
  const [pasoActual, setPasoActual] = useState(
    Math.min(Math.max(pasoInicial, 0), pasos.length - 1)
  );
  const esUltimo = pasoActual === pasos.length - 1;
  const paso = pasos[pasoActual];
  const progreso = ((pasoActual + 1) / pasos.length) * 100;

  function irA(indice: number) {
    setPasoActual(indice);
    onCambiarPaso?.(indice);
  }

  async function siguiente() {
    if (paso.validar) {
      const ok = await paso.validar();
      if (!ok) return;
    }
    if (esUltimo) {
      await onFinalizar();
    } else {
      irA(pasoActual + 1);
    }
  }

  function atras() {
    if (pasoActual > 0) irA(pasoActual - 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{paso.titulo}</span>
          <span>
            {pasoActual + 1} / {pasos.length}
          </span>
        </div>
        <Progress value={progreso} />
      </div>

      <div key={paso.id}>{paso.contenido}</div>

      {notaPie}

      {/* flex-wrap + ancho completo por botón en mobile: con accionExtra son 3
          botones sin achicarse (shrink-0/whitespace-nowrap de Button) que en
          una fila fija desbordaban el modal en pantallas chicas, dejando
          "Saltar" cortado o fuera de vista. */}
      <div className={cn('flex flex-wrap items-center gap-3 pt-1', accionExtra ? 'sm:justify-center' : 'justify-between')}>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={atras} disabled={pasoActual === 0 || enviando}>
          Atrás
        </Button>
        <Button type="button" onClick={() => void siguiente()} disabled={enviando} className="w-full sm:w-auto sm:min-w-32">
          {enviando ? 'Guardando...' : esUltimo ? textoFinalizar : 'Siguiente'}
        </Button>
        {accionExtra}
      </div>
    </div>
  );
}
