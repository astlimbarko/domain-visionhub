import { Download, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RegistroProcesoAfirmacion } from '@/services/afirmacion.service';
import { exportarRegistroProcesoPdf, exportarRegistroProcesoXls } from '@/utils/exportarRegistroProceso';

/** Botón rojo resaltante "Exportar" con menú desplegable (PDF / XLS) para la
 * pestaña "Registro" de las puertas. Exporta la lista que recibe (ya filtrada). */
export function ExportRegistroBotones({ registros, proceso }: { registros: RegistroProcesoAfirmacion[]; proceso: string }) {
  const vacio = registros.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          disabled={vacio}
          className="gap-1.5 bg-[#FF3B30] text-white shadow-sm hover:bg-[#E0321F] border-transparent focus-visible:ring-[#FF3B30]"
        >
          <Download className="h-4 w-4" />
          Exportar
          <ChevronDown className="h-4 w-4 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="gap-2" onClick={() => { void exportarRegistroProcesoPdf(registros, { proceso }); }}>
          <FileText className="h-4 w-4" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => exportarRegistroProcesoXls(registros, { proceso })}>
          <FileSpreadsheet className="h-4 w-4" /> XLS
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
