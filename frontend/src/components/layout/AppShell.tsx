import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Menu, ChevronDown, UserCog, Repeat, LifeBuoy, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { precargarRuta } from '@/utils/precarga-rutas';
import { Button } from '@/components/ui/button';
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
import { useContextoActivo } from '@/hooks/useContextoActivo';
import type { NavItem } from '@/utils/permisos';
import { obtenerPanelContexto } from '@/utils/paneles-contexto';
import { NotificacionesBell } from '@/components/layout/NotificacionesBell';
import type { ContextoActivo } from '@/types/contexto-activo.types';
import { ROUTES } from '@/utils/constants';

interface Sombrero { key: string; label: string; contexto: ContextoActivo; }

const CORREO_SOPORTE = 'soporte@somoscdv.com';

// Bloque discreto de soporte institucional, al pie del menú lateral (15-gestion-
// administrativa, REQ-UI-1). Abre el cliente de correo con asunto/cuerpo
// prellenados -- no es un formulario propio, para no construir/mantener
// backend solo para esto. Compactado a una sola línea con el correo a la
// vista (antes eran 2 líneas de texto largo sin decir el correo -- pedido
// del owner, 2026-08-04, aplica a todos los sidebars del sistema).
function SoporteFooter({ href, correo, onClick, className, oscuro }: { href: string; correo: string; onClick?: () => void; className?: string; oscuro?: boolean }) {
  return (
    <a
      href={href}
      onClick={onClick}
      title="¿Encontraste un problema? Escribinos"
      className={cn(
        'flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] transition-colors',
        oscuro ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
        className
      )}
    >
      <LifeBuoy className="h-4 w-4 shrink-0" />
      <span className="truncate">{correo}</span>
    </a>
  );
}

function NavLinks({ onNavigate, navItems, sombreros, oscuro }: { onNavigate?: () => void; navItems: NavItem[]; sombreros: Sombrero[]; oscuro?: boolean }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const personaId = useAuthStore((s) => s.personaId);
  const iglesiaActivaId = useAuthStore((s) => s.iglesiaActivaId) ?? undefined;
  const contextoActivo = useAuthStore((s) => s.contextoActivo);
  const setContextoActivo = useAuthStore((s) => s.setContextoActivo);

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
                const activoSombrero = activo && contextoActivo?.clave === s.contexto.clave;
                return (
                  <Link
                    key={s.key}
                    to={path}
                    onClick={() => {
                      setContextoActivo(s.contexto);
                      onNavigate?.();
                    }}
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
  const setContextoActivo = useAuthStore((s) => s.setContextoActivo);
  const logout = useAuthStore((s) => s.logout);
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Buscador del navbar (KAN-74): hoy solo visual, sin funcionalidad todavia
  // -- ver esa tarea para programarlo. Arranca colapsado en una lupa (movil
  // Y desktop, mismo patron para "no contaminar la pantalla" -- pedido del
  // owner, 2026-08-04); un solo estado alcanza porque los 2 headers nunca
  // estan visibles a la vez (uno es sm:hidden, el otro hidden sm:flex).
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [valorBusqueda, setValorBusqueda] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const nombreMarca = iglesias.find((i) => i.id === iglesiaActivaId)?.nombre ?? 'Centro de Vida';
  const { data: titulo } = useMiTitulo(iglesiaActivaId ?? undefined);

  const { contextoActivo, contextosDisponibles } = useContextoActivo();
  const panelContexto = contextoActivo ? obtenerPanelContexto(contextoActivo) : null;
  const rolUI = contextoActivo?.rolUI ?? null;
  const esOscuro = panelContexto?.temaOscuro ?? false;
  const colorNavbarRol = panelContexto?.colorNavbar;
  const navbarClaro = panelContexto?.textoNavbarClaro ?? false;
  const estiloNavbarColor = colorNavbarRol ? { backgroundColor: colorNavbarRol } : undefined;
  const estiloSidebarColor = colorNavbarRol
    ? { backgroundColor: `color-mix(in oklab, ${colorNavbarRol} 10%, white)` }
    : undefined;

  const cargoLabel = panelContexto?.titulo ?? '';
  // El menú de cuenta (botón de perfil arriba a la derecha) muestra solo el
  // nombre -- el rol del panel activo ya se ve en el título de la sección
  // (cargoLabel, líneas de arriba/sidebar), repetirlo ahí era redundante
  // (pedido explícito del owner, 2026-08-21).
  const textoUsuario = nombreCompleto || correo || '';
  // El sidebar se obtiene exclusivamente del contexto elegido. Las demás
  // capacidades permanecen en el selector y nunca se suman a este menú.
  const navItems = panelContexto?.navItems ?? [];

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
  const mailtoSoporte = `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent('Reporte de incidencia')}&body=${encodeURIComponent(cuerpoSoporte)}`;

  // Sombreros para Dashboard multi-vista -- SOLO del mismo nivel que el
  // rolUI ya resuelto (determinarRolUI, permisos.ts: SUPER_ADMIN > PASTOR >
  // SUPERVISOR > LIDER_RED > LIDER_CDP > SUBLIDER_CDP). Antes se armaban
  // agregando TODOS los cargos que la persona tuviera sin importar su rol
  // activo -- un Supervisor que además fuera Sublíder de alguna CdP (cargo
  // "de sombra", no su rol operativo) veía "Panel operativo" mezclado con
  // "CdP (sub): ..." bajo el mismo Dashboard, como si fueran del mismo nivel
  // (pedido del owner, 2026-08-06: "los dashboards de los roles superiores
  // no deberían tener sus sombras de otros roles"). Ahora cada rama solo
  // deja pasar entradas del propio nivel -- para SUPERVISOR/LIDER_RED/
  // LIDER_CDP con más de una Red/CdP a cargo (multi-instancia real del mismo
  // nivel, no un rol distinto), sigue permitiendo elegir entre ellas.
  const { data: roles } = useMisRoles(iglesiaActivaId ?? undefined);
  const sombreros: Sombrero[] = [];
  if (rolUI === 'SUPERVISOR') {
    for (const contexto of contextosDisponibles ?? []) {
      if (contexto.rolUI === 'SUPERVISOR') {
        sombreros.push({ key: contexto.clave, label: titulo ?? 'Panel operativo', contexto });
      }
    }
  } else if (rolUI === 'LIDER_RED') {
    for (const contexto of contextosDisponibles ?? []) {
      if (contexto.alcance !== 'RED') continue;
      const red = roles?.redes_lider?.find((item) => item.id === contexto.redId);
      sombreros.push({
        key: contexto.clave,
        label: `${contexto.cargoRed === 'SUPERVISOR' ? 'Supervisión' : 'Red'}: ${red?.nombre ?? 'Sin nombre'}`,
        contexto,
      });
    }
  } else if (rolUI === 'LIDER_CDP') {
    for (const contexto of contextosDisponibles ?? []) {
      if (contexto.alcance !== 'CDP' || contexto.rolUI !== 'LIDER_CDP') continue;
      const cdp = roles?.cdp_lider?.find((item) => item.id === contexto.cdpId);
      sombreros.push({
        key: contexto.clave,
        label: `CdP: ${cdp?.etiqueta ?? 'Sin referencia'}`,
        contexto,
      });
    }
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
    setContextoActivo(null);
    navigate(ROUTES.SELECCIONAR_ROL);
  }

  return (
    <div className="flex min-h-svh flex-col bg-background sm:flex-row">
      {/* El Super Admin trabaja directamente en Administración y abre cada
          organigrama desde su iglesia. Su menú lateral queda oculto en todos
          los tamaños hasta que exista un menú con nuevas funciones reales. */}
      <aside
        className={cn(
          'w-[250px] shrink-0 flex-col border-r',
          esOscuro ? 'hidden' : 'hidden sm:flex',
          colorNavbarRol ? 'p-0' : 'p-4',
          esOscuro ? 'border-white/10 bg-[#0a0e1a]' : colorNavbarRol ? 'border-black/5' : 'border-sidebar-border bg-sidebar'
        )}
        style={!colorNavbarRol ? estiloSidebarColor : undefined}
      >
        {colorNavbarRol ? (
          // Misma altura/borde que la barra superior de escritorio de acá
          // abajo -- juntas forman una sola barra de ancho completo (pedido
          // del owner, 2026-08-04, ver opencode/red/2.png), aunque sigan
          // siendo 2 elementos separados en el DOM.
          <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-black/10 px-4" style={estiloNavbarColor}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-navy)]">
              <img src="/logo.png" alt={nombreMarca} className="h-5 w-5 object-contain brightness-0 invert" />
            </div>
            <span className={cn('truncate text-[15px] font-bold tracking-tight', navbarClaro ? 'text-white' : 'text-sidebar-foreground')}>{nombreMarca}</span>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-3 px-3 pt-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-navy)]">
              <img src="/logo.png" alt={nombreMarca} className="h-5 w-5 object-contain brightness-0 invert" />
            </div>
            <span className={cn('text-[15px] font-bold tracking-tight', esOscuro ? 'text-white' : 'text-sidebar-foreground')}>{nombreMarca}</span>
          </div>
        )}
        <div className={cn('flex flex-1 flex-col', colorNavbarRol && 'p-4')} style={colorNavbarRol ? estiloSidebarColor : undefined}>
          <NavLinks navItems={navItems} sombreros={sombreros} oscuro={esOscuro} />
          <SoporteFooter
            href={mailtoSoporte}
            correo={CORREO_SOPORTE}
            oscuro={esOscuro}
            className={cn('mt-2 border-t pt-3', esOscuro ? 'border-white/10' : 'border-sidebar-border')}
          />
        </div>
      </aside>

      {/* Header mobile */}
      <header
        className={cn(
          'flex items-center justify-between border-b px-4 py-3 sm:hidden',
          esOscuro ? 'border-white/10 bg-[#0a0e1a]' : colorNavbarRol ? 'border-black/10' : 'border-sidebar-border bg-sidebar'
        )}
        style={estiloNavbarColor}
      >
        <div className="flex min-w-0 items-center gap-3">
          {!esOscuro && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir menú"
              className={cn('shrink-0 rounded-xl', navbarClaro ? 'text-white hover:bg-white/10' : 'text-sidebar-foreground hover:bg-sidebar-accent')}
              onClick={() => setMenuAbierto(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-navy)]">
            <img src="/logo.png" alt={nombreMarca} className="h-4.5 w-4.5 object-contain brightness-0 invert" />
          </div>
          {/* Con navbar de color propio (hoy Lider de Red), el header movil
              dice el cargo -- no el nombre de la iglesia (pedido del owner,
              2026-08-04, mismo criterio que la barra de escritorio). Se
              queda visible aunque se abra el buscador -- si no entra,
              trunca detrás del campo en vez de desaparecer del todo. */}
          <span className={cn('min-w-0 truncate text-[15px] font-bold', navbarClaro ? 'text-white' : 'text-sidebar-foreground')}>{colorNavbarRol ? cargoLabel : nombreMarca}</span>
        </div>
        <div className={cn('flex shrink-0 items-center gap-1', navbarClaro && 'text-white/70')}>
          {colorNavbarRol && (
            busquedaAbierta ? (
              // Buscador todavía no funcional (KAN-74) -- Enter no hace nada
              // (evita el submit del form), Escape cierra y limpia.
              <input
                autoFocus
                type="text"
                value={valorBusqueda}
                onChange={(e) => setValorBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setBusquedaAbierta(false); setValorBusqueda(''); }
                  else if (e.key === 'Enter') e.preventDefault();
                }}
                onBlur={() => { if (!valorBusqueda) setBusquedaAbierta(false); }}
                placeholder="Buscar..."
                title="Buscador todavía no funcional"
                className="h-8 w-36 shrink-0 rounded-lg border border-white/20 bg-white/90 px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
              />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Buscar"
                className={cn('rounded-xl', navbarClaro ? 'text-white hover:bg-white/10' : 'text-sidebar-foreground hover:bg-black/5')}
                onClick={() => setBusquedaAbierta(true)}
              >
                <Search className="h-4.5 w-4.5" />
              </Button>
            )
          )}
          <NotificacionesBell />
        </div>
      </header>

      {/* Drawer mobile */}
      <Sheet open={!esOscuro && menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent
          side="left"
          className={cn('flex w-[270px] flex-col border-none p-0', esOscuro ? 'bg-[#0a0e1a]' : !colorNavbarRol && 'bg-sidebar')}
          style={estiloSidebarColor}
        >
          <SheetHeader className={cn('border-b px-5 py-4', esOscuro ? 'border-white/10' : 'border-sidebar-border')}>
            <SheetTitle className={cn('flex items-center gap-3', esOscuro ? 'text-white' : 'text-sidebar-foreground')}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-navy)]">
                <img src="/logo.png" alt={nombreMarca} className="h-4.5 w-4.5 object-contain brightness-0 invert" />
              </div>
              <span className="text-[15px] font-bold">{nombreMarca}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            <NavLinks onNavigate={() => setMenuAbierto(false)} navItems={navItems} sombreros={sombreros} oscuro={esOscuro} />
          </div>
          <div className={cn('border-t px-3 pt-3', esOscuro ? 'border-white/10' : 'border-sidebar-border')}>
            <SoporteFooter href={mailtoSoporte} correo={CORREO_SOPORTE} onClick={() => setMenuAbierto(false)} oscuro={esOscuro} />
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
            {contextosDisponibles && contextosDisponibles.length > 1 && (
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
      <div className={cn('flex min-w-0 flex-1 flex-col', esOscuro && esPanelAdmin ? 'bg-[#12172a]' : 'bg-muted/30')}>
        {/* Barra superior delgada — solo en desktop; en móvil las acciones de
            cuenta viven en el pie del drawer. */}
        <header
          className={cn(
            'hidden items-center gap-4 border-b px-8 sm:flex',
            colorNavbarRol ? 'h-[52px]' : 'py-1.5',
            esOscuro ? 'border-white/10 bg-[#0a0e1a]' : colorNavbarRol ? 'border-black/10' : 'border-border bg-card'
          )}
          style={estiloNavbarColor}
        >
          <div className="min-w-0 shrink-0">
            {esOscuro ? (
              // El panel de Super Admin es global (gestiona todas las iglesias a
              // la vez) -- elegir "iglesia activa" ahí no filtra nada y solo
              // confunde el flujo de rol (KAN-67), así que no se muestra el
              // selector mientras se actúa como Super Admin. Misma barra oscura
              // del módulo de Estructura Organizacional, solo el color -- el
              // resto de esta barra (campanita, menú de cuenta) queda igual.
              <p className="text-[13px] font-semibold text-white">Administración</p>
            ) : (
              // Antes había acá un selector de iglesia que aparecía para
              // cualquier rol con más de una iglesia asociada (bug: no era un
              // selector "oficial" de nada, solo confundía -- pedido del
              // owner, 2026-08-04). En su lugar, el cargo del rol activo.
              <p className={cn('text-[13px] font-semibold', navbarClaro ? 'text-white' : 'text-foreground')}>{cargoLabel}</p>
            )}
          </div>
          <div className="flex-1" />
          <div className={cn('ml-auto flex items-center gap-1', navbarClaro && 'text-white/70')}>
          {colorNavbarRol && (
            // Buscador todavía no funcional (KAN-74) -- mismo patrón
            // colapsable que en móvil, para "no contaminar la pantalla"
            // (pedido del owner, 2026-08-04): arranca en una lupa, a la
            // izquierda de la campanita, y se despliega al hacer clic.
            busquedaAbierta ? (
              <input
                autoFocus
                type="text"
                value={valorBusqueda}
                onChange={(e) => setValorBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setBusquedaAbierta(false); setValorBusqueda(''); }
                  else if (e.key === 'Enter') e.preventDefault();
                }}
                onBlur={() => { if (!valorBusqueda) setBusquedaAbierta(false); }}
                placeholder="Buscar..."
                title="Buscador todavía no funcional"
                className="h-8 w-48 rounded-lg border border-white/20 bg-white/90 px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
              />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Buscar"
                className={cn('rounded-xl', navbarClaro ? 'text-white hover:bg-white/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                onClick={() => setBusquedaAbierta(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )
          )}
          <NotificacionesBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                'flex min-w-0 max-w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-all',
                navbarClaro
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
              {contextosDisponibles && contextosDisponibles.length > 1 && (
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
