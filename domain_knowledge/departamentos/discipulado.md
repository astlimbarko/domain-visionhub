# Discipulado

## Descripcion

El departamento de discipulado coordina la formacion espiritual de los creyentes mediante cursos estructurados, retiros espirituales y procesos de envio. Es el area que prepara personas para asumir responsabilidades de liderazgo.

## Cursos de discipulado (7 en orden)

| Orden | Curso | Descripcion |
|-------|-------|-------------|
| 1 | Fundamentos de Vida del Reino | Ensenanza basica sobre fundamentos de la fe y el reino de Dios |
| 2 | Caracter de Cristo 1 | Formacion en el caracter y valores del cristiano (parte 1) |
| 3 | Caracter de Cristo 2 | Formacion en el caracter y valores del cristiano (parte 2) |
| 4 | Familia Feliz | Ensenanza orientada a la vida familiar desde perspectiva cristiana |
| 5 | Poder de Identidades como Hijo | Identidad espiritual del creyente como hijo de Dios |
| 6 | Lideres de Casas de Paz | Preparacion especifica para lideres de casas de paz |
| 7 | Mentores del Reino | Formacion avanzada para mentores de otros creyentes |

Cada curso tiene lecciones con nombre y numero de orden. La cantidad varia: 12, 5 o 10 lecciones segun el curso.

## Inscripcion en cursos

- Una persona se da de alta en un curso con fecha de inicio.
- Se registra fecha de completado al finalizar.
- Puede estar inscripta en un curso a la vez.

## Retiros espirituales

### Retiro del Espiritu Santo

- Evento de un solo dia.
- Requisito: haber terminado el curso "Lideres de Casa de Paz".
- El sistema debe activar esta opcion al finalizar ese curso.
- Permite registro arbitrario para casos especiales (normalmente orden superior).

### Retiro de Mentores

- Evento de un solo dia.
- Requisito: haber terminado el curso "Mentores del Reino".

## Envio como lider de casa de paz

Cuando una persona ha completado el discipulado de lideres:

1. Finaliza el curso "Lideres de Casa de Paz".
2. Asiste al Retiro del Espiritu Santo.
3. Tiene aval del cuerpo pastoral.
4. Se registra la fecha de envio.
5. Se asigna como lider de una casa de paz.

El sistema debe permitir registrar arbitrariamente para casos especiales (orden superior).

### Fecha de ultimo envio

- Se refiere a la ultima vez que la persona recuerda haber sido enviado como lider.
- Podria ser solo una referencia: dia, mes o anio.
- Se usa para personas que fueron enviados pero dejaron el cargo.

## Formacion post-envio

Personas que completaron el envio y avanzan a formacion superior.

| Tipo | Descripcion |
|------|-------------|
| Seminario | Institucion teologica formal |
| Universidad Vino Nuevo | Universidad de la red |

Se registra fecha de inicio y fecha de fin (se actualiza al finalizar).

## Ciclo completo de formacion

```
Cursos de discipulado (1-7)
  |
  +-- Retiro del Espiritu Santo (requiere curso 6)
  |
  +-- Envio como lider de CdP
  |
  +-- Formacion post-envio (Seminario / Universidad)
```

## Documentos relacionados

- [Departamentos](departamentos.md)
- [Operadores](operadores.md)
- [Cargos](../cargos/cargos.md)
