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

/**
 * REQ-RED-3: texto legible sobre un fondo de color (Red/Departamento).
 *
 * Antes comparaba matematicamente el contraste de blanco vs negro y elegia
 * el mayor -- eso hacia que colores medios-saturados (verde esmeralda, rojo,
 * gris medio) eligieran texto negro solo porque ganaba por un margen chico,
 * aunque visualmente lean como una tarjeta de color "solida" que en el resto
 * del sistema (badges, chips) siempre lleva texto blanco (bug real reportado
 * por el owner, 2026-08-07: "Vida Nueva", Discipulado y Envio se veian con
 * texto oscuro sobre su color, no contrastaba bien igual que pintan las
 * demas tarjetas). Criterio mas simple y consistente: texto blanco salvo que
 * el fondo sea realmente claro (umbral de luminancia 0.4 -- separa colores
 * pasteles/amarillos, que si necesitan texto oscuro, del resto).
 */
export function textoLegibleSobre(hex: string): string {
  const luminancia = luminanciaRelativa(hex);
  return luminancia > 0.4 ? '#0f172a' : '#ffffff';
}

function contrasteConBlanco(hex: string): number {
  return 1.05 / (luminanciaRelativa(hex) + 0.05);
}

function mezclarHaciaNegro(hex: string, cantidad: number): string {
  const limpio = hex.replace('#', '');
  const canal = (indice: number) => parseInt(limpio.slice(indice, indice + 2), 16) || 0;
  const mezclar = (valor: number) => Math.round(valor * (1 - cantidad));
  return `#${[canal(0), canal(2), canal(4)].map((valor) => mezclar(valor).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Un color de Red/CdP se elige libremente (paleta o hex picker) y puede ser
 * demasiado claro para usarse como texto/borde sobre fondo blanco (ej.
 * amarillo -- bug real encontrado 2026-08-07 en el boton "+ Nueva Casa de
 * Paz"). Oscurece el color lo minimo necesario hasta cumplir 4.5:1 contra
 * blanco, sin tocar colores que ya son legibles tal cual.
 */
export function colorLegibleSobreBlanco(hex: string): string {
  let resultado = hex;
  for (let intento = 1; intento <= 9 && contrasteConBlanco(resultado) < 4.5; intento++) {
    resultado = mezclarHaciaNegro(hex, intento * 0.1);
  }
  return resultado;
}
