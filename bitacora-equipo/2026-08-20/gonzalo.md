# Gonzalo — 2026-08-20

- [x] Pull de `master` (PR #32 de Matías, KAN-211/212: code-splitting de Vite + logo comprimido + fix de refresco del Constructor)
- [x] Borradas ramas viejas ya mergeadas (`feature/sistema-anuncios`, `generales`); creada `feature/membresia`
- [x] Análisis del panel de Afirmación (URLs de CdP, formulario de membresía, censo de cargos) — pendiente definir plan de implementación de las partes nuevas (indicador URL vs formulario, tabla de personas, rediseño visual de Casas de Paz, censo de cargos)
- [x] Bug real encontrado y corregido (KAN-213): persona con nombre/apellido vacío marcada como membresía completada (cuenta de prueba test@somoscdv.com) rompía el navbar y el panel Casas de Paz de Afirmación. Trigger de `persona` ahora rechaza nombre/apellido vacíos; `fn_mi_membresia_incompleta` ya no confía solo en la bandera — vuelve a pedir el formulario si el nombre está vacío. Verificado en vivo.
- [x] Confirmado: Supabase Storage de anuncios ya estaba implementado desde KAN-101 (nunca estuvo en el hosting); KAN-210 (Storage para fotos de perfil) es algo distinto y sigue pendiente
- [ ] Falta: plan de implementación completo del panel de Afirmación (puntos 7, 8, 11, 12 del pedido) para aprobación antes de codear
