# Gonzalo — 2026-09-09

- [x] Diagnostiqué la demora reportada en fotos (perfil + anuncios): no era el peso del archivo (93KB/6.7KB, comprensión OK), era 2 viajes de red en cadena por signed URL + CDN siempre en MISS por el token único (KAN-354)
- [x] Cambié `persona-foto.service.ts` y `anuncio.service.ts` a `.download()`, corta a la mitad los pedidos de red y deja la URL cacheable
- [x] Verificado en vivo con Playwright contra Supabase real: recarga de la misma imagen bajó a 16ms
- [x] Modal de anuncios: precarga silenciosa (no muestra spinner, aparece ya cargado) -- verificado en vivo
- [x] Panel de gestión de anuncios: miniatura real 140px (antes cargaba la imagen completa para el thumbnail) -- migración aplicada a producción, verificado en vivo con anuncio de prueba (subida, listado, borrado de ambos archivos)
- [x] KAN-339 (delegado a Magnus): Super Admin solo lectura + Pastor/Supervisor control total en Afirmación/Evangelismo -- backend aplicado a producción (12 RPC lectura + 2 escritura + 1 policy), menú de 3 puntos "Visualizar" en el Constructor (tarjeta + panel lateral), banner "Modo lectura", nav de Pastor/Supervisor con Afirmación agregada. Verificado en vivo como Pastor (Playwright). Jira en "En revisión".
- [ ] Falta: verificar en vivo el flujo de Super Admin (`test@somoscdv.com` perdió ese rol el 2026-08-11, sin otra cuenta con clave a mano) -- hace falta reactivarle el rol desde la app o probarlo con una cuenta Super Admin real
