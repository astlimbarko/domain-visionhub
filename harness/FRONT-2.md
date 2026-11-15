# Front 2 — trabajo local del equipo

Rama de trabajo: `codex/front-2`. Equipo: Gonzalo, Matías y Daniel.
Estado: experimental. **No desplegar ni fusionar a master.** El sitio oficial sigue sin cambios.

## Iniciar en otra computadora

1. Clonar `https://github.com/astlimbarko/domain-visionhub.git` (se necesita acceso al repositorio).
2. Ejecutar `git fetch origin` y `git switch --track origin/codex/front-2`.
3. Instalar Node.js 22. Desde `frontend`, ejecutar `npm ci`.
4. Copiar `.env.example` a `.env.local` y completar URL y clave pública anon de Supabase del proyecto existente, por un canal privado del equipo. Nunca usar service_role ni commitear archivos de entorno.
5. Ejecutar `npm run dev:v2 -- --host 127.0.0.1` y abrir `http://127.0.0.1:5174/v2/login` (o el puerto que indique Vite).

Login y permisos: Supabase existente. Cada persona usa su cuenta; no hay lista de correos adicional. La conexión es a datos reales: un cambio desde una acción habilitada puede persistir en producción aunque el frontend sea local. No modificar backend, base ni configuración de Supabase.

Con Docker, crear `frontend/.env.preview` con las mismas variables y ejecutar desde la raíz `docker compose -f frontend/compose.preview.yaml up -d --build`. URL: `http://127.0.0.1:5178/v2/login`. Requiere la imagen base `visionhub-frontend:latest`; si falta, usar la opción Node anterior.

## Qué está integrado y qué sigue

- Inicio móvil de Líder de Casa de Paz: diseño aislado en Shadow DOM, datos existentes y tema claro/oscuro compartido con el sistema.
- Menú original del panel, navegación y servicios conservados. Tablet y escritorio todavía usan la presentación anterior.
- Papeletas sigue pendiente: sin contador inventado ni nueva escritura de notificaciones.
- Matías continuará Reporte de Casa de Paz, Asistencia y Evangelismo, y luego tablet/escritorio, conservando handlers y validaciones.
- El transporte experimental habilita acciones reales para el contexto LIDER_CDP. Los otros roles conservan las restricciones de prueba. No eliminar esta protección globalmente para resolver problemas visuales.
- Las pruebas automáticas deben interceptar Supabase: no enviar formularios contra datos reales.

## Preparación para publicación futura

`npm run build:v2` compila a `frontend/dist-v2/` para `/v2/`, incluido `.htaccess` de subcarpeta. `VITE_APP_URL` debe ser el origen del sitio, sin `/v2`; el prefijo se agrega automáticamente.

React Router, recursos estáticos y redirecciones del frontend usan la base del build. Estado de autenticación persistido y borradores de formularios se separan de V1. Supabase conserva el almacenamiento de sesión experimental separado del sitio oficial.

El flujo `.github/workflows/check-v2.yml` solo compila y conserva un artefacto. **No contiene FTP ni pasos de publicación.** Subir esta rama no publica el sitio.

Antes de un deploy futuro: revisar configuración Apache para que el router de V1 deje pasar `/v2/`; excluir `v2/**` de las sincronizaciones FTP de V1; revisar allowlist de redirecciones Supabase para OAuth/recuperación bajo `/v2/`; verificar recargas de rutas profundas en el servidor real. Nada de esto autoriza cambiar Supabase hoy.

El ajuste mínimo de convivencia de hosting se prepara aparte en `codex/v2-host-routing`, sin cambios de interfaz de V1. No fusionarlo ni ejecutarlo hoy.

Cuando se publique, subir únicamente el contenido de `dist-v2/` a la carpeta `v2/` del mismo hosting. Nunca subir este frontend a la raíz ni fusionar toda esta rama para lograrlo. La sustitución definitiva de V1 queda para otro paso aprobado.
