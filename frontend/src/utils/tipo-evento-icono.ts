import { Cake, Flame, Flower2, Megaphone, PartyPopper, Shield, Users, Zap, type LucideIcon } from 'lucide-react';

/**
 * Ícono por tipo de evento, según el catálogo sembrado en
 * harness/07-calendario-eventos/design.md. `tipo_evento.icono` en la base es
 * la ruta a un PNG en Storage (no garantizado que exista todavía), así que
 * en vez de enlazarlo se usa un ícono Lucide equivalente por `codigo`.
 */
const ICONOS_POR_CODIGO: Record<string, LucideIcon> = {
  RMS: Flame,
  AVIVATE: Megaphone,
  ELITE_LINAJE_ESCOGIDO: Shield,
  MUJERES_DEL_AHORA: Flower2,
  MOS: Zap,
  REUNION: Users,
  MEGA_FIESTA: PartyPopper,
  CUMPLEANOS: Cake,
};

export function iconoTipoEvento(codigo: string): LucideIcon {
  return ICONOS_POR_CODIGO[codigo] ?? Users;
}
