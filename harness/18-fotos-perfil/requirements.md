# Fotos de perfil — Requisitos

Cubre 3 tickets de Jira que se implementan juntos porque tienen dependencias
formales entre sí: **KAN-207** (compresor reusable), **KAN-210** (Storage +
políticas), **KAN-209** (recorte + UI de avatar). Pedido explícito del owner,
2026-09-08: "necesitamos tener el código compresor del front para no subir
archivos gigantes" + habilitar foto de perfil para todos los usuarios +
habilitar Supabase Storage por completo para eso.

Referencia ya funcionando en el propio repo: el sistema de anuncios
(`anuncio.service.ts`, KAN-101-110, ya en producción) usa Supabase Storage
con bucket privado + URLs firmadas + política RLS en `storage.objects` —
mismo patrón general a replicar acá, con reglas de acceso más finas (por
persona, no por iglesia entera).

## KAN-207 — Compresor de imágenes en el front

- THE sistema SHALL exponer una función reusable que reciba un `File`/`Blob`
  de imagen y devuelva un JPG comprimido.
- WHEN se le pasa una imagen de cualquier tamaño/formato soportado (JPG,
  PNG, WEBP) THEN THE función SHALL devolver un JPG de calidad 80%.
- WHEN se le pasa un ancho/alto destino (ej. 250x250 para avatar) THEN THE
  función SHALL redimensionar a esas dimensiones exactas antes de comprimir.
- THE función SHALL ser la misma para anuncios y fotos de perfil (no
  duplicar lógica de compresión en 2 lugares).
- IF la imagen de entrada ya es más chica que el destino THEN THE función
  SHALL evitar "estirarla" con pérdida de calidad innecesaria (a decidir en
  diseño técnico: puede rechazarse o aceptarse con upscale, ver
  `open-questions.md`).

## KAN-210 — Supabase Storage para fotos de perfil

- THE sistema SHALL tener un bucket privado dedicado a fotos de perfil,
  separado del bucket de anuncios.
- THE sistema SHALL usar una ruta estable por persona que evite colisiones
  entre iglesias (ej. `{iglesiaId}/{personaId}.jpg`).
- WHEN un usuario autorizado a EDITAR una persona sube/reemplaza/borra su
  foto THEN THE política de Storage SHALL permitirlo.
- WHEN un usuario autorizado a VER una persona pide su foto THEN THE
  política de Storage SHALL permitir la lectura (vía URL firmada).
- IF un usuario no tiene permiso para ver/editar esa persona THEN THE
  política de Storage SHALL denegar el acceso, incluso con la ruta exacta.
- THE sistema SHALL guardar en la tabla `persona` una referencia estable
  (path), NUNCA una URL firmada (expira).
- WHEN se reemplaza una foto THEN THE sistema SHALL evitar dejar el archivo
  anterior huérfano cuando sea seguro borrarlo.

## KAN-209 — Recorte + avatar en todos los perfiles

- WHEN un usuario autorizado selecciona una imagen para su foto de perfil
  (o la de una persona que puede editar) THEN THE frontend SHALL abrir un
  editor de recorte 1:1 con mover + zoom.
- WHEN el usuario confirma el recorte THEN THE frontend SHALL generar una
  imagen final de 250x250 px.
- THE frontend SHALL pasar esa imagen 250x250 por el compresor de KAN-207
  antes de subir nada.
- THE frontend SHALL subir únicamente el archivo ya recortado+comprimido,
  nunca la imagen original.
- WHERE el sistema ya representa visualmente a una persona (avatar/ficha)
  THE aplicación SHALL mostrar la foto si existe, o el fallback de iniciales
  actual (`AvatarIniciales`) si no existe.
- THE usuario autorizado SHALL poder quitar/restablecer la foto (vuelve a
  iniciales).
- THE flujo SHALL funcionar en escritorio, tablet y móvil.

## Fuera de alcance (explícito)

- Recortes no-cuadrados o múltiples tamaños de salida (solo 250x250 por
  ahora).
- Galería de fotos históricas -- solo la foto de perfil actual.
- Moderación de contenido de la imagen subida.
