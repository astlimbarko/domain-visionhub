import { test, expect } from '@playwright/test';

// KAN-62. Iglesia de prueba de toda la epica: "Centro de Vida El Eden".
const IGLESIA_ID = 'd036addf-3cb7-4938-8223-bced5944de44';

async function crearRedDePrueba(page: import('@playwright/test').Page, sufijo: string) {
  const nombre = `PRUEBA E2E ${sufijo} borrar ${Date.now()}`;
  await page.goto(`/estructura-organizacional/${IGLESIA_ID}`);
  await page.getByRole('button', { name: 'Nueva Red' }).click();
  await page.getByRole('textbox', { name: 'Nombre de la Red' }).fill(nombre);
  await page.getByRole('button', { name: 'Crear Red' }).click();
  const tarjeta = page.getByText(`Red: "${nombre}"`);
  await expect(tarjeta).toBeVisible({ timeout: 10_000 });
  // force:true -- el lienzo acumula muchas Redes de prueba agrisadas de
  // corridas anteriores (quedan asi a proposito, ver README) y a veces se
  // superponen visualmente; el nodo real sigue siendo el unico con este
  // nombre exacto, solo hace falta saltar el chequeo de superposicion.
  await tarjeta.click({ force: true });
  return nombre;
}

async function eliminarRedDePrueba(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Eliminar Red' }).click();
  await page.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('Red eliminada')).toBeVisible({ timeout: 10_000 });
}

test('crear Red, asignar Lider de Red desde base de datos, y eliminar', async ({ page }) => {
  await crearRedDePrueba(page, 'basica');

  await page.getByRole('button', { name: 'Asignar' }).first().click();
  await page.getByRole('textbox', { name: 'Escribe nombre, apellido o correo' }).fill('Patricia');
  const resultado = page.getByRole('button', { name: /Patricia/ }).first();
  await expect(resultado).toBeVisible({ timeout: 10_000 });
  await resultado.click();

  await expect(page.getByText('Patricia', { exact: false }).first()).toBeVisible({ timeout: 10_000 });

  await eliminarRedDePrueba(page);
});

test('busqueda "Desde base de datos" trae resultados (guarda KAN-90)', async ({ page }) => {
  // Regresion real 2026-08-07: fn_buscar_personas tenia 2 overloads
  // ambiguos que rompian TODA busqueda con PGRST203. Si vuelve a pasar,
  // este test lo detecta antes de que llegue a produccion.
  await crearRedDePrueba(page, 'busqueda');
  await page.getByRole('button', { name: 'Asignar' }).first().click();
  await page.getByRole('textbox', { name: 'Escribe nombre, apellido o correo' }).fill('Marcelo');
  await expect(page.getByText('No se encontraron personas.')).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Marcelo/ }).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Close' }).click();
  await eliminarRedDePrueba(page);
});

test('asignar por correo ya existente ofrece "asignar de todas formas" (guarda KAN-61)', async ({ page }) => {
  // francomatiassalvatierra548@gmail.com ya tiene cuenta + Persona vinculada
  // en esta iglesia (Matias, Supervisor de la Vision en Accion) -- probar
  // asignarlo por correo a una Red nueva debe ofrecer el atajo, no un error
  // generico sin salida.
  await crearRedDePrueba(page, 'correo-existente');
  await page.getByRole('button', { name: 'Asignar' }).first().click();
  await page.getByRole('button', { name: 'Por correo electrónico' }).click();
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('francomatiassalvatierra548@gmail.com');
  await page.getByRole('button', { name: 'Designar y enviar correo' }).click();

  await expect(page.getByText('Ya existe una cuenta con ese correo', { exact: false })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await eliminarRedDePrueba(page);
});

test('crear Casa de Paz dentro de una Red', async ({ page }) => {
  await crearRedDePrueba(page, 'cdp');
  await page.getByRole('button', { name: '+ Nueva' }).click();
  await page.getByRole('button', { name: 'Crear Casa de Paz' }).click();
  await expect(page.getByText('Casa de Paz creada')).toBeVisible({ timeout: 10_000 });
  await eliminarRedDePrueba(page);
});

test('quitar cargo pide confirmacion', async ({ page }) => {
  await crearRedDePrueba(page, 'quitar-cargo');
  await page.getByRole('button', { name: 'Asignar' }).first().click();
  await page.getByRole('textbox', { name: 'Escribe nombre, apellido o correo' }).fill('Patricia');
  await page.getByRole('button', { name: /Patricia/ }).first().click();
  await expect(page.getByText('Patricia', { exact: false }).first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Quitar cargo' }).click();
  await expect(page.getByText('¿Quitar a', { exact: false })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(page.getByText('Cargo retirado')).toBeVisible({ timeout: 10_000 });

  await eliminarRedDePrueba(page);
});

test('panel muestra tirador de hoja inferior en movil (KAN-63)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const nombre = await crearRedDePrueba(page, 'movil');
  await expect(page.locator('.rounded-full.bg-slate-300').first()).toBeVisible();
  await eliminarRedDePrueba(page);
  expect(nombre).toContain('movil');
});
