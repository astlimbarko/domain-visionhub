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
