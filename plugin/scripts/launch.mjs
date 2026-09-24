#!/usr/bin/env node
// SessionStart hook (Claude Code or Codex): start the Agent Pet app if it isn't already running.
// The app is found via, in order: AGENT_PET_APP_DIR, the location the app
// recorded in ~/.agent-pet/app.json the last time it ran, ../app next to this
// plugin (a git checkout, --plugin-dir, or the Codex install script), or the
// Claude Code marketplace clone. Set AGENT_PET_NO_LAUNCH=1 to never auto-start.
//
// The first start runs `npm install` in the app (Electron is a few hundred MB),
// so the pet shows up a minute or two after the first session instead of at once.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.AGENT_PET_PORT || 23456);
const here = dirname(fileURLToPath(import.meta.url));
const stateDir = join(homedir(), '.agent-pet');
/** Another session's install is still running if its marker is younger than this. */
const INSTALL_STALE_MS = 10 * 60 * 1000;

function recordedAppDir() {
  try {
    return JSON.parse(readFileSync(join(stateDir, 'app.json'), 'utf8')).appDir;
  } catch {
    return undefined;
  }
}

const appDir = [
  process.env.AGENT_PET_APP_DIR,
  recordedAppDir(),
  join(here, '..', '..', 'app'),
  // `/plugin marketplace add <owner>/agent-pet` clones the whole repo here; the plugin itself runs from a cache copy.
  join(homedir(), '.claude', 'plugins', 'marketplaces', 'agent-pet', 'app'),
]
  .filter(Boolean)
  .map((d) => resolve(d))
  .find((d) => existsSync(join(d, 'package.json')));

async function isRunning() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 400).unref();
    const res = await fetch(`http://127.0.0.1:${PORT}/health`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  }
}

/** True while some session's first-time `npm install` is in progress (so we don't start a second). */
function installing() {
  try {
    return Date.now() - statSync(join(stateDir, 'installing')).mtimeMs < INSTALL_STALE_MS;
  } catch {
    return false;
  }
}

const q = (s) => `'${String(s).replaceAll("'", `'\\''`)}'`;

try {
  if (!process.env.AGENT_PET_NO_LAUNCH && appDir && !(await isRunning())) {
    const log = openSync(join(tmpdir(), 'agent-pet.log'), 'a');
    const env = { ...process.env, AGENT_PET_PORT: String(PORT) };
    const node = process.execPath;
    const dev = join(appDir, 'scripts', 'dev.mjs');
    if (existsSync(join(appDir, 'node_modules', 'electron'))) {
      spawn(node, [dev], { cwd: appDir, detached: true, stdio: ['ignore', log, log], env }).unref();
    } else if (!installing()) {
      // First run: install, then start. npm sits next to the node that runs this hook.
      mkdirSync(stateDir, { recursive: true });
      const marker = join(stateDir, 'installing');
      writeFileSync(marker, String(Date.now()));
      const npm = join(dirname(node), 'npm');
      const script =
        `echo "[agent-pet] first run: npm install in ${appDir}"; ` +
        `${existsSync(npm) ? q(npm) : 'npm'} install --no-audit --no-fund; code=$?; rm -f ${q(marker)}; ` +
        `[ $code -eq 0 ] && exec ${q(node)} ${q(dev)}`;
      spawn('/bin/sh', ['-c', script], {
        cwd: appDir,
        detached: true,
        stdio: ['ignore', log, log],
        env: { ...env, PATH: `${dirname(node)}:${env.PATH ?? ''}` },
      }).unref();
    }
  }
} catch {
  // Never fail the session because the pet couldn't start.
}
process.exit(0);
