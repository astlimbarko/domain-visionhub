# Gonzalo — 2026-09-30

- [x] Mergeado a master el PR #141 (portal intermedio de Colaborar, KAN-485) — 6 commits, `b1b0666`
- [x] Agregada la entrada de /avances de KAN-485 antes del merge (`20260930030000_avances_kan485_portal_colaborar.sql`), como manda la regla de CLAUDE.md
- [x] Detectado que el PR #141 iba a mergearse sin su publicación en /avances (el cuerpo del PR lo difería por deploy en pausa) — se resolvió agregando la migración en la misma rama, no en una aparte
- [x] Build de producción desde `master` (b1b0666): `npm ci` + `npm run build` (`tsc -b` + vite, 24s), sin errores
- [x] dist verificado sirviéndolo con `vite preview` y probándolo en navegador: 27/27 assets en 200, 0 errores y 0 warnings de consola, login renderiza mostrando v1.0.141, `/colaborar` redirige a `/login` (guard OK), rutas profundas sin 404
- [x] Env horneado verificado en el bundle: `VITE_APP_URL=https://app.somoscdv.com`, URL de Supabase del proyecto y anon key aceptada por producción (`/auth/v1/settings` → 200)
- [x] dist comprimido en `dist-master-b1b0666-kan485.zip` (2.54 MB, 256 archivos, contenido en la raíz para descomprimir directo en `public_html`, `.htaccess` incluido)
- [x] Harness 21: confirmado que "Membresía desde 0 (paralela)" está **solo en spec, sin código implementado** (los 4 commits son `docs:`, el árbol está limpio, sin WIP en stash ni worktrees). El owner decidió **no tocar** los punteros de CLAUDE.md / AfirmacionAltar.tsx / open-questions.md que dicen "lo termina Matías"
- [ ] Pendiente: subir `dist-master-b1b0666-kan485.zip` a producción por cPanel (deploy manual)
- [ ] Pendiente: `.github/workflows/deploy.yml` **falla en todos los merges** (8 de los últimos 8, incluido el de hoy) y muere en 2-4s — se rompe antes del `npm ci`, no es el build. Por eso el deploy quedó manual. No investigado todavía
- [ ] Pendiente: arrancar la implementación de "Membresía desde 0 (paralela)" (la parte de harness 21 que es del owner). 3 preguntas abiertas la bloquean: #15 cómo se distingue origen link vs desde-0 en la base, #16 botón "llenar membresía" desde Bautismo, #17 wording de las preguntas livianas
- [ ] Pendiente owner: 2 registros de prueba de Altar en producción + duplicado usuario_rol de Marcia (de ayer)
- [ ] Sin resolver: parpadeo de tabla de Afirmación al hacer clic en chips (KAN-480, diferido)
