import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';

import { ROUTES } from '@/utils/constants';
import { DashboardHero } from '@/components/dashboard/DashboardUI';
import { TarjetaHeader } from '@/components/shared/SeccionPerfil';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventoDetalle, useHistorialProcesoConEvento } from '@/hooks/useAfirmacionEventos';
import { KpiMosaico } from '@/components/dashboard/DashboardUI';
import { AZUL, VERDE, AMBAR, MORADO } from '@/components/dashboard/DashboardUI';
import { useAuthStore } from '@/store/auth.store';
import { ProcesoAfirmacionCodigo } from '@/types/afirmacion-eventos.types';

export function AfirmacionEventoDetalle() {
  const { eventoId } = useParams();
  const navigate = useNavigate();
  const iglesiaId = useAuthStore((s) => s.iglesiaActivaId);
  const { data: evento, isLoading } = useEventoDetalle(eventoId || null);
  const { data: historialAltar = [] } = useHistorialProcesoConEvento(iglesiaId, ProcesoAfirmacionCodigo.ALTAR, eventoId || null);
  const { data: historialBautismo = [] } = useHistorialProcesoConEvento(iglesiaId, ProcesoAfirmacionCodigo.BAUTISMO, eventoId || null);
  const { data: historialRsil = [] } = useHistorialProcesoConEvento(iglesiaId, ProcesoAfirmacionCodigo.RSIL, eventoId || null);
  const { data: historialMembresia = [] } = useHistorialProcesoConEvento(iglesiaId, ProcesoAfirmacionCodigo.MEMBRESIA_NUEVOS, eventoId || null);
  
  const totalHistorial = historialAltar.length + historialBautismo.length + historialRsil.length + historialMembresia.length;
  
  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        icon={Calendar}
        eyebrow="Evento de Afirmación"
        title={evento?.titulo || 'Detalle del evento'}
        subtitle={evento ? `${evento.tipo_nombre} • ${evento.fecha_inicio}${evento.fecha_fin ? ` → ${evento.fecha_fin}` : ''}` : ''}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(ROUTES.AFIRMACION_EVENTOS)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a eventos
            </Button>
            <Button asChild variant="outline">
              <Link to={ROUTES.AFIRMACION_ALTAR}>Ver todo (sin filtrar)</Link>
            </Button>
          </div>
        }
      />
      
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </>
        ) : (
          <>
            <KpiMosaico label="Total personas" icon={Calendar} color={AZUL} sub="En este evento">
              {evento?.total_personas ?? totalHistorial}
            </KpiMosaico>
            <KpiMosaico label="RSIL" icon={Calendar} color={AMBAR} sub="Registros">
              {evento?.total_rsil ?? historialRsil.length}
            </KpiMosaico>
            <KpiMosaico label="Bautismo" icon={Calendar} color={VERDE} sub="Registros">
              {evento?.total_bautismo ?? historialBautismo.length}
            </KpiMosaico>
            <KpiMosaico label="Membresía" icon={Calendar} color={MORADO} sub="Registros">
              {evento?.total_membresia ?? historialMembresia.length}
            </KpiMosaico>
          </>
        )}
      </div>
      
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Calendar} color={evento?.color || '#0071e3'} titulo="Altar" descripcion="Personas que pasaron al altar en este evento" />
        <div className="p-5">
          {historialAltar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros en este evento.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historialAltar.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
                  <span className="font-medium">{r.nombre_completo}</span>
                  <span className="text-muted-foreground text-xs">{r.fecha || r.fecha_creacion}</span>
                </div>
              ))}
              {historialAltar.length > 20 && <p className="text-xs text-muted-foreground mt-1">Mostrando primeros 20 de {historialAltar.length}</p>}
            </div>
          )}
        </div>
      </section>
      
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Calendar} color="#30b0c7" titulo="Bautismo" descripcion="Bautismos registrados en este evento" />
        <div className="p-5">
          {historialBautismo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros en este evento.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historialBautismo.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
                  <span className="font-medium">{r.nombre_completo}</span>
                  <span className="text-muted-foreground text-xs">{r.fecha || r.fecha_creacion}</span>
                </div>
              ))}
              {historialBautismo.length > 20 && <p className="text-xs text-muted-foreground mt-1">Mostrando primeros 20 de {historialBautismo.length}</p>}
            </div>
          )}
        </div>
      </section>
      
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Calendar} color="#8b7dd8" titulo="RSIL" descripcion="RSIL registrados en este evento" />
        <div className="p-5">
          {historialRsil.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros en este evento.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historialRsil.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
                  <span className="font-medium">{r.nombre_completo}</span>
                  <span className="text-muted-foreground text-xs">{r.fecha || r.fecha_creacion}</span>
                </div>
              ))}
              {historialRsil.length > 20 && <p className="text-xs text-muted-foreground mt-1">Mostrando primeros 20 de {historialRsil.length}</p>}
            </div>
          )}
        </div>
      </section>
      
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <TarjetaHeader icon={Calendar} color="#30d158" titulo="Membresía (Nuevos)" descripcion="Membresías registradas en este evento" />
        <div className="p-5">
          {historialMembresia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros en este evento.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historialMembresia.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
                  <span className="font-medium">{r.nombre_completo}</span>
                  <span className="text-muted-foreground text-xs">{r.fecha || r.fecha_creacion}</span>
                </div>
              ))}
              {historialMembresia.length > 20 && <p className="text-xs text-muted-foreground mt-1">Mostrando primeros 20 de {historialMembresia.length}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
