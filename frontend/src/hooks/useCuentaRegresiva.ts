import { useEffect, useState } from 'react';

/** KAN-405: cuenta regresiva en vivo contra una fecha_fin ISO. Recalcula
 * cada segundo -- el corte real de acceso lo decide siempre el backend
 * (fecha_fin > now() en cada chequeo de permiso), esto es solo la UI. */
export function useCuentaRegresiva(fechaFinIso: string | null | undefined) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!fechaFinIso) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [fechaFinIso]);

  if (!fechaFinIso) {
    return { segundosRestantes: 0, texto: '00:00', vencido: true };
  }

  const fin = new Date(fechaFinIso).getTime();
  const segundosRestantes = Math.max(0, Math.floor((fin - ahora) / 1000));
  const vencido = segundosRestantes <= 0;

  const horas = Math.floor(segundosRestantes / 3600);
  const minutos = Math.floor((segundosRestantes % 3600) / 60);
  const segundos = segundosRestantes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const texto = horas > 0 ? `${pad(horas)}:${pad(minutos)}:${pad(segundos)}` : `${pad(minutos)}:${pad(segundos)}`;

  return { segundosRestantes, texto, vencido };
}
