# Gonzalo — 2026-08-21

- [x] KAN-218: cooldown de OTP bajado de 120s a 60s (estándar de la industria)
- [x] KAN-219: correo de confirmación al completar el formulario de membresía (URL pública, Afirmación interno, MembresiaObligatoria) — nueva Edge Function + RPC, verificado en vivo con correo real
- [x] KAN-220: navbar — el menú de cuenta ya no repite el rol del panel, solo el nombre (un solo componente compartido, aplica a todos los roles)
- [x] Probado en vivo el registro por URL de Casa de Paz completo (/registro/freddy-aramayo) — funciona bien, ya se abre y navega directo
- [x] KAN-221: fix real, el mensaje final del registro por URL decía "quedó registrado en ." vacío (usaba nombre crudo de CdP en vez de fn_etiqueta_cdp)
- [x] KAN-222: formulario interno de Afirmación ahora muestra la Red al elegir el líder de CdP (antes solo el público la mostraba)
- [x] KAN-223: rediseño visual de "URL de membresía" (se veía pálido) + botón "Abrir" para probar el enlace directo
- [x] KAN-224: tabla de Personas — click en fila abre la ficha completa (reusa FichaPersonaSheet), paginación a 50, Sexo ordenable, exportar a CSV, KPIs ampliados a 9 indicadores (hombres/mujeres, por estado)
- [x] KAN-225: bug real encontrado y corregido — fn_listar_redes fallaba ("relation red does not exist") por una función anidada (fn_redes_incompletas) sin calificar sus tablas; afectaba también a Gestión de Redes en otros roles
