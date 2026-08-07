import { defineConfig, devices } from '@playwright/test';

// KAN-62: pruebas E2E de cierre de Estructura Organizacional. Corren contra
// la base REAL de Supabase (decision del owner, 2026-08-07) -- mismo patron
// de todo esta epica: crear datos de prueba con nombre reconocible
// ("PRUEBA ... borrar") y limpiarlos al final de cada test, nunca dejarlos.
//
// La autenticacion usa un storageState pre-generado (frontend/e2e/.auth/
// storageState.json, gitignored) en vez de automatizar el login real -- la
// cuenta de Super Admin usa Google OAuth, que no se puede automatizar sin
// credenciales reales de Google. Para regenerar ese archivo cuando expire,
// ver frontend/e2e/README.md.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    storageState: './e2e/.auth/storageState.json',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
