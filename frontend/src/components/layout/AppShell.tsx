import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Menu, ChevronDown, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { precargarRuta } from '@/utils/precarga-rutas';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuthStore } from '@/store/auth.store';
import { cerrarSesion } from '@/services/auth.service';
import { useMiTitulo } from '@/hooks/useMiTitulo';
import { useMisRoles } from '@/hooks/useDashboard';
import { useRolUI } from '@/hooks/useRolUI';
import { useEsLiderAfirmacion } from '@/hooks/useEsLiderAfirmacion';
import { NAV_ITEMS_AFIRMACION, obtenerNavItems, type NavItem } from '@/utils/permisos';
import type { Vista } from '@/types/dashboard.types';
import { ROUTES } from '@/utils/constants';

interface Sombrero { key: string; label: string; vista: Vista; }

function mismaVista(a: Vista, b: Vista): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === 'red' && b.tipo === 'red') return a.redId === b.redId;
  if (a.tipo === 'cdp' && b.tipo === 'cdp') return a.cdpId === b.cdpId && a.esSublider === b.esSublider;
  if (a.tipo === 'supervisor' && b.tipo === 'supervisor') return a.iglesiaId === b.iglesiaId;
  return a.tipo === 'pastor';
}

function NavLinks({ onNavigate, navItems, sombreros }: { onNavigate?: () => void; navItems: NavItem[]; sombreros: Sombrero[] }) {
  const location = useLocation();
  const vistaActual = (location.state as { vista?: Vista } | null)?.vista;
  const queryClient = useQueryClient();
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;

  // Al pasar el mouse (o el foco, para navegación por teclado) por un link,
  // ya se dispara la carga del módulo y del primer dato que va a pedir --
  // para cuando el click llega, ya no hay nada que esperar.
  function precargar(path: string) {
    precargarRuta(path, queryClient, personaId, iglesiaActivaId);
  }

  return (
    <nav className="flex flex-1 flex-col gap-0.5">
      {navItems.map(({ icon: Icon, label, path, color }) => {
        const activo = location.pathname === path || location.pathname.startsWith(`${path}/`);

        // Chip de color vivo por sección: el ícono en su color sobre una pastilla
        // teñida. Se satura un poco más cuando la sección está activa.
        const iconoChip = (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
            style={{ backgroundColor: `color-mix(in oklab, ${color} ${activo ? 22 : 13}%, transparent)` }}
          >
            <Icon className="h-[16px] w-[16px]" style={{ color }} />
          </span>
        );

        if (path === ROUTES.DASHBOARD && sombreros.length > 1) {
          return (
            <div key={label} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-semibold text-foreground">
                {iconoChip}{label}
              </div>
              {sombreros.map((s) => {
                const activoSombrero = activo && vistaActual && mismaVista(vistaActual, s.vista);
                return (
                  <Link key={s.key} to={path} state={{ vista: s.vista }} onClick={onNavigate}
                    onMouseEnter={() => precargar(path)} onFocus={() => precargar(path)}
                    className={cn('truncate rounded-xl py-2 pr-3 pl-[44px] text-[13px] text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground', activoSombrero && 'bg-sidebar-accent font-medium text-foreground')}>
                    {s.label}
                  </Link>
                );
              })}
            </div>
          );
        }

        return (
          <Link key={label} to={path} onClick={onNavigate}
            onMouseEnter={() => precargar(path)} onFocus={() => precargar(path)}
            className={cn('flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all hover:bg-sidebar-accent', activo ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {iconoChip}<span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const nombreCompleto = useAuthStore((s) => s.nombreCompleto);
  const correo = useAuthStore((s) => s.correo);
  const iglesias = useAuthStore((s) => s.iglesias);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId);
  const setIglesiaActiva = useAuthStore((s) => s.setIglesiaActiva);
  const logout = useAuthStore((s) => s.logout);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const nombreMarca = iglesias.find((i) => i.id === iglesiaActivaId)?.nombre ?? 'VisionHub';
  const { data: titulo } = useMiTitulo(iglesiaActivaId ?? undefined);
  const textoUsuario = nombreCompleto ? titulo ? `${nombreCompleto} — ${titulo}` : nombreCompleto : (correo ?? '');

  // Rol UI y navegación filtrada
  const rolUI = useRolUI();
  const esLiderAfirmacion = useEsLiderAfirmacion();
  const navItems = [
    ...(rolUI ? obtenerNavItems(rolUI) : []),
    ...(esLiderAfirmacion ? NAV_ITEMS_AFIRMACION : []),
  ];

  // Sombreros para Dashboard multi-vista
  const { data: roles } = useMisRoles(iglesiaActivaId ?? undefined);
  const sombreros: Sombrero[] = [];
  if (roles?.es_operativo && iglesiaActivaId) sombreros.push({ key: 'operativo', label: titulo ?? 'Panel operativo', vista: { tipo: 'supervisor', iglesiaId: iglesiaActivaId } });
  for (const r of roles?.redes_lider ?? []) sombreros.push({ key: `red-${r.id}`, label: `Red: ${r.nombre}`, vista: { tipo: 'red', redId: r.id } });
  for (const c of roles?.cdp_lider ?? []) sombreros.push({ key: `cdp-${c.id}`, label: `CdP: ${c.etiqueta}`, vista: { tipo: 'cdp', cdpId: c.id, esSublider: false } });
  for (const c of roles?.cdp_sublider ?? []) sombreros.push({ key: `cdp-sub-${c.id}`, label: `CdP (sub): ${c.etiqueta}`, vista: { tipo: 'cdp', cdpId: c.id, esSublider: true } });

  async function handleLogout() {
    await cerrarSesion();
    logout();
    // El QueryClient es un singleton que vive toda la pestaña -- sin esto,
    // el cache de datos cacheados por iglesiaId (no por usuario) sobrevive
    // al logout, y la siguiente cuenta que inicie sesion en la MISMA
    // iglesia ve por un instante los datos de la cuenta anterior (roles,
    // titulo, etc.) hasta que el refetch en segundo plano los corrige.
    // Bug real reportado por el owner, 2026-07-26.
    queryClient.clear();
  }

  return (
    <div className="flex min-h-svh flex-col bg-background sm:flex-row">
      {/* Sidebar */}
      <aside className="hidden w-[250px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 sm:flex">
        <div className="mb-6 flex items-center gap-3 px-3 pt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-navy)]">
            <img src="/logo.png" alt={nombreMarca} className="h-5 w-5 object-contain brightness-0 invert" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-sidebar-foreground">{nombreMarca}</span>
        </div>
        <NavLinks navItems={navItems} sombreros={sombreros} />
      </aside>

      {/* Header mobile */}
      <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 sm:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Abrir menú" className="rounded-xl text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setMenuAbierto(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-navy)]">
            <img src="/logo.png" alt={nombreMarca} className="h-4.5 w-4.5 object-contain brightness-0 invert" />
          </div>
          <span className="text-[15px] font-bold text-sidebar-foreground">{nombreMarca}</span>
        </div>
      </header>

      {/* Drawer mobile */}
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent side="left" className="flex w-[270px] flex-col border-none bg-sidebar p-0">
          <SheetHeader className="border-b border-sidebar-border px-5 py-4">
            <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-navy)]">
                <img src="/logo.png" alt={nombreMarca} className="h-4.5 w-4.5 object-contain brightness-0 invert" />
              </div>
              <span className="text-[15px] font-bold">{nombreMarca}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col p-4">
            <NavLinks onNavigate={() => setMenuAbierto(false)} navItems={navItems} sombreros={sombreros} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Content */}
      <div className="aurora-bg-subtle flex min-w-0 flex-1 flex-col">
        <header className="glass-subtle mx-5 mt-5 flex flex-col gap-3 rounded-2xl px-5 py-3.5 sm:mx-8 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {iglesias.length > 1 ? (
              <Select value={iglesiaActivaId ?? ''} onValueChange={setIglesiaActiva}>
                <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Elegí una iglesia" /></SelectTrigger>
                <SelectContent>{iglesias.map((i) => (<SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>))}</SelectContent>
              </Select>
            ) : (
              <p className="text-[14px] font-semibold text-foreground">{iglesias[0]?.nombre}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-xl px-2 text-[13px] text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {(nombreCompleto ?? correo ?? '?')[0]?.toUpperCase()}
                </div>
                {/* Antes: hidden sm:inline — en móvil solo se veía el avatar, nunca el
                    nombre/título (Líder de CdP, Líder de Red...). Ahora se muestra
                    siempre, truncado para no desbordar en pantallas chicas. */}
                <span className="max-w-[70vw] truncate sm:max-w-[240px]">{textoUsuario}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => navigate(ROUTES.CUENTA)} className="gap-2"><UserCog className="h-4 w-4" /> Mi cuenta</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleLogout} className="gap-2 text-destructive focus:text-destructive"><LogOut className="h-4 w-4" /> Salir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
