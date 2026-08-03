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
