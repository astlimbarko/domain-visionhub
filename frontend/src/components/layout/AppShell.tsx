import type { ReactNode } from 'react';
import { LayoutDashboard, Users, Home, Calendar, HeartHandshake, Wallet, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import { cerrarSesion } from '@/services/auth.service';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Users, label: 'Personas' },
  { icon: Home, label: 'Casas de Paz' },
  { icon: Calendar, label: 'Calendario' },
  { icon: HeartHandshake, label: 'Evangelismo' },
  { icon: Wallet, label: 'Finanzas' },
  { icon: Settings, label: 'Panel del Supervisor' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const setIglesiaActiva = useAuthStore((s) => s.setIglesiaActiva);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await cerrarSesion();
    logout();
  }

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar p-4 sm:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/logo.png" alt="VisionHub" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-lg font-semibold text-sidebar-foreground">VisionHub</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ icon: Icon, label }, i) => (
            <button
              key={label}
              type="button"
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                i === 0 && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <Button variant="ghost" className="justify-start gap-3 px-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            {iglesias.length > 1 ? (
              <Select value={iglesiaActivaId ?? undefined} onValueChange={setIglesiaActiva}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Elegí una iglesia" />
                </SelectTrigger>
                <SelectContent>
                  {iglesias.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium text-foreground">{iglesias[0]?.nombre}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{nombreCompleto}</p>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
