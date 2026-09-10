import { desglosarTelefono } from '@/utils/paises-telefono';

// wa.me exige solo dígitos (sin "+", espacios ni guiones).
function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

/** Celda de Teléfono para tablas de listado (Evangelismo, Afirmación --
 * KAN-358, pedido explícito del owner): el "+591" completo chocaba contra
 * las columnas de al lado -- Bolivia es el país obvio/default de este
 * sistema, así que se oculta (el dato sigue completo en la base, solo no se
 * muestra), pero cualquier otro país sí muestra su código (info real, no se
 * puede asumir). Si el número no matchea ningún código conocido
 * (paises-telefono.ts), achica la fuente en vez de romper el layout. Texto
 * plano sin pill/ícono (segundo pedido del owner tras probarlo en vivo): un
 * pill con fondo seguía ocupando el espacio que se quería ahorrar --
 * funciona igual como link a WhatsApp, solo que visualmente es texto suelto. */
export function CeldaTelefono({ telefono }: { telefono: string | null }) {
  if (!telefono) return <span className="text-muted-foreground">—</span>;
  const { pais, numero } = desglosarTelefono(telefono);
  return (
    <a
      href={`https://wa.me/${soloDigitos(telefono)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(ev) => ev.stopPropagation()}
      className="tabular-nums text-[#128C4A] hover:underline"
    >
      {pais && pais.codigo !== '+591' && <span className="text-[9px] font-normal opacity-70">{pais.codigo} </span>}
      <span className={pais ? 'text-xs' : 'text-[10px]'}>{numero}</span>
    </a>
  );
}
