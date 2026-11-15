# Apariencia experimental sobre frontend oficial

- No fusionar esta rama a master ni desplegar. Gonzalo aclarÛ el 2026-11-15: preparar Front 2 en GitHub para trabajo local de Gonzalo, MatÌas y Daniel. La futura URL ser· /v2/ conservando V1 en /. Publicar requiere una nueva indicaciÛn explÌcita.
- Mantener los handlers, rutas, roles, validaciones y servicios oficiales. Cambiar solo presentaci√≥n; no sustituirlos por simulaciones.
- Gonzalo autoriz√≥ acciones reales para LIDER_CDP. El transporte permite los servicios oficiales solo con ese contexto activo; los dem√°s roles mantienen la restricci√≥n. No ejecutar escrituras reales en pruebas automatizadas; interceptar red.
- No modificar backend/esquema/configuraci√≥n de Supabase. No guardar credenciales ni claves privadas.
- Verificar login y selector con respuestas interceptadas; el usuario ingresa por s√≠ mismo las credenciales reales.
