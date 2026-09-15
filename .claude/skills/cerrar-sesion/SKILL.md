---
name: cerrar-sesion
description: Ejecuta el cierre de sesión de Claude Code en VisionHub -- bitácora, Jira, memoria y estado de git -- en vez de que el usuario tenga que pedirlo a mano cada vez. Invocar con /cerrar-sesion cuando el usuario quiera guardar todo y terminar (o al final de un bloque grande de trabajo).
---

# Cerrar sesión — VisionHub

Este skill ejecuta el checklist de cierre que ya describe `CLAUDE.md` (raíz
del repo) para que no haga falta pedirlo paso a paso cada vez. **Las reglas
completas viven en `CLAUDE.md` — este skill es el disparador que las
ejecuta ahora, no las reemplaza.** Si algo acá contradice `CLAUDE.md`, gana
`CLAUDE.md`.

## Antes de arrancar

Si no quedó claro en la conversación quién está en la sesión (Gonzalo,
Matías o Daniel), preguntá el nombre antes de escribir nada en la
bitácora -- no asumir.

## Pasos, en orden

1. **Repasá la conversación** (no solo el último mensaje) para armar la
   lista real de qué se hizo en esta sesión: tickets tocados, archivos
   editados, migraciones aplicadas, bugs encontrados, deploys hechos,
   decisiones tomadas.

2. **Bitácora** (`bitacora-equipo/YYYY-MM-DD/<nombre>.md`, fecha de HOY):
   - Si la carpeta de hoy no existe, creala.
   - Si el archivo de la persona ya existe (sesión anterior el mismo día),
     agregá al final -- no lo reescribas ni crees un `-2`.
   - Formato checklist, `[x]` completado / `[ ]` pendiente, un ítem =
     una frase corta y concreta (ver ejemplos en `CLAUDE.md`).

3. **Jira** (proyecto KAN): para cada ticket tocado en esta sesión que
   todavía no tenga su comentario de cierre:
   - Comentá qué se hizo (o por qué se bloqueó, si no se pudo avanzar).
   - Movés el estado SOLO si hay trabajo real que lo respalde -- nunca
     "para adelante" solo porque se comentó.
   - Reporter/assignee quedan en Gonzalo por defecto (excepción: tickets
     que solo documentan algo para que otra persona lo implemente después
     -- ahí el assignee queda vacío).
   - Si alguien más del equipo hizo el trabajo real en la sesión, decilo
     explícito en el comentario (el campo de Jira igual va a mostrar a
     Gonzalo).

4. **Memoria persistente** (`C:\Users\Chalo\.claude\projects\D--Mis-Documentos-Proyectos-VisionHub\memory\`):
   - Guardá lo que no sea obvio ni derivable del código/git: decisiones,
     causas raíz encontradas, bloqueos reales, feedback del usuario.
   - Actualizá `MEMORY.md` (el índice) con una línea por memoria nueva o
     tocada -- no dupliques entradas, actualizá la existente si ya cubre
     el tema.

5. **Git**:
   - `git status` -- si hay cambios sin commitear que valga la pena
     guardar, commitealos (preguntá si el alcance no es obvio).
   - Si la rama actual es `master`, hacé checkout a una rama nueva antes
     de terminar (nunca dejar la sesión parada en `master`).
   - No hace falta pushear/mergear si no se te pidió explícitamente --
     alcanza con que quede commiteado localmente, salvo que en la sesión
     ya se venía pusheando/mergeando como parte del flujo normal (deploys,
     etc.), en cuyo caso seguí ese mismo patrón.

6. **Resumen final al usuario**: 3-5 líneas, qué quedó guardado y qué
   sigue pendiente para la próxima sesión. Nada de re-explicar todo lo
   que ya se habló.
