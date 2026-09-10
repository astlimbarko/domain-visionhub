// KAN-252: lista corta y curada (no una librería de +200 países) porque las
// iglesias de este sistema son todas de Bolivia y países vecinos -- Bolivia
// por defecto. Compartida entre MembresiaObligatoria y ActualizacionMembresiaModal.
export const PAISES_TELEFONO = [
  { codigo: '+591', nombre: 'Bolivia', iso: 'bo' },
  { codigo: '+54', nombre: 'Argentina', iso: 'ar' },
  { codigo: '+55', nombre: 'Brasil', iso: 'br' },
  { codigo: '+56', nombre: 'Chile', iso: 'cl' },
  { codigo: '+57', nombre: 'Colombia', iso: 'co' },
  { codigo: '+51', nombre: 'Perú', iso: 'pe' },
  { codigo: '+595', nombre: 'Paraguay', iso: 'py' },
  { codigo: '+598', nombre: 'Uruguay', iso: 'uy' },
  { codigo: '+52', nombre: 'México', iso: 'mx' },
  { codigo: '+34', nombre: 'España', iso: 'es' },
  { codigo: '+1', nombre: 'Estados Unidos', iso: 'us' },
] as const;

// Arma el teléfono final (prefijo país + número, solo dígitos) para el
// payload de los flujos de alta de Membresía. Devuelve undefined si no se
// escribió número -- así el backend distingue "sin celular" de un número
// real. Compartido por FormularioMembresiaPublico y RegistrarPersonaAfirmacion.
export function componerTelefono(pais: string | undefined, numero: string | undefined): string | undefined {
  const soloDigitos = (numero ?? '').replace(/\D/g, '');
  if (!soloDigitos) return undefined;
  return `${pais || '+591'}${soloDigitos}`;
}

// Descompone un teléfono E.164 (ej. "+59178995221") en código de país +
// número nacional, para mostrarlo distinto según el país (Bolivia oculta el
// código -- es el caso obvio/default de este sistema -- cualquier otro país
// sí lo muestra, porque ahí es información real que no se puede asumir).
// Prueba los códigos de más dígitos primero (+595/+598 antes que +59... no
// existe, pero +591 antes que +51 sí importa) para no matchear de más.
// Si el número no matchea ningún código conocido, vuelve `pais: null` --
// quien llame decide el fallback (mostrarlo entero, achicar la fuente, etc).
export function desglosarTelefono(telefono: string): { pais: (typeof PAISES_TELEFONO)[number] | null; numero: string } {
  const ordenados = [...PAISES_TELEFONO].sort((a, b) => b.codigo.length - a.codigo.length);
  for (const pais of ordenados) {
    if (telefono.startsWith(pais.codigo)) {
      return { pais, numero: telefono.slice(pais.codigo.length) };
    }
  }
  return { pais: null, numero: telefono };
}
