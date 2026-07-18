import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';
import { cerrarSesion } from '@/services/auth.service';

export function Dashboard() {
  const { t } = useTranslation();
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const iglesias = useAuthStore((s) => s.iglesias);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await cerrarSesion();
    logout();
  }

  return (
    <div className="min-h-svh bg-background p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{t('app.nombre')}</h1>
        <Button variant="outline" onClick={handleLogout}>
          Salir
        </Button>
      </header>
      <p className="text-muted-foreground">
        Hola, {nombreCompleto ?? 'usuario'}. Iglesias accesibles: {iglesias.map((i) => i.nombre).join(', ') || '—'}
      </p>
    </div>
  );
}
