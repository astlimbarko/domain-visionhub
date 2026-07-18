import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Home,
  ClipboardList,
  Calendar,
  HeartHandshake,
  Wallet,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  UserCog,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { useAuthStore } from '@/store/auth.store';
import { cerrarSesion } from '@/services/auth.service';
import { ROUTES } from '@/utils/constants';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: ROUTES.DASHBOARD, soloOperativo: false, soloSuperAdmin: false },
  { icon: Users, label: 'Personas', path: ROUTES.PERSONAS, soloOperativo: false, soloSuperAdmin: false },
  { icon: Home, label: 'Casas de Paz', path: ROUTES.CASAS_DE_PAZ, soloOperativo: false, soloSuperAdmin: false },
  { icon: ClipboardList, label: 'Reportes', path: ROUTES.REPORTES, soloOperativo: false, soloSuperAdmin: false },
  { icon: Calendar, label: 'Calendario', path: ROUTES.CALENDARIO, soloOperativo: false, soloSuperAdmin: false },
  { icon: HeartHandshake, label: 'Evangelismo', path: ROUTES.EVANGELISMO, soloOperativo: false, soloSuperAdmin: false },
  { icon: Wallet, label: 'Finanzas', path: ROUTES.FINANZAS, soloOperativo: false, soloSuperAdmin: false },
  { icon: Settings, label: 'Panel del Supervisor', path: ROUTES.PANEL_SUPERVISOR, soloOperativo: true, soloSuperAdmin: false },
  { icon: ShieldCheck, label: 'Administración', path: ROUTES.ADMINISTRACION, soloOperativo: false, soloSuperAdmin: true },
];

function NavLinks({
  onNavigate,
  esOperativo,
  esSuperAdmin,
}: {
  onNavigate?: () => void;
  esOperativo: boolean;
  esSuperAdmin: boolean;
}) {
  const location = useLocation();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.filter((item) => (!item.soloOperativo || esOperativo) && (!item.soloSuperAdmin || esSuperAdmin)).map(({ icon: Icon, label, path }) => {
        const activo = path === ROUTES.DASHBOARD ? location.pathname === path : location.pathname.startsWith(path);
        return (
          <Link
            key={label}
            to={path}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              activo && 'bg-sidebar-accent text-sidebar-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoBrand() {
  return (
    <div className="flex items-center gap-2">
      <img src="/logo.png" alt="VisionHub" className="h-8 w-8 rounded-lg object-contain" />
      <span className="text-lg font-semibold text-sidebar-foreground">VisionHub</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const setIglesiaActiva = useAuthStore((s) => s.setIglesiaActiva);
  const esSuperAdmin = useAuthStore((s) => s.esSuperAdmin);
  const logout = useAuthStore((s) => s.logout);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navigate = useNavigate();

  const esOperativo = iglesias.find((i) => i.id === iglesiaActivaId)?.es_operativo ?? false;

  async function handleLogout() {
    await cerrarSesion();
    logout();
  }

  return (
    <div className="flex min-h-svh flex-col bg-background sm:flex-row">
      {/* Sidebar de escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar p-4 sm:flex">
        <div className="mb-6 px-2">
          <LogoBrand />
        </div>
        <NavLinks esOperativo={esOperativo} esSuperAdmin={esSuperAdmin} />
        <Button variant="ghost" className="justify-start gap-3 px-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      </aside>

      {/* Header movil */}
      <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 sm:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menú"
            onClick={() => setMenuAbierto(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <img src="/logo.png" alt="VisionHub" className="h-7 w-7 rounded-lg object-contain" />
          <span className="text-base font-semibold text-sidebar-foreground">VisionHub</span>
        </div>
      </header>

      {/* Drawer de navegacion movil */}
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent side="left" className="flex w-3/4 max-w-xs flex-col bg-sidebar p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle asChild>
              <LogoBrand />
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col p-4">
            <NavLinks onNavigate={() => setMenuAbierto(false)} esOperativo={esOperativo} esSuperAdmin={esSuperAdmin} />
          </div>
          <SheetFooter className="border-t border-border">
            <Button variant="ghost" className="justify-start gap-3 px-3" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            {iglesias.length > 1 ? (
              <Select value={iglesiaActivaId ?? ''} onValueChange={setIglesiaActiva}>
                <SelectTrigger className="w-full sm:w-56">
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
              <p className="truncate text-sm font-medium text-foreground">{iglesias[0]?.nombre}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 truncate text-sm text-muted-foreground hover:text-foreground">
                <span className="truncate">{nombreCompleto}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(ROUTES.CUENTA)}>
                <UserCog className="h-4 w-4" />
                Cuenta
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleLogout}>
                <LogOut className="h-4 w-4" />
                Salir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
