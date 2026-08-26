# Gonzalo — 2026-08-26

- [x] Probado en vivo el asistente de Membresía hasta el paso 9/10 con cuenta real de prueba
- [x] KAN-261 (nuevo, crítico): el asistente fallaba en silencio al finalizar si un dato de una página anterior quedaba inválido (ej. CI/fecha de nacimiento de un borrador viejo) -- ahora avisa qué falta y vuelve a esa página automáticamente
- [x] KAN-258: corregido el desborde visual de la página 7 -- el diálogo ahora tiene scroll interno acotado, título y botones Atrás/Siguiente/Saltar quedan siempre visibles
- [x] KAN-257 (extensión): "Posición en la iglesia" ahora tiene "Ninguno" explícito y obligatorio, igual que Discipulados/Seminario
- [x] KAN-262 (nuevo): separadas "Familia" y "Ministerios" en 2 páginas -- juntas se hacían muy largas con varios familiares
- [x] Probé yo mismo en el navegador los 4 fixes con la cuenta real trabada -- encontré un SEGUNDO bug real más grave: el envío final pisaba CI/fecha de nacimiento con datos viejos (el estado de Discipulados/Ministerios se sembraba con el mismo blob que traía identidad, y se mandaba completo). Corregido de raíz (commit `a7e349c`)
- [x] Verificado en vivo de punta a punta: asistente completo (10 páginas), membresía marcada completada=true con los datos correctos
- [x] KAN-253, KAN-256, KAN-257, KAN-258, KAN-261, KAN-262 confirmados en vivo y pasados a Finalizada en Jira
- [ ] Pendiente de antes: KAN-259 (probar en móvil), KAN-260 (encabezado no actualiza el nombre), Parte B en navegador, Mi Cuenta con pestañas

## Nueva sesión: KAN-263, reenviar invitación

- [x] Revisado el código de invitaciones (invitacion_lider, invitar-lider, invitar-usuario) a pedido del owner (capturas ent1.png/ent2.png): confirmado que "Reenviar" no aparece para un Líder de CdP con cuenta ya creada pero membresía sin terminar
- [x] KAN-263 creado: el "Reenviar" existente solo mira invitacion_lider.estado=PENDIENTE, que desde KAN-252 pasa a COMPLETADA en el primer login aunque la persona nunca termine el formulario -- y Pastor/Supervisor nunca tuvo reenvío en ningún escenario
- [x] Implementado en rama `kan-reenviar-invitacion`: 4 RPC nuevas + fn_listar_usuarios con membresia_completada, Edge Function reenviar-invitacion-cargo (reenvía el invite de Supabase si la cuenta nunca se confirmó, o un recordatorio propio por Brevo si ya se confirmó pero la membresía sigue incompleta), botón "Reenviar" compacto en los 4 paneles del Constructor
- [x] tsc + build del frontend OK. Rama pusheada, commit hecho, KAN-263 en "En revisión"
- [x] Migración SQL aplicada a producción y Edge Function reenviar-invitacion-cargo desplegada (Gonzalo pasó el token de Supabase) -- verificado que las 5 funciones nuevas existen en la base real. Cambio aditivo, sin tocar nada usado por el front que ya está en producción
- [x] Rediseño a pedido: "Reenviar" pasó de renglón de texto a un segundo botón junto a "Cambiar"/"Asignar" (los 4 paneles) -- el owner lo pidió así al ver que no se notaba
- [ ] Falta: mergear `kan-reenviar-invitacion`, desplegar el front nuevo, y probar el botón en vivo antes de pasar KAN-263 a Finalizada
- [x] KAN-264 (normalizar mayúsculas/minúsculas del nombre al escribirse en el formulario) y KAN-265 (corregir los nombres ya cargados en la base) creados a pedido, relacionados entre sí -- solo documentados, sin implementar todavía ("lo haremos más adelante")
