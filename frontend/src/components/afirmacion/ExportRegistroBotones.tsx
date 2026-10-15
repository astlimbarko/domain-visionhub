import { FileText, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { RegistroProcesoAfirmacion } from '@/services/afirmacion.service';
import { exportarRegistroProcesoPdf, exportarRegistroProcesoXls } from '@/utils/exportarRegistroProceso';

/** Botones PDF/XLS para la pestaña "Registro" de las puertas (Altar/Bautismo/RSIL).
 * Exporta exactamente la lista que recibe (ya filtrada en pantalla). */
export function ExportRegistroBotones({ registros, proceso }: { registros: RegistroProcesoAfirmacion[]; proceso: string }) {
  const vacio = registros.length === 0;
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" className="gap-1.5" disabled={vacio} onClick={() => exportarRegistroProcesoPdf(registros, { proceso })}>
        <FileText className="h-4 w-4" /> PDF
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" disabled={vacio} onClick={() => exportarRegistroProcesoXls(registros, { proceso })}>
        <FileSpreadsheet className="h-4 w-4" /> XLS
      </Button>
    </div>
  );
}
