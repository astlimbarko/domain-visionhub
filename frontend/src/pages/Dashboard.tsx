import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Dashboard() {
  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-medium text-muted-foreground">Próximamente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Los dashboards por rol (Pastor, Supervisor, Líder de Red, Líder de CdP, Sublíder) se
              construyen en la próxima etapa.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
