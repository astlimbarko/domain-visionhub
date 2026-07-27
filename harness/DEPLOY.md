# Despliegue — VisionHub

Este documento existe porque el 2026-07-27 hubo un problema real al desplegar
en un hosting compartido (cPanel): el panel avisó que "no soporta Node.js" y
generó confusión sobre si el proyecto usa Node.js en producción. **No lo usa.**
Este documento deja el stack y las reglas de despliegue explícitas para que no
se repita.

---

## 1. Stack declarado

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 |
| Estado global | Zustand |
| Datos / cache / llamadas remotas | TanStack Query |
| Backend | **Supabase** (Postgres + Auth + Storage + funciones RPC). Ver decisión ya cerrada en [README.md](README.md#decisiones-tomadas). |
| Servidor propio (Node/Express/etc.) | **No existe. Nunca existió.** |

VisionHub es un **SPA estático**: `npm run build` genera HTML + JS + CSS puros
en `frontend/dist/`. Esos archivos se sirven tal cual desde cualquier
servidor web (Apache, Nginx, etc.). Todo lo que antes sería "el backend" —
login, base de datos, permisos, archivos — lo resuelve Supabase directamente
desde el navegador del usuario. No hay ninguna pieza intermedia que necesite
correr Node.js.

---

## 2. Dónde entra Node.js (y dónde NO)

| Momento | ¿Se usa Node.js? |
|---------|------------------|
| Desarrollo local (`npm run dev`, Docker) | Sí — es el entorno de desarrollo. |
| Compilar (`npm install && npm run build`) | Sí — **una sola vez**, para generar `dist/`. |
| Servir el sitio ya compilado (producción) | **No, nunca.** El hosting solo entrega archivos estáticos. |

Node.js es una herramienta de **construcción** (como un compilador), no una
pieza de la aplicación en producción. Una vez que existe `frontend/dist/`,
Node.js ya no pinta nada.

---

## 3. ⚠️ Advertencia crítica: hosting compartido (cPanel / HostGator y similares)

Los planes de hosting compartido con cPanel suelen incluir una herramienta
llamada **"Setup Node.js App" / "Node.js Selector"**. Sirve para darte acceso
a `npm`/`node` en un hosting que normalmente no los tiene, y así poder correr
el build ahí mismo si no se sube `dist/` ya compilado desde otra parte.

**El problema:** si se usa esa herramienta para "levantar" el sitio (en vez
de solo para compilar una vez), cPanel registra el dominio como una
**aplicación Node.js activa**, y los planes compartidos limitan cuántas
apps Node.js activas se pueden tener. Ahí es cuando el panel avisa que
"no soporta Node.js" — no es que el código lo necesite, es que se está
usando esa herramienta como si el sitio fuera una app Node corriendo, cuando
en realidad es un sitio estático.

**Regla para cualquier despliegue futuro:**

- ✅ Node.js/npm se puede usar **una vez**, solo para ejecutar `npm install && npm run build`.
- ✅ Después del build, se sube (o queda servido) **solo el contenido de `frontend/dist/`**.
- ❌ **Nunca** dejar una "Node.js App" corriendo/activa apuntando a este proyecto.
- ❌ **Nunca** subir `node_modules/`, `src/`, ni el proyecto completo — solo `dist/`.
- Si el panel muestra un aviso de Node.js "no soportado", la solución es
  **quitar/detener la Node.js App registrada para ese dominio**, no cambiar
  código.

---

## 4. Checklist para desplegar en un hosting compartido nuevo

- [ ] Generar el build (local o con el Node del hosting, solo para este paso): `cd frontend && npm install && npm run build`
- [ ] Subir **únicamente** el contenido de `frontend/dist/` a la carpeta pública del hosting (ej. `public_html/`)
- [ ] Confirmar que `.htaccess` quedó incluido (ya se copia solo desde `frontend/public/.htaccess` en cada build, resuelve las rutas de React Router)
- [ ] Confirmar que el document root del dominio apunta a esa carpeta con `dist/`
- [ ] Confirmar que **no** hay una "Node.js App" activa/corriendo para ese dominio en cPanel
- [ ] Probar en incógnito: login, y navegación **directa** a una ruta profunda (ej. `/afirmacion`) sin que dé 404

---

## 5. Qué pasó el 2026-07-27 (referencia)

Detalle completo del incidente (sitio de prueba en HostGator sirviendo un
build viejo + el aviso de Node.js) en la memoria de la sesión:
`afirmacion-fase1-spec.md`. Resumen: el build desplegado estaba desactualizado
(no se había vuelto a correr `npm run build` tras los últimos cambios), y por
separado se había usado el Node.js Selector de cPanel de una forma que generó
el aviso de "Node.js no soportado". Se corrigió con un `.htaccess` para rutas
SPA (PR #6, ya en `master`) y con la explicación de este documento.
