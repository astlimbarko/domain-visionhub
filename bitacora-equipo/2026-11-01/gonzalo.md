# Gonzalo — 2026-11-01

- [x] Por aclaración de Gonzalo, preparé codex/frontend-adminlte-mui-real desde origin/master 43bdb2e en copia independiente. Se conserva la lógica oficial: App, rutas, auth store, construcción de sesión, roles, formularios y servicios de negocio originales. Pruebas anteriores intactas.
- [x] Adapté solo JSX del login a MUI conservando handlers y validaciones originales, e incorporé tema claro/oscuro. Añadí filtro de transporte: permite autenticación y consultas autorizadas, bloquea escrituras de negocio/RPC no permitidas y limita logout a la sesión local.
- [x] Configuré Docker local en 127.0.0.1:5178 con solo URL y clave pública anon existentes (no versionadas). No se copian claves secretas ni credenciales de usuario, no se cambia configuración/esquema/datos de Supabase.
- [x] Construí y levanté Docker en 127.0.0.1:5178/login. Verifiqué tipos del frontend completo y lint de archivos modificados sin errores/avisos; comprobé conectividad Auth pública (HTTP 200) sin iniciar sesión real.

- [x] Ajusté solo presentación del selector original mediante atributo CSS; su lógica de contextos y permisos permanece intacta. App, store, hooks, auth.service, sesion.service y Reportes.tsx sin cambios respecto del oficial.
- [x] QA en Chrome con respuestas interceptadas: login MUI light/dark, construcción de sesión oficial, iglesias/roles originales, sesión con clave aislada, bloqueo de INSERT/subida/RPC no permitida antes de red, logout limitado a scope=local y móvil sin desbordamiento. No se usaron cuentas ni contraseñas reales; capturas de fixtures inspeccionadas.
- [x] Revisé consultas de lectura autorizadas como STABLE en SQL existente; no se ejecutó SQL, migración ni cambio de configuración. Ambiente usa solo URL/anon públicas locales ignoradas por Git.
- [ ] Siguiente paso: Gonzalo inicia sesión por sí mismo en 5178, verifica su iglesia/rol reales y elige la siguiente pantalla para adaptar visualmente manteniendo su lógica. Las ramas de prueba nunca van a master ni producción.
