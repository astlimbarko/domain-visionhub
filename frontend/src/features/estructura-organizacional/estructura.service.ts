import { supabase } from '@/services/supabase';
import type {
  CasaDePazEstructura,
  DepartamentoEstructura,
  EstructuraOrganizacionalDatos,
  PersonaEstructura,
  RedEstructura,
} from './types';

interface IglesiaFila {
  id: string;
  nombre: string | null;
  sufijo: string;
  pastor_id: string | null;
  supervisor_id: string | null;
}

interface PersonaFila {
  id: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
}

function nombrePersona(persona: PersonaFila): string {
  return [persona.primer_nombre, persona.segundo_nombre, persona.primer_apellido, persona.segundo_apellido]
    .filter(Boolean)
    .join(' ');
}

export async function obtenerEstructuraOrganizacional(
  iglesiaId: string,
): Promise<EstructuraOrganizacionalDatos> {
  const [iglesiaResultado, departamentosResultado, redesResultado, casasResultado, relacionesResultado] =
    await Promise.all([
      supabase
        .from('iglesia')
        .select('id, nombre, sufijo, pastor_id, supervisor_id')
        .eq('id', iglesiaId)
        .is('fecha_eliminacion', null)
        .single(),
      supabase
        .from('departamento')
        .select('id, codigo, nombre')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_eliminacion', null)
        .order('codigo'),
      supabase
        .from('red')
        .select('id, nombre, color')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_eliminacion', null)
        .order('nombre'),
      supabase
        .from('casa_de_paz')
        .select('id, nombre')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_eliminacion', null)
        .order('nombre'),
      supabase
        .from('casa_de_paz_red')
        .select('casa_de_paz_id, red_id')
        .eq('iglesia_id', iglesiaId)
        .is('fecha_fin', null)
        .is('fecha_eliminacion', null),
    ]);

  const errores = [
    iglesiaResultado.error,
    departamentosResultado.error,
    redesResultado.error,
    casasResultado.error,
    relacionesResultado.error,
  ].filter(Boolean);
  if (errores[0]) throw errores[0];

  const iglesia = iglesiaResultado.data as IglesiaFila;
  const personaIds = [iglesia.pastor_id, iglesia.supervisor_id].filter(
    (id): id is string => Boolean(id),
  );

  let personas = new Map<string, PersonaEstructura>();
  if (personaIds.length > 0) {
    const { data, error } = await supabase
      .from('persona')
      .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido')
      .in('id', personaIds)
      .is('fecha_eliminacion', null);
    if (error) throw error;
    personas = new Map(
      ((data ?? []) as PersonaFila[]).map((persona) => [
        persona.id,
        { id: persona.id, nombre: nombrePersona(persona) },
      ]),
    );
  }

  const redPorCasa = new Map(
    (relacionesResultado.data ?? []).map((relacion) => [relacion.casa_de_paz_id, relacion.red_id]),
  );

  return {
    iglesia: {
      id: iglesia.id,
      nombre: iglesia.nombre ?? iglesia.sufijo,
    },
    pastor: iglesia.pastor_id ? personas.get(iglesia.pastor_id) ?? null : null,
    supervisor: iglesia.supervisor_id ? personas.get(iglesia.supervisor_id) ?? null : null,
    departamentos: (departamentosResultado.data ?? []) as DepartamentoEstructura[],
    redes: (redesResultado.data ?? []) as RedEstructura[],
    casasDePaz: (casasResultado.data ?? []).map((casa) => ({
      id: casa.id,
      nombre: casa.nombre,
      redId: redPorCasa.get(casa.id) ?? null,
    })) as CasaDePazEstructura[],
  };
}
