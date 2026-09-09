# Fotos de perfil — Preguntas abiertas

- **¿Qué pasa si la imagen de origen es más chica que 250x250?** ¿se
  permite ampliarla (upscale, pierde nitidez) o se rechaza con un mensaje
  pidiendo una foto más grande? No decidido.
- **Límite de tamaño de archivo de ENTRADA** (antes de comprimir) para la
  foto de perfil -- anuncios usa 5MB. ¿Mismo límite, o uno más chico ya
  que el destino final es mucho más liviano (una sola cara, 250x250)?
- **Librería de recorte 1:1 con zoom**: se propone `react-easy-crop` en
  `technical-design.md` por ser la opción estándar más liviana, pero es
  una dependencia nueva -- confirmar con el owner antes de instalar
  (o evaluar alternativa sin dependencia si prefiere no agregar paquetes).
