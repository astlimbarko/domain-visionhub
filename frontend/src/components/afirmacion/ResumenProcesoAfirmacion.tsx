// Resumen en texto plano al pie de cada puerta de Afirmación
// (Altar/Bautismo/RSIL/Membresía): conteos del proceso actual con lo que la
// lista YA trae. El historial no incluye el sexo, así que a propósito NO se
// desglosa por Hombres/Mujeres (ver reporte a la sesión principal). `extra`
// permite sumar una línea propia del proceso (ej. "Con bautizo registrado").
interface Props {
  registros: { fecha: string; registrado_por: string | null }[];
  /** Nombre del proceso, en minúscula para la frase (ej. "Altar", "Membresía"). */
  etiqueta: string;
  extra?: string;
}

export function ResumenProcesoAfirmacion({ registros, etiqueta, extra }: Props) {
  if (registros.length === 0) return null;
  const hoy = new Date().toISOString().slice(0, 10);
  const registradosHoy = registros.filter((r) => r.fecha === hoy).length;
  const colaboradores = new Set(registros.map((r) => r.registrado_por).filter(Boolean)).size;
  return (
    <p className="px-1 pt-1 text-xs leading-relaxed text-muted-foreground">
      Total: <span className="font-semibold text-foreground tabular-nums">{registros.length}</span> persona{registros.length === 1 ? '' : 's'} en {etiqueta}.
      {registradosHoy > 0 && <> Registradas hoy: <span className="font-medium text-foreground tabular-nums">{registradosHoy}</span>.</>}
      {colaboradores > 1 && <> Colaboradores que tomaron datos: <span className="font-medium text-foreground tabular-nums">{colaboradores}</span>.</>}
      {extra && <> {extra}</>}
    </p>
  );
}
