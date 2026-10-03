# Daniel — 2026-10-03

- [x] Investigué KAN-497 (bautizado aparece duplicado en Membresía) y encontré la causa real: Bautismo creaba membresía de Casa de Paz al registrar, sin pasar por el formulario de membresía
- [x] 13 tareas resueltas en el mismo flujo (trabajadas una por una con autorización explícita, 3 con agentes en paralelo cuando no había riesgo de choque de archivos):
  1. Aclarado "es miembro" = `membresia_completada`
  2. Bautismo ya no crea membresía, solo marca bautizado
  3. Fix del spinner de autoguardado que quedaba colgado
  4. Botón "X" para quitar la persona elegida por error en Membresía
  5. CI obligatorio + "no lo recuerda", fecha obligatoria, ocupación opcional, texto renombrado
  6. Búsqueda de Casa de Paz por dirección/ciudad
  7. Pestañas "Nuevo"/"Registro" en el formulario de membresía
  8. Pestaña "Registro" en Afirmación › Membresía + "Miembros" solo muestra membresía completada
  9. Editar persona desde la ficha en Datos/Registro de los 4 módulos (Opción B, sin ampliar permisos generales)
  10. Altar: registrar pasó a ser un solo paso (agente)
  11. Buscador propio por módulo en cada pestaña Datos/Registro
  12. Búsqueda inteligente de duplicados (nombre + teléfono + sexo + CI) en los 4 módulos (agente + completado a mano en Altar)
  13. Auditoría SaaS: 3 hallazgos de "Centro de Vida" hardcodeado (logo, nombre de respaldo, dominio de correo) -- reportado, no corregido (agente)
- [x] `npx tsc -b` y `npm run lint` limpios en todo
- [x] Instalé y logueé GitHub CLI (`gh`) en esta máquina (cuenta DanielMorales21)
- [x] Commit + push + PR abierto: https://github.com/astlimbarko/domain-visionhub/pull/150
- [x] Jira KAN-497: comentado con el detalle completo y movido a "En revisión"
- [x] Levanté el contenedor Docker del frontend (`docker compose up`, responde en localhost:5174) -- sin `.env` real todavía, el login no funciona
- [ ] Falta: la clave anónima de Supabase (o el token de Gonzalo) para poder loguearse y verificar todo en vivo
- [ ] Falta: aplicar las 9 migraciones nuevas de hoy (`supabase/migrations/20261003*`)
- [ ] Falta: decidir qué hacer con los 3 hallazgos de la auditoría SaaS (paso 13)
