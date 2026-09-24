import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('./src/renderer'),
  // .vsplat / .glb are served from here: /characters/*.vsplat, /motions/*.glb
  publicDir: r('./assets'),
  base: './',
  // splat-engine spawns its worker via `new URL('./binary-gsplat-worker.js', import.meta.url)`;
  // pre-bundling would break that relative URL.
  optimizeDeps: { exclude: ['@viggle/splat-engine'] },
  server: { port: 5199, strictPort: true },
  build: { outDir: r('./dist'), emptyOutDir: true, target: 'es2022' },
});
