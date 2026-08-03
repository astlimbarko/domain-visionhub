# Matías — 2026-07-31

- [x] Build de producción del frontend (`npm run build`, dist/ fresco con `.htaccess` de SPA incluido)
- [x] Deploy al dominio: subido a `app.somoscdv.com` (servidor cPanel 162.241.61.103, subdominio ya configurado con document root en `~/app.somoscdv.com/public/`), siguiendo el checklist de `harness/DEPLOY.md`
- [x] Backup del contenido anterior de `~/app.somoscdv.com/public/` antes de sobrescribir (queda en `~/app.somoscdv.com/public_deploy_backup_20260731_183306/` en el servidor)
- [x] Verificado en producción: `https://app.somoscdv.com/` responde 200, ruta profunda `/afirmacion` responde 200 (sin 404 de Apache), título `VisionHub` correcto
- [x] Confirmado que no quedó ninguna Node.js App activa en cPanel para el dominio (solo se sirven archivos estáticos de `dist/`)
