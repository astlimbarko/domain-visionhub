# Frontend oficial con apariencia experimental

**Exclusivamente local. Nunca fusionar esta rama a master ni desplegar.**

Base: origin/master, commit 43bdb2e (último despliegue confirmado en la bitácora disponible).
Rama: codex/frontend-adminlte-mui-real. Copia independiente de TailAdmin y de la maqueta AdminLTE/MUI.

## Qué se conserva

App.tsx, rutas, login handlers, validaciones, construcción de sesión, auth store, selector de roles/contextos, dashboard, Reportes.tsx y servicios de negocio provienen del código oficial. No se sustituye el comportamiento por datos ficticios. El primer cambio de presentación es el JSX del login con MUI y un tema visual común claro/oscuro; las demás pantallas se adaptarán gradualmente conservando su código funcional.

## Restricción de esta prueba

El cliente Supabase tiene un filtro de transporte independiente de los servicios. Para el contexto autenticado LIDER_CDP se habilitaron los servicios originales REST/Storage/Functions por autorización de Gonzalo; los permisos oficiales del servidor siguen siendo obligatorios. Para los demás contextos permite autenticación y consultas listadas y bloquea INSERT/UPDATE/DELETE, Edge Functions y subidas. No devuelve éxito ficticio: responde PREVIEW_READ_ONLY y muestra aviso. Esto es una protección frente a escrituras accidentales de esta UI, no sustituye RLS ni es una nueva política de seguridad del servidor.

Iniciar sesión crea una sesión Auth real; el cierre se limita a la sesión local, sin cerrar las sesiones en producción. La sesión del navegador usa una clave propia. La aplicación conserva los controles oficiales de membresía/contraseña temporal: si requieren completar datos, las escrituras correspondientes estarán bloqueadas, sin saltarse el control.

Solo se reutilizan VITE_SUPABASE_URL y la clave pública anon existente, en .env.preview ignorado por Git y excluido de la imagen. Nunca incluir claves secretas, service_role ni credenciales de usuario. No hay migraciones ni cambios de backend.

## Docker

Desde frontend/: docker compose -f compose.preview.yaml up -d --build
Abrir http://127.0.0.1:5178/login
Solo el usuario ingresa sus credenciales. No guardar ni compartir contraseñas en el chat.

El acceso por correo/contraseña mantiene su flujo oficial. Google depende de las redirecciones ya configuradas en Supabase; no se cambian esas opciones durante esta prueba.

Parar solo esta copia: docker compose -f compose.preview.yaml stop
Las otras versiones continúan en 5174 (TailAdmin) y 5177 (maqueta AdminLTE/MUI).
## Actualización autorizada 2026-11-01
El contexto autenticado LIDER_CDP permite acciones reales de los servicios originales (REST/Storage/Functions), sujetas a permisos del servidor. Los demás contextos mantienen la restricción temporal. No probar escrituras contra producción automáticamente; interceptar toda red remota. La sesión conserva su clave aislada y logout local.
