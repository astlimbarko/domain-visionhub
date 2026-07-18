import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { CheckCircle2, Link2Off } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useResolverUrlRegistro } from '@/hooks/useRegistroPublico';
import { FormularioMembresiaPublico } from '@/components/registro-publico/FormularioMembresiaPublico';

export function RegistroPublico() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { data, isLoading } = useResolverUrlRegistro(slug);
  const [exito, setExito] = useState<{ nombreCompleto: string; casaDePazNombre: string } | null>(null);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg rounded-2xl shadow-lg">
        {isLoading && (
          <CardContent className="flex flex-col gap-4 pt-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        )}

        {!isLoading && data && !data.admite_registro && (
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
              <CardDescription>
                {t('registroPublico.liderResponsable')}: <strong>{data.lider_nombre}</strong>
                <br />
                {t('registroPublico.casaDePaz')}: <strong>{data.casa_de_paz_nombre}</strong>
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
