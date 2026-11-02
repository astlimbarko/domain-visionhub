# Apariencia experimental sobre frontend oficial

- Nunca fusionar esta rama a master ni desplegar en producción.
- Mantener los handlers, rutas, roles, validaciones y servicios oficiales. Cambiar solo presentación; no sustituirlos por simulaciones.
- Gonzalo autorizó acciones reales para LIDER_CDP. El transporte permite los servicios oficiales solo con ese contexto activo; los demás roles mantienen la restricción. No ejecutar escrituras reales en pruebas automatizadas; interceptar red.
- No modificar backend/esquema/configuración de Supabase. No guardar credenciales ni claves privadas.
- Verificar login y selector con respuestas interceptadas; el usuario ingresa por sí mismo las credenciales reales.