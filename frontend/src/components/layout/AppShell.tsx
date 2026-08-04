import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Menu, ChevronDown, UserCog, Repeat, LifeBuoy } from 'lucide-react';
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
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuthStore } from '@/store/auth.store';
import { cerrarSesion } from '@/services/auth.service';
import { useMiTitulo } from '@/hooks/useMiTitulo';
import { useMisRoles } from '@/hooks/useDashboard';
import { useRolUI } from '@/hooks/useRolUI';
import { useOpcionesRol } from '@/hooks/useOpcionesRol';
import { useEsLiderAfirmacion } from '@/hooks/useEsLiderAfirmacion';
import { useEsLiderJovenes, useEsEncargadoMatrimonios } from '@/hooks/useRolesGlobales';
import { NAV_ITEMS_AFIRMACION, NAV_ITEM_JOVENES, NAV_ITEM_MATRIMONIOS, obtenerNavItems, type NavItem } from '@/utils/permisos';
import { NotificacionesBell } from '@/components/layout/NotificacionesBell';
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

// Bloque discreto de soporte institucional, al pie del menú lateral (15-gestion-
// administrativa, REQ-UI-1). Abre el cliente de correo con asunto/cuerpo
// prellenados -- no es un formulario propio, para no construir/mantener
// backend solo para esto.
function SoporteFooter({ href, onClick, className, oscuro }: { href: string; onClick?: () => void; className?: string; oscuro?: boolean }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-[12px] transition-colors',
        oscuro ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-muted-foreground/75 hover:bg-sidebar-accent hover:text-foreground',
        className
      )}
    >
      <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex flex-col gap-0.5 text-left">
        <span className={cn('font-medium', oscuro ? 'text-white/80' : 'text-foreground/70')}>¿Encontraste un problema?</span>
        <span className="text-[11px] leading-snug">Ayúdanos a mejorar la plataforma</span>
      </span>
    </a>
  );
}

function NavLinks({ onNavigate, navItems, sombreros, oscuro }: { onNavigate?: () => void; navItems: NavItem[]; sombreros: Sombrero[]; oscuro?: boolean }) {
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
            <div key={path} className="flex flex-col gap-0.5">
              <div className={cn('flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-semibold', oscuro ? 'text-white' : 'text-foreground')}>
                {iconoChip}{label}
              </div>
              {sombreros.map((s) => {
                const activoSombrero = activo && vistaActual && mismaVista(vistaActual, s.vista);
                return (
                  <Link key={s.key} to={path} state={{ vista: s.vista }} onClick={onNavigate}
                    onMouseEnter={() => precargar(path)} onFocus={() => precargar(path)}
                    className={cn(
                      'truncate rounded-xl py-2 pr-3 pl-[44px] text-[13px] transition-all',
                      oscuro
                        ? cn('text-white/60 hover:bg-white/10 hover:text-white', activoSombrero && 'bg-white/10 font-medium text-white')
                        : cn('text-muted-foreground hover:bg-sidebar-accent hover:text-foreground', activoSombrero && 'bg-sidebar-accent font-medium text-foreground')
                    )}>
                    {s.label}
                  </Link>
                );
              })}
            </div>
          );
        }

        return (
          <Link key={path} to={path} onClick={onNavigate}
            onMouseEnter={() => precargar(path)} onFocus={() => precargar(path)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all',
              oscuro
                ? cn('hover:bg-white/10', activo ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white')
                : cn('hover:bg-sidebar-accent', activo ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:text-foreground')
            )}>
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
  const setRolActivo = useAuthStore((s) => s.setRolActivo);
  const logout = useAuthStore((s) => s.logout);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const opcionesRol = useOpcionesRol();

  const nombreMarca = iglesias.find((i) => i.id === iglesiaActivaId)?.nombre ?? 'Centro de Vida';
  const { data: titulo } = useMiTitulo(iglesiaActivaId ?? undefined);

  // Rol UI y navegación filtrada
  const rolUI = useRolUI();
  // Super Admin tiene su propio "tema" oscuro en todo el shell (sidebar +
  // barra superior + menú de cuenta) -- panel global, sin iglesia asociada,
  // visualmente distinto a propósito. Cada rol va a tener su color más
  // adelante; por ahora solo Super Admin usa este oscuro.
  const esOscuro = rolUI === 'SUPER_ADMIN';

  // El título ("Pastor", "Supervisor", etc.) es de la iglesia activa -- no
  // tiene sentido mostrarlo mientras se actúa como Super Admin (panel
  // global, sin iglesia asociada), confundiría con qué sombrero está puesto.
  const tituloMostrado = esOscuro ? null : titulo;
  const textoUsuario = nombreCompleto ? tituloMostrado ? `${nombreCompleto} — ${tituloMostrado}` : nombreCompleto : (correo ?? '');

  const esLiderAfirmacion = useEsLiderAfirmacion();
  const esLiderJovenes = useEsLiderJovenes();
  const esEncargadoMatrimonios = useEsEncargadoMatrimonios();
  const navItems = [
    ...(rolUI ? obtenerNavItems(rolUI) : []),
    ...(esLiderAfirmacion ? NAV_ITEMS_AFIRMACION : []),
    ...(esLiderJovenes ? [NAV_ITEM_JOVENES] : []),
    ...(esEncargadoMatrimonios ? [NAV_ITEM_MATRIMONIOS] : []),
  ];

  // Correo de soporte con contexto prellenado (rol, iglesia, sección) --
  // decisión del owner (15-gestion-administrativa, OQ-SOPORTE): facilita que
  // el usuario operativo describa el problema sin tener que copiar esos datos
  // a mano.
  const location = useLocation();
  // El cuerpo (no solo la barra/sidebar) también se oscurece, pero solo en
  // /administracion -- otras páginas (Afirmación, etc.) siguen viviendo con
  // el cuerpo claro de siempre aunque el rol activo sea Super Admin.
  const esPanelAdmin = location.pathname === ROUTES.ADMINISTRACION;
  const cuerpoSoporte = [
    'Hola equipo,',
    '',
    'Encontré un problema en el sistema. Estos son los detalles:',
    '',
    `- Usuario: ${textoUsuario || correo || 'N/D'}`,
    `- Rol: ${rolUI ?? 'N/D'}`,
    `- Iglesia: ${nombreMarca}`,
    `- Sección: ${location.pathname}`,
    '',
    'Descripción del problema:',
    '(Contá qué pasó, qué esperabas que pasara, y los pasos para reproducirlo)',
  ].join('\n');
  const mailtoSoporte = `mailto:soporte@somoscdv.com?subject=${encodeURIComponent('Reporte de incidencia')}&body=${encodeURIComponent(cuerpoSoporte)}`;

  // Sombreros para Dashboard multi-vista
  const { data: roles } = useMisRoles(iglesiaActivaId ?? undefined);
  const sombreros: Sombrero[] = [];
  if (roles?.es_operativo && iglesiaActivaId) sombreros.push({ key: 'operativo', label: titulo ?? 'Panel operativo', vista: { tipo: 'supervisor', iglesiaId: iglesiaActivaId } });
  for (const r of roles?.redes_lider ?? []) sombreros.push({ key: `red-${r.id}`, label: `Red: ${r.nombre}`, vista: { tipo: 'red', redId: r.id } });
  // Si ya hay acceso a nivel Red (Líder de Red o Supervisor de la Red en
  // Acción), no se muestra además un atajo a una CdP que ya pertenece a esa
  // misma Red -- es redundante, esa CdP ya se ve desde el dashboard de la
  // Red (pedido del owner, 2026-08-02). Solo se oculta cuando se solapa; una
  // CdP de una Red distinta a la que lidera/supervisa sigue apareciendo.
  const redesConAcceso = new Set((roles?.redes_lider ?? []).map((r) => r.id));
  for (const c of roles?.cdp_lider ?? []) {
    if (c.red_id && redesConAcceso.has(c.red_id)) continue;
    sombreros.push({ key: `cdp-${c.id}`, label: `CdP: ${c.etiqueta}`, vista: { tipo: 'cdp', cdpId: c.id, esSublider: false } });
  }
  for (const c of roles?.cdp_sublider ?? []) {
    if (c.red_id && redesConAcceso.has(c.red_id)) continue;
    sombreros.push({ key: `cdp-sub-${c.id}`, label: `CdP (sub): ${c.etiqueta}`, vista: { tipo: 'cdp', cdpId: c.id, esSublider: true } });
  }

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

  function handleCambiarRol() {
    setRolActivo(null);
    navigate(ROUTES.SELECCIONAR_ROL);
  }

  return (
    <div className="flex min-h-svh flex-col bg-background sm:flex-row">
      {/* Sidebar */}
      <aside className={cn(
        'hidden w-[250px] shrink-0 flex-col border-r p-4 sm:flex',
        esOscuro ? 'border-white/10 bg-[#0a0e1a]' : 'border-sidebar-border bg-sidebar'
      )}>
        <div className="mb-6 flex items-center gap-3 px-3 pt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-navy)]">
            <img src="/logo.png" alt={nombreMarca} className="h-5 w-5 object-contain brightness-0 invert" />
          </div>
          <span className={cn('text-[15px] font-bold tracking-tight', esOscuro ? 'text-white' : 'text-sidebar-foreground')}>{nombreMarca}</span>
        </div>
        <NavLinks navItems={navItems} sombreros={sombreros} oscuro={esOscuro} />
        <SoporteFooter
          href={mailtoSoporte}
          oscuro={esOscuro}
          className={cn('mt-2 border-t pt-3', esOscuro ? 'border-white/10' : 'border-sidebar-border')}
        />
      </aside>

      {/* Header mobile */}
      <header className={cn(
        'flex items-center justify-between border-b px-4 py-3 sm:hidden',
        esOscuro ? 'border-white/10 bg-[#0a0e1a]' : 'border-sidebar-border bg-sidebar'
      )}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menú"
            className={cn('rounded-xl', esOscuro ? 'text-white hover:bg-white/10' : 'text-sidebar-foreground hover:bg-sidebar-accent')}
            onClick={() => setMenuAbierto(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-navy)]">
            <img src="/logo.png" alt={nombreMarca} className="h-4.5 w-4.5 object-contain brightness-0 invert" />
          </div>
          <span className={cn('text-[15px] font-bold', esOscuro ? 'text-white' : 'text-sidebar-foreground')}>{nombreMarca}</span>
        </div>
        <div className={cn(esOscuro && 'text-white/70')}><NotificacionesBell /></div>
      </header>

      {/* Drawer mobile */}
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent side="left" className={cn('flex w-[270px] flex-col border-none p-0', esOscuro ? 'bg-[#0a0e1a]' : 'bg-sidebar')}>
          <SheetHeader className={cn('border-b px-5 py-4', esOscuro ? 'border-white/10' : 'border-sidebar-border')}>
            <SheetTitle className={cn('flex items-center gap-3', esOscuro ? 'text-white' : 'text-sidebar-foreground')}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-navy)]">
                <img src="/logo.png" alt={nombreMarca} className="h-4.5 w-4.5 object-contain brightness-0 invert" />
              </div>
              <span className="text-[15px] font-bold">{nombreMarca}</span>
            </SheetTitle>
          </SheetHeader>
          {iglesias.length > 1 && !esOscuro && (
            <div className="px-4 pt-4">
              <Select value={iglesiaActivaId ?? ''} onValueChange={setIglesiaActiva}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Elegí una iglesia" /></SelectTrigger>
                <SelectContent>{iglesias.map((i) => (<SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            <NavLinks onNavigate={() => setMenuAbierto(false)} navItems={navItems} sombreros={sombreros} oscuro={esOscuro} />
          </div>
          <div className={cn('border-t px-3 pt-3', esOscuro ? 'border-white/10' : 'border-sidebar-border')}>
            <SoporteFooter href={mailtoSoporte} onClick={() => setMenuAbierto(false)} oscuro={esOscuro} />
          </div>
          <SheetFooter className="gap-1 p-3">
            <button
              onClick={() => { setMenuAbierto(false); navigate(ROUTES.CUENTA); }}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors',
                esOscuro ? 'text-white hover:bg-white/10' : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <UserCog className="h-4 w-4" /> Mi cuenta
            </button>
            {opcionesRol && opcionesRol.length > 1 && (
              <button
                onClick={() => { setMenuAbierto(false); handleCambiarRol(); }}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors',
                  esOscuro ? 'text-white hover:bg-white/10' : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Repeat className="h-4 w-4" /> Cambiar rol
              </button>
            )}
            <button
              onClick={async () => { setMenuAbierto(false); await handleLogout(); }}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Content */}
      <div className={cn('flex min-w-0 flex-1 flex-col', esOscuro && esPanelAdmin ? 'bg-[#0a0e1a]' : 'bg-muted/30')}>
        {/* Barra superior delgada — solo en desktop; en móvil las acciones de
            cuenta viven en el pie del drawer. */}
        <header className={cn(
          'hidden items-center justify-between gap-3 border-b px-8 py-1.5 sm:flex',
          esOscuro ? 'border-white/10 bg-[#0a0e1a]' : 'border-border bg-card'
        )}>
          <div className="min-w-0">
            {esOscuro ? (
              // El panel de Super Admin es global (gestiona todas las iglesias a
              // la vez) -- elegir "iglesia activa" ahí no filtra nada y solo
              // confunde el flujo de rol (KAN-67), así que no se muestra el
              // selector mientras se actúa como Super Admin. Misma barra oscura
              // del módulo de Estructura Organizacional, solo el color -- el
              // resto de esta barra (campanita, menú de cuenta) queda igual.
              <p className="text-[13px] font-semibold text-white">Administración</p>
            ) : iglesias.length > 1 ? (
              <Select value={iglesiaActivaId ?? ''} onValueChange={setIglesiaActiva}>
                <SelectTrigger size="sm" className="w-52"><SelectValue placeholder="Elegí una iglesia" /></SelectTrigger>
                <SelectContent>{iglesias.map((i) => (<SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>))}</SelectContent>
              </Select>
            ) : (
              <p className="text-[13px] font-semibold text-foreground">{iglesias[0]?.nombre}</p>
            )}
          </div>
          <div className={cn('flex items-center gap-1', esOscuro && 'text-white/70')}>
          <NotificacionesBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                'flex min-w-0 max-w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-all',
                esOscuro
                  ? 'text-white/80 hover:bg-white/10 hover:text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {(nombreCompleto ?? correo ?? '?')[0]?.toUpperCase()}
                </div>
                <span className="max-w-[240px] truncate">{textoUsuario}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn('w-44', esOscuro && 'border border-white/10 bg-[#0a0e1a] text-white')}
            >
              <DropdownMenuItem
                onSelect={() => navigate(ROUTES.CUENTA)}
                className={cn('gap-2', esOscuro && 'focus:bg-white/10 focus:text-white')}
              >
                <UserCog className="h-4 w-4" /> Mi cuenta
              </DropdownMenuItem>
              {opcionesRol && opcionesRol.length > 1 && (
                <DropdownMenuItem
                  onSelect={handleCambiarRol}
                  className={cn('gap-2', esOscuro && 'focus:bg-white/10 focus:text-white')}
                >
                  <Repeat className="h-4 w-4" /> Cambiar rol
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={handleLogout}
                className={cn('gap-2 text-destructive focus:text-destructive', esOscuro && 'focus:bg-destructive/20')}
              >
                <LogOut className="h-4 w-4" /> Salir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
