function luminanciaRelativa(hex: string): number {
  const limpio = hex.replace('#', '');
  const canal = (valor: number) => {
    const c = valor / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = canal(parseInt(limpio.slice(0, 2), 16) || 0);
  const g = canal(parseInt(limpio.slice(2, 4), 16) || 0);
  const b = canal(parseInt(limpio.slice(4, 6), 16) || 0);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** REQ-RED-3: contraste legible calculado sobre el color real, sin ensuciarlo. */
export function textoLegibleSobre(hex: string): string {
  const luminancia = luminanciaRelativa(hex);
  const contrasteBlanco = 1.05 / (luminancia + 0.05);
  const contrasteNegro = (luminancia + 0.05) / 0.05;
  return contrasteBlanco >= contrasteNegro ? '#ffffff' : '#0f172a';
}
