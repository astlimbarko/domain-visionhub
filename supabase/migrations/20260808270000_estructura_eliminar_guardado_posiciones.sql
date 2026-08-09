-- VisionHub -- 20260808270000_estructura_eliminar_guardado_posiciones.sql
-- KAN-96: se quitó del front la función de mover libremente los nodos del
-- lienzo de Estructura Organizacional ("Modo organizar"): el lienzo tiene
-- nodesDraggable={false} y el hook useGuardarPosicionesEstructura /
-- guardarPosicionesEstructura (frontend/src/features/estructura-organizacional/)
-- no se invoca desde ningún componente real -- confirmado por grep, cero
-- imports fuera de su propio archivo de definición.
--
-- OJO -- esta migración NO borra la tabla estructura_nodo_posicion ni sus
-- policies/triggers, a pesar de que el ticket original lo sugería como
-- alcance posible. Se verificó (2026-08-08) que la LECTURA de esa tabla
-- SIGUE activa y en uso real: estructura.service.ts (líneas ~134-138) hace
-- `select nodo_clave, posicion_x, posicion_y from estructura_nodo_posicion`
-- para poblar `layout.posiciones`, que el lienzo consume para respetar
-- posiciones históricas guardadas antes de que se desactivara el drag.
-- Borrar la tabla completa rompería esa lectura activa. Coincide con el
-- título real del ticket ("quitar guardado de posiciones", no "quitar
-- tabla") y con el comentario previo de Matías en KAN-96 (id 10094).
--
-- Lo único confirmado 100% muerto es el camino de ESCRITURA: el RPC
-- fn_estructura_guardar_posiciones (creado en
-- 20260805155929_estructura_organigrama_cimientos.sql) y su contraparte de
-- frontend. Este archivo elimina solo ese RPC.
--
-- IMPORTANTE: esta migración todavía NO fue aplicada contra Supabase real.
-- Queda commiteada en el repo para que alguien con acceso la revise y la
-- corra a mano cuando corresponda.

begin;

drop function if exists public.fn_estructura_guardar_posiciones(uuid, jsonb, bigint);

commit;
