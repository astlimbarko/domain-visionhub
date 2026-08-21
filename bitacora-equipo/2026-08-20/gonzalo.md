# Gonzalo — 2026-08-20

- [x] Pull de `master` (PR #32 de Matías, KAN-211/212: code-splitting de Vite + logo comprimido + fix de refresco del Constructor)
- [x] Borradas ramas viejas ya mergeadas (`feature/sistema-anuncios`, `generales`); creada `feature/membresia`
- [x] Análisis del panel de Afirmación (URLs de CdP, formulario de membresía, censo de cargos) — pendiente definir plan de implementación de las partes nuevas (indicador URL vs formulario, tabla de personas, rediseño visual de Casas de Paz, censo de cargos)
- [x] Bug real encontrado y corregido (KAN-213): persona con nombre/apellido vacío marcada como membresía completada (cuenta de prueba test@somoscdv.com) rompía el navbar y el panel Casas de Paz de Afirmación. Trigger de `persona` ahora rechaza nombre/apellido vacíos; `fn_mi_membresia_incompleta` ya no confía solo en la bandera — vuelve a pedir el formulario si el nombre está vacío. Verificado en vivo.
- [x] Confirmado: Supabase Storage de anuncios ya estaba implementado desde KAN-101 (nunca estuvo en el hosting); KAN-210 (Storage para fotos de perfil) es algo distinto y sigue pendiente
- [x] Plan de implementación del panel de Afirmación aprobado y completado (4/4), todo en `feature/membresia`:
  - [x] KAN-214: indicador de personas registradas por URL vs. formulario interno (2 tiles nuevos en el dashboard)
  - [x] KAN-215: rediseño visual de "Casas de Paz" (TarjetaHeader + color, antes se veía pálido)
  - [x] KAN-216: tabla `/afirmacion-personas` con KPIs y búsqueda/orden — de paso encontré y corregí 2 bugs reales más de KAN-213 (guardado de membresía bloqueado al reabrir una persona con nombre vacío)
  - [x] KAN-217: censo de cargos (Efesio, Ministro/Anciano/Diácono/Mentor/Sub mentor/Líder-Sublíder CdPz, Discípulo/Afirmado/Creyente) en el formulario de membresía compartido, tabla nueva puramente informativa, sin tocar cargos operativos reales
- [ ] Pendiente anotado para después (pedido explícito): revisar el cooldown de OTP (hoy 120s, se siente muy restrictivo)
- [ ] Pendiente: Supabase Storage para fotos de perfil (KAN-210) + compresor de imágenes (KAN-207), al final de todo lo anterior
