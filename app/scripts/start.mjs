#!/usr/bin/env node
// Start the pet: install its one runtime dependency (Electron) if needed, then launch it.
// The plugin's SessionStart hook runs this detached, so it may take its time; its output
// goes to the log the hook opened ($TMPDIR/agent-pet.log).
//
// - Production (dist/ built, the normal case): only Electron is needed, `npm ci --omit=dev`
//   plus its binary download.
//   Reinstalls when package-lock.json changes (a plugin update bumped Electron).
// - A checkout without dist/ falls back to the Vite dev server (needs `npm install`).
// Cross-platform: no shell, npm.cmd on Windows, no console window.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const win = process.platform === 'win32';
const stateDir = join(homedir(), '.agent-pet');
const marker = join(stateDir, 'installing');
const stamp = join(appDir, 'node_modules', '.agent-pet-installed');
/** Another start's install is still running if its marker is younger than this. */
const INSTALL_STALE_MS = 15 * 60 * 1000;
/** Tried when Electron's own download (GitHub) fails, which is common behind the GFW. */
const ELECTRON_MIRRORS = ['https://npmmirror.com/mirrors/electron/'];

const log = (msg) => console.log(`[agent-pet] ${new Date().toISOString()} ${msg}`);

/** Env for everything we spawn. ELECTRON_RUN_AS_NODE (set in VS Code / Cursor terminals) would start Electron as plain Node. */
function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ELECTRON_RUN_AS_NODE;
  env.PATH = `${dirname(process.execPath)}${win ? ';' : ':'}${env.PATH ?? env.Path ?? ''}`;
  return env;
}

const lockHash = () => {
  try {
    return createHash('sha1').update(readFileSync(join(appDir, 'package-lock.json'))).digest('hex');
  } catch {
    return 'no-lock';
  }
};

function electronBinary() {
  try {
    const rel = readFileSync(join(appDir, 'node_modules', 'electron', 'path.txt'), 'utf8').trim();
    const bin = join(appDir, 'node_modules', 'electron', 'dist', rel);
    return existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}

function npm(args, extraEnv) {
  // npm.cmd can't be spawned without a shell on Windows; everything we pass is a fixed flag.
  const r = spawnSync(win ? 'npm.cmd' : 'npm', args, { cwd: appDir, stdio: 'inherit', env: cleanEnv(extraEnv), shell: win, windowsHide: true });
  return r.status === 0;
}

function installing() {
  try {
    return Date.now() - statSync(marker).mtimeMs < INSTALL_STALE_MS;
  } catch {
    return false;
  }
}

function install(production) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(marker, String(process.pid));
  try {
    const flags = ['--no-audit', '--no-fund', ...(production ? ['--omit=dev'] : [])];
    log(`installing dependencies in ${appDir} (${production ? 'Electron only' : 'everything, dev mode'})`);
    if (!npm(['ci', ...flags]) && !npm(['install', ...flags])) return false;
    // Electron 44 has no postinstall: its binary comes from running install.js. Try the
    // official download (GitHub) first, then the mirrors.
    for (const mirror of [null, ...ELECTRON_MIRRORS]) {
      if (electronBinary()) break;
      log(mirror ? `retrying the Electron download via ${mirror}` : 'downloading Electron');
      spawnSync(process.execPath, [join(appDir, 'node_modules', 'electron', 'install.js')], {
        cwd: appDir,
        stdio: 'inherit',
        env: cleanEnv(mirror ? { ELECTRON_MIRROR: mirror } : {}),
        windowsHide: true,
      });
    }
    if (!electronBinary()) return false;
    writeFileSync(stamp, lockHash());
    return true;
  } finally {
    rmSync(marker, { force: true });
  }
}

const production = existsSync(join(appDir, 'dist', 'index.html'));
const upToDate = () => {
  if (!electronBinary()) return false;
  try {
    return readFileSync(stamp, 'utf8').trim() === lockHash();
  } catch {
    // Electron is there but we never installed it: a developer's checkout (`npm install` by hand).
    // Adopt it rather than `npm ci --omit=dev`, which would strip their dev dependencies.
    writeFileSync(stamp, lockHash());
    return true;
  }
};

if (!upToDate()) {
  if (installing()) {
    log('another session is installing; it will start the pet when done');
    process.exit(0);
  }
  if (!install(production)) {
    log('install failed; see the npm output above. The next session will try again.');
    process.exit(1);
  }
}

const opts = { cwd: appDir, detached: true, stdio: 'inherit', env: cleanEnv(), windowsHide: true };
if (production) {
  log('starting');
  spawn(electronBinary(), [appDir], opts).unref();
} else {
  log('no dist/ build: starting the dev server');
  spawn(process.execPath, [join(appDir, 'scripts', 'dev.mjs')], opts).unref();
}
