import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Link2Off } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useResolverUrlRegistro } from '@/hooks/useRegistroPublico';
import { FormularioMembresiaPublico } from '@/components/registro-publico/FormularioMembresiaPublico';

export function RegistroPublico() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = useResolverUrlRegistro(slug);
  const [exito, setExito] = useState<{ nombreCompleto: string; casaDePazNombre: string } | null>(null);

  // Anclado arriba (items-start), no centrado vertical: al marcar recuadros que
  // expanden subcampos (discipulados/seminario/bautismo con fecha), la tarjeta
  // cambia de alto -- si estuviera centrada, se re-centraba y "saltaba" en cada
  // tap, sobre todo en móvil, dificultando seleccionar. Anclada arriba, el alto
  // crece hacia abajo sin mover lo ya visible.
  return (
    // Bug real (2026-08-27): en móvil, el gesto táctil no lograba deslizar
    // limpio -- podía arrastrar la página en cualquier dirección en vez de
    // solo vertical. `overflow-x-hidden` corta cualquier desborde horizontal
    // por subpíxel (banderas/iconos que un dispositivo real renderiza distinto
    // a un navegador de escritorio) y `touch-pan-y` le dice al navegador que
    // el gesto en esta página es solo de scroll vertical, sin ambigüedad.
    // Acotado a esta página (no en `html` global) para no afectar tablas con
    // scroll horizontal en otras partes de la app.
    <div className="flex min-h-svh touch-pan-y items-start justify-center overflow-x-hidden bg-background p-4 sm:py-10">
      <Card className="w-full max-w-2xl rounded-2xl shadow-lg">
        {isLoading && (
          <CardContent className="flex flex-col gap-4 pt-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        )}

        {/* Distinto del caso "no disponible" (enlace inactivo, RPC respondió
            bien): acá la consulta en sí falló -- red, CORS, servidor caído.
            Antes esto quedaba como una tarjeta en blanco, indistinguible del
            "no disponible" real. */}
        {!isLoading && isError && (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <CardTitle className="text-lg">{t('registroPublico.errorCarga.titulo')}</CardTitle>
            <CardDescription>{t('registroPublico.errorCarga.mensaje')}</CardDescription>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? t('acciones.cargando') : t('acciones.reintentar')}
            </Button>
          </CardContent>
        )}

        {!isLoading && !isError && data && !data.admite_registro && (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Link2Off className="h-10 w-10 text-muted-foreground" />
            <CardTitle className="text-lg">{t('registroPublico.noDisponible.titulo')}</CardTitle>
            <CardDescription>{t('registroPublico.noDisponible.mensaje')}</CardDescription>
          </CardContent>
        )}

        {!isLoading && data && data.admite_registro && !exito && (
          <>
            <CardHeader>
              <CardTitle>{t('registroPublico.tituloFormulario')}</CardTitle>
              <p className="text-sm font-semibold text-muted-foreground">{data.iglesia_nombre}</p>
              <CardDescription>
                {t('registroPublico.liderResponsable')}: <strong>{data.lider_nombre}</strong>
                <br />
                {t('registroPublico.casaDePaz')}: <strong>{data.casa_de_paz_nombre}</strong>
                {data.red_nombre && (
                  <>
                    <br />
                    {t('registroPublico.red')}: <strong>{data.red_nombre}</strong>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormularioMembresiaPublico
                slug={slug as string}
                camposObligatorios={data.campos_obligatorios}
                onExito={setExito}
              />
            </CardContent>
          </>
        )}

        {exito && (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <CardTitle className="text-lg">{t('registroPublico.exito.titulo')}</CardTitle>
            <CardDescription>
              <Trans
                i18nKey="registroPublico.exito.mensaje"
                values={{ nombre: exito.nombreCompleto, casaDePaz: exito.casaDePazNombre }}
              />
            </CardDescription>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
