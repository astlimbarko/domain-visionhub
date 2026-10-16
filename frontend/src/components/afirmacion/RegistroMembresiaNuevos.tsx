import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CAMPO_ESTILO } from '@/lib/estilos';
import { useHistorialProcesoAfirmacion } from '@/hooks/useAfirmacion';
import { calcularEdad } from '@/utils/edad';
import { EliminarRegistroProceso } from '@/components/afirmacion/EliminarRegistroProceso';
import { IndicadorCruceProceso } from '@/components/afirmacion/IndicadorCruceProceso';
import { ResumenProcesoAfirmacion } from '@/components/afirmacion/ResumenProcesoAfirmacion';
import { ExportRegistroBotones } from '@/components/afirmacion/ExportRegistroBotones';
import { useFichaPersonaStore } from '@/store/ficha-persona.store';

interface Props {
  iglesiaId: string;
  /** Al tocar una persona, en la puerta de Membresía se vuelve al formulario
   * "Nuevo" precargado y en modo edición. Si no se pasa (ej. AfirmacionPersonas)
   * se abre la ficha completa como antes. */
  onEditar?: (personaId: string) => void;
}

/**
 * Pestaña "Registro" del formulario de membresía de nuevos. Misma estructura que
 * las puertas Altar/Bautismo/RSIL (tabla desktop + tarjetas móvil + filtro por
 * colaborador + botón Exportar), más lo propio de Membresía: indicador de si la
 * persona YA tiene su BAUTIZO registrado (pedido del owner 2026-10-03) y precarga
 * en "Nuevo" al tocar la fila. Todos los que gestionan Afirmación ven TODO.
 */
export function RegistroMembresiaNuevos({ iglesiaId, onEditar }: Props) {
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const { data: registrosCrudo = [], isLoading } = useHistorialProcesoAfirmacion(
    iglesiaId,
    'MEMBRESIA_NUEVOS',
    colaboradorFiltro === 'TODOS' ? undefined : colaboradorFiltro,
  );
  const { data: historialBautismo = [] } = useHistorialProcesoAfirmacion(iglesiaId, 'BAUTISMO');
  const conBautizo = useMemo(() => new Set(historialBautismo.map((r) => r.persona_id)), [historialBautismo]);
  const abrirFicha = useFichaPersonaStore((s) => s.abrir);
  const abrirPersona = (id: string) => (onEditar ? onEditar(id) : abrirFicha(id, { permitirEdicionExtra: true }));

  const registros = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return registrosCrudo;
    return registrosCrudo.filter((r) => r.nombre_completo.toLowerCase().includes(q));
  }, [registrosCrudo, busqueda]);

  const colaboradores = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of registrosCrudo) {
      if (r.registrado_por && r.registrado_por_nombre) mapa.set(r.registrado_por, r.registrado_por_nombre);
    }
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre }));
  }, [registrosCrudo]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{registros.length}</span> registro{registros.length === 1 ? '' : 's'} de Membresía
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {colaboradores.length > 1 && (
            <Select value={colaboradorFiltro} onValueChange={setColaboradorFiltro}>
              <SelectTrigger className={`w-56 ${CAMPO_ESTILO}`}>
                <SelectValue placeholder="Ver de..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Ver de: Todos</SelectItem>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ExportRegistroBotones registros={registros} proceso="Membresía" />
        </div>
      </div>

      {registrosCrudo.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar persona en Membresía..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      )}

      {registrosCrudo.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay personas registradas desde este formulario.
        </div>
      ) : registros.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          Sin resultados para esa búsqueda.
        </div>
      ) : (
        <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-10 px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">#</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Persona</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Edad</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fecha</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Colaborador</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Quién lo invitó</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Red</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-border/40 hover:bg-muted/40"
                  onClick={() => abrirPersona(r.persona_id)}
                >
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5 font-medium">
                    <span className="flex items-center gap-1.5">
                      {r.nombre_completo}
                      <IndicadorCruceProceso presente={conBautizo.has(r.persona_id)} etiqueta="Bautizo" />
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{r.fecha_nacimiento ? calcularEdad(r.fecha_nacimiento) : '—'}</td>
                  <td className="px-3 py-1.5 tabular-nums">{new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-BO')} · {new Date(r.fecha_creacion).toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.registrado_por_nombre ?? '—'}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.invitado_por ?? '—'}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.red_nombre ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <EliminarRegistroProceso registroId={r.id} nombre={r.nombre_completo} procesoCodigo="MEMBRESIA_NUEVOS" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {registros.length > 0 && (
        <div className="flex flex-col gap-1.5 md:hidden">
          {registros.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2 hover:bg-muted/40"
            >
              <button
                type="button"
                onClick={() => abrirPersona(r.persona_id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {r.nombre_completo}
                    <IndicadorCruceProceso presente={conBautizo.has(r.persona_id)} etiqueta="Bautizo" />
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-BO')} · {new Date(r.fecha_creacion).toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'})}
                    {r.fecha_nacimiento && ` · ${calcularEdad(r.fecha_nacimiento)} años`}
                    {r.registrado_por_nombre && ` · ${r.registrado_por_nombre}`}
                    {r.invitado_por && ` · invitó: ${r.invitado_por}`}
                    {r.red_nombre && ` · ${r.red_nombre}`}
                  </p>
                </div>
              </button>
              <EliminarRegistroProceso registroId={r.id} nombre={r.nombre_completo} procesoCodigo="MEMBRESIA_NUEVOS" />
            </div>
          ))}
        </div>
      )}

      <ResumenProcesoAfirmacion
        registros={registros}
        etiqueta="Membresía"
        extra={registros.length > 0 ? `Con bautizo registrado: ${registros.filter((r) => conBautizo.has(r.persona_id)).length} de ${registros.length}.` : undefined}
      />
    </div>
  );
}
