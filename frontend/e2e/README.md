# E2E — Estructura Organizacional (KAN-62)

Corren contra la base **real** de Supabase (decisión del owner, 2026-08-07):
mismo patrón usado en toda la épica — crear datos de prueba con nombre
reconocible (`PRUEBA ... borrar`) y limpiarlos al final de cada test.

## Requisitos antes de correr

1. `npm run dev` corriendo en `http://localhost:5174`.
2. `.auth/storageState.json` presente (gitignored, contiene una sesión real).

## Regenerar `.auth/storageState.json` (cuando expire, ~1h)

La cuenta de Super Admin usa Google OAuth, que no se puede automatizar sin
credenciales reales de Google — por eso no hay un test de "login". En vez de
eso, se reutiliza una sesión ya iniciada a mano:

1. Iniciar sesión normalmente en `http://localhost:5174` con la cuenta de
   Super Admin (astlimbark@gmail.com).
2. Con las devtools del navegador abiertas en esa pestaña, copiar el
   `localStorage` completo del origin `http://localhost:5174`.
3. Pegar esas claves/valores dentro de `.auth/storageState.json`, en
   `origins[0].localStorage` (mismo formato que ya tiene el archivo).

## Correr los tests

```
npx playwright test
```
