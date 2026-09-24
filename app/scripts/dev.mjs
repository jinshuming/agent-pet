// Starts the Vite dev server for the renderer, then launches Electron against it.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { createServer } from 'vite';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)) });
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`[dev] renderer at ${url}`);

const electron = spawn(electronPath, [appDir], {
  stdio: 'inherit',
  env: { ...process.env, PET_DEV_URL: url },
});
electron.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
