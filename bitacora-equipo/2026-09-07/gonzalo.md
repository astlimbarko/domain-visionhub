# Gonzalo — 2026-09-07

- [x] Auditoría de mobile del Departamento de Evangelismo (viewport real 360-390px) -- 4 falencias reales encontradas
- [x] Fix: tabla de "Personas evangelizadas" (min-w-900px, scroll horizontal) -- lista de tarjetas nueva solo en mobile, tabla intacta en tablet/desktop
- [x] Fix: eje X de "Tendencia" con etiquetas superpuestas en Semana/Mes -- ahora Recharts decide cuántas entran según el ancho real
- [x] Fix: encabezados de días del calendario pegados entre sí en pantallas angostas
- [x] Fix: rango de fechas Desde/Hasta podía desbordar en teléfonos angostos
- [x] Rama nueva `fix/evangelismo-mobile-falencias` (no se reutilizó ninguna existente)
- [x] Ronda de ajustes visuales pedidos viendo el panel en vivo: banner (imagen anclada a la izquierda), tarjetas KPI desiguales en altura, explicación de "Avance", color "hueso" de los headers subido de contraste (8% -> 16%), "Semana N" partido en 2 líneas, título de navbar acortado a "Dpto. de Evangelismo"
- [x] Bug real encontrado y corregido: modal "Asignar metas" dejaba ver un manchón de color de las tarjetas KPI detrás (bg-popover/95 -> /98, componente compartido de toda la app)
- [x] Fix aparte: Login.tsx mostraba siempre "credenciales incorrectas" pase lo que pase (contraseña mal, red caída, lo que sea) -- ahora muestra el error real
- [x] Rediseño de la tarjeta mobile de "Personas evangelizadas" (2da vuelta, viendo la 1ra versión en vivo): arriba nombre en negrita + fecha + teléfono como botón de WhatsApp (wa.me), abajo contraído por defecto Red/Casa de Paz/Domicilio/Evangelizado por/Tipo (chip de color) -- se despliega al tocar, solo una tarjeta abierta a la vez (acordeón). Avatar coloreado por tipo de evangelismo.
- [x] Todo verificado en vivo con Playwright (viewport móvil real y desktop), 6 commits en la rama, `tsc -b` limpio en cada uno
- [x] Jira KAN-347 creado y actualizado, cubre todo este bloque -- "En revisión" (falta merge a master + deploy, no "Finalizada" todavía)
- [x] Rama `fix/evangelismo-mobile-falencias` pusheada a origin (6 commits) -- **sin mergear todavía**, falta aprobación del owner
- [ ] Pendiente: KAN-348 (login por IP LAN desde el celular sigue fallando con "Invalid login credentials" real de Supabase, no era red/CORS) -- sin resolver, falta probar copiar/pegar la contraseña
- [ ] Pendiente (para más adelante, NO ahora): llevar estos mismos patrones visuales (banner, KPI, hueso, navbar corto) al Departamento de Afirmación
- [ ] Pendiente: verificar la tarjeta expandida de "Personas evangelizadas" con un registro que tenga TODOS los campos llenos a la vez (Red+CdP+Domicilio+Teléfono+Evangelizado por+Tipo) -- no se probó ese caso, ningún dato de prueba los tenía todos juntos
