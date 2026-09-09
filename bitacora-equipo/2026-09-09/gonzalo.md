# Gonzalo — 2026-09-09

- [x] Diagnostiqué la demora reportada en fotos (perfil + anuncios): no era el peso del archivo (93KB/6.7KB, comprensión OK), era 2 viajes de red en cadena por signed URL + CDN siempre en MISS por el token único (KAN-354)
- [x] Cambié `persona-foto.service.ts` y `anuncio.service.ts` a `.download()`, corta a la mitad los pedidos de red y deja la URL cacheable
- [x] Verificado en vivo con Playwright contra Supabase real: recarga de la misma imagen bajó a 16ms
- [x] Modal de anuncios: precarga silenciosa (no muestra spinner, aparece ya cargado) -- verificado en vivo
- [x] Panel de gestión de anuncios: miniatura real 140px (antes cargaba la imagen completa para el thumbnail) -- migración aplicada a producción, verificado en vivo con anuncio de prueba (subida, listado, borrado de ambos archivos)
