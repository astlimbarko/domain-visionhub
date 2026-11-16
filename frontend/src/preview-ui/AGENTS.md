# Apariencia experimental sobre frontend oficial

- No fusionar esta rama a master ni desplegar. Gonzalo aclaró el 2026-11-15: preparar Front 2 en GitHub para trabajo local de Gonzalo, Matías y Daniel. La futura URL será /v2/ conservando V1 en /. Publicar requiere una nueva indicación explícita.
- Mantener los handlers, rutas, roles, validaciones y servicios oficiales. Cambiar solo presentación; no sustituirlos por simulaciones.
- Gonzalo autorizó acciones reales para LIDER_CDP. El transporte permite los servicios oficiales solo con ese contexto activo; los demás roles mantienen la restricción. No ejecutar escrituras reales en pruebas automatizadas; interceptar red.
- No modificar backend/esquema/configuración de Supabase. No guardar credenciales ni claves privadas.
- Verificar login y selector con respuestas interceptadas; el usuario ingresa por sí mismo las credenciales reales.

- Leer harness/FRONT-2.md y el AGENTS.md de la raíz para continuar la migración por roles, con CSS aislado y prioridad móvil/tablet/PC.
