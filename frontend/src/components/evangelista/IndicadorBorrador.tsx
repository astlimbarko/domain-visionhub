import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Save } from 'lucide-react';
import { EVANGELISTA_COLOR } from '@/utils/evangelista-colores';

interface Props {
  mostrar: boolean;
  estado: 'guardando' | 'guardado';
}

/** Indicador flotante de borrador -- mismo molde exacto que ya usa
 * `Reportes.tsx` (KAN-443), con el color propio de Evangelista en vez de
 * TEAL. No crear un patrón visual nuevo para esto. */
export function IndicadorBorrador({ mostrar, estado }: Props) {
  return (
    <AnimatePresence>
      {mostrar && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none fixed right-5 bottom-5 z-50 flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            backgroundColor: `color-mix(in oklab, ${EVANGELISTA_COLOR.NARANJA} 22%, transparent)`,
            boxShadow: `0 0 18px 3px color-mix(in oklab, ${EVANGELISTA_COLOR.NARANJA} 55%, transparent)`,
          }}
        >
          {estado === 'guardando' ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" style={{ color: EVANGELISTA_COLOR.NARANJA_OSCURO }} />
          ) : (
            <Save className="h-4.5 w-4.5" style={{ color: EVANGELISTA_COLOR.NARANJA_OSCURO }} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
