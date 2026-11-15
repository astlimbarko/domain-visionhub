import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.VITE_PUBLIC_BASE_PATH || '/v2/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) {
  throw new Error('VITE_PUBLIC_BASE_PATH debe ser una ruta absoluta terminada en /.');
}
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const args of [['tsc', '-b'], ['vite', 'build', '--base', base, '--outDir', 'dist-v2']]) {
  const result = spawnSync(executable, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const htaccess = readFileSync(resolve('public/.htaccess'), 'utf8').replace('RewriteBase /', `RewriteBase ${base}`);
writeFileSync(resolve('dist-v2/.htaccess'), htaccess);
writeFileSync(resolve('dist-v2/version-v2.json'), JSON.stringify({ version: 'front-2', base, commit: process.env.GITHUB_SHA || 'local' }));