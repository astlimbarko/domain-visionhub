/**
 * Spinner de carga con el logo de la iglesia -- versión "sonar": el sello
 * navy respira suavemente mientras dos anillos se expanden y se desvanecen
 * en cascada, sin borde girando. Pedido del owner, 2026-08-03: reemplazar el
 * spinner de arco anterior por uno "elegante, minimalista y dinámico".
 * Keyframes en index.css (logo-spinner-ping/logo-spinner-breathe).
 */
export function LogoSpinner({ size = 72, className }: { size?: number; className?: string }) {
  const badge = Math.round(size * 0.62);
  const logo = Math.round(size * 0.34);

  return (
    <div className={className} style={{ width: size, height: size }} role="status" aria-label="Cargando">
      <div className="relative flex h-full w-full items-center justify-center">
        <span
          className="absolute rounded-2xl"
          style={{
            width: badge,
            height: badge,
            background: 'var(--chart-1)',
            animation: 'logo-spinner-ping 2.2s cubic-bezier(0.2, 0.7, 0.3, 1) infinite',
          }}
          aria-hidden="true"
        />
        <span
          className="absolute rounded-2xl"
          style={{
            width: badge,
            height: badge,
            background: 'var(--chart-1)',
            animation: 'logo-spinner-ping 2.2s cubic-bezier(0.2, 0.7, 0.3, 1) infinite',
            animationDelay: '1.1s',
          }}
          aria-hidden="true"
        />
        <div
          className="relative flex shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-black/10"
          style={{
            width: badge,
            height: badge,
            background: 'var(--brand-navy)',
            animation: 'logo-spinner-breathe 2.2s ease-in-out infinite',
          }}
        >
          <img
            src="/logo.png"
            alt=""
            className="object-contain brightness-0 invert"
            style={{ width: logo, height: logo }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

/** Pantalla completa (fondo `bg-muted`, mismo que Login) -- para el momento en que se resuelve la sesión/rol antes de mostrar cualquier layout. */
export function AppLoadingScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted">
      <LogoSpinner size={72} />
      <p className="text-[13px] font-medium text-muted-foreground">Cargando...</p>
    </div>
  );
}

/** Versión contenida, para usar dentro de un layout ya montado (ej. Suspense de rutas con lazy loading). */
export function ContenidoCargando() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <LogoSpinner size={56} />
    </div>
  );
}

/**
 * Bug real reportado (2026-08-03): la app se quedaba "cargando" para siempre
 * si el pedido de roles fallaba (sesión vencida, corte de red) -- antes no
 * había forma de distinguir "todavía cargando" de "falló", así que
 * PrivateLayout mostraba el mismo spinner sin salida en ambos casos. Esta
 * pantalla le da al usuario un camino real: reintentar el mismo pedido, o
 * cerrar sesión si el problema es la sesión vencida.
 */
export function AppErrorScreen({ onReintentar, onCerrarSesion }: { onReintentar: () => void; onCerrarSesion: () => void }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-black/10"
        style={{ background: 'var(--brand-navy)' }}
      >
        <img src="/logo.png" alt="" className="h-9 w-9 object-contain brightness-0 invert" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-foreground">No se pudo conectar</p>
        <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
          Revisá tu conexión a internet e intentá de nuevo.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReintentar}
          className="rounded-full bg-[var(--brand-navy)] px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Reintentar
        </button>
        <button
          type="button"
          onClick={onCerrarSesion}
          className="rounded-full border border-border bg-card px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
