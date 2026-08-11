# Gonzalo — 2026-08-11

- [x] KAN-173: investigado por qué "Usuarios" mostraba "sin persona asociada todavía" en algunas filas — el gate de "completar membresía" chequea si existe Persona en CUALQUIER iglesia, no en la del cargo nuevo, así que una cuenta con ficha en una iglesia nunca la completa de nuevo al recibir un segundo cargo en otra. Fix: opción para cargar nombre/apellido/sexo directo al asignar el cargo desde Administración > Usuarios. Código listo y desplegado, falta probar en vivo (sin navegador MCP esta sesión)
