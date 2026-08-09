import { useState, type RefObject } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { descargarElementoComoPdf } from '@/utils/exportarPdf';

interface Props {
  /** Ref al contenedor que se quiere descargar -- ya renderizado con sus filtros aplicados. */
  contenedorRef: RefObject<HTMLElement | null>;
  /** Prefijo del nombre del archivo (sin fecha ni extensión, se agregan solas). */
  nombreArchivo: string;
  className?: string;
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  /** Por defecto "Descargar PDF"; algunos lugares angostos usan solo "Descargar". */
  label?: string;
}

/**
 * Botón reusable de KAN-50: descarga en PDF exactamente lo que hay dentro de
 * `contenedorRef` en el momento del click. No tiene acceso a datos propio --
 * lo que se ve en pantalla ya viene filtrado por rol/permisos, así que capturar
 * el DOM alcanza (ver `utils/exportarPdf.ts`). El propio botón se auto-excluye
 * de la captura con `data-pdf-excluir`.
 */
export function DescargarPdfButton({ contenedorRef, nombreArchivo, className, variant = 'outline', size = 'sm', label = 'Descargar PDF' }: Props) {
  const [descargando, setDescargando] = useState(false);

  async function handleClick() {
    const el = contenedorRef.current;
    if (!el || descargando) return;
    setDescargando(true);
    try {
      await descargarElementoComoPdf(el, nombreArchivo);
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setDescargando(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('gap-1.5', className)}
      onClick={handleClick}
      disabled={descargando}
      data-pdf-excluir="true"
    >
      {descargando ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
      {descargando ? 'Generando...' : label}
    </Button>
  );
}
