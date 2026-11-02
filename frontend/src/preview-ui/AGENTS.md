# Apariencia experimental sobre frontend oficial

- Nunca fusionar esta rama a master ni desplegar en producción.
- Mantener los handlers, rutas, roles, validaciones y servicios oficiales. Cambiar solo presentación; no sustituirlos por simulaciones.
- El filtro read-only-fetch es una restricción temporal de transporte para la prueba: no desactivarlo ni agregar escrituras sin autorización expresa.
- No modificar backend/esquema/configuración de Supabase. No guardar credenciales ni claves privadas.
- Verificar login y selector con respuestas interceptadas; el usuario ingresa por sí mismo las credenciales reales.