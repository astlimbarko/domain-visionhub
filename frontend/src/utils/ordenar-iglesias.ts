import type { IglesiaAccesible } from '@/types/auth.types';

/** KAN-442: orden "madre arriba" dentro del conjunto de iglesias accesibles
 * de la cuenta -- topológico simple. Una iglesia cuyo padre no está en el
 * conjunto visible (o no tiene padre) es una raíz y va primero; cada
 * satélite se ubica inmediatamente después de su madre, recursivo por si
 * hay más de un nivel (nieta de una madre). La jerarquía real no tiene
 * ciclos (constraint de la base), así que no hace falta protección extra. */
export function ordenarIglesiasPorJerarquia(iglesias: IglesiaAccesible[]): IglesiaAccesible[] {
  const porId = new Map(iglesias.map((i) => [i.id, i]));
  const hijasDe = new Map<string, IglesiaAccesible[]>();
  const raices: IglesiaAccesible[] = [];

  for (const iglesia of iglesias) {
    const padreVisible = iglesia.iglesia_padre_id && porId.has(iglesia.iglesia_padre_id);
    if (padreVisible) {
      const lista = hijasDe.get(iglesia.iglesia_padre_id as string) ?? [];
      lista.push(iglesia);
      hijasDe.set(iglesia.iglesia_padre_id as string, lista);
    } else {
      raices.push(iglesia);
    }
  }

  const resultado: IglesiaAccesible[] = [];
  function visitar(iglesia: IglesiaAccesible) {
    resultado.push(iglesia);
    for (const hija of hijasDe.get(iglesia.id) ?? []) visitar(hija);
  }
  for (const raiz of raices) visitar(raiz);
  return resultado;
}
