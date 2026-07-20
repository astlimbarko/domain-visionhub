export function ProximamentePlaceholder({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="glass-card flex flex-col items-center justify-center gap-4 rounded-2xl py-20">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground">{titulo}</h2>
        <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">{descripcion}</p>
      </div>
    </div>
  );
}
