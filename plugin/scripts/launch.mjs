#!/usr/bin/env node
// SessionStart hook (Claude Code or Codex): start the Agent Pet app if it isn't already running.
// The app is found via, in order: AGENT_PET_APP_DIR, the location the app
// recorded in ~/.agent-pet/app.json the last time it ran, ../app next to this
// plugin (a git checkout, --plugin-dir, or the Codex install script), or the
// Claude Code marketplace clone. Set AGENT_PET_NO_LAUNCH=1 to never auto-start.
//
// The app's own scripts/start.mjs installs Electron on first run (a minute or two)
// and launches it; this hook only finds it and hands off, so it returns at once.
import { spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync, renameSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.AGENT_PET_PORT || 23456);
const here = dirname(fileURLToPath(import.meta.url));
/** The log is kept to one file of this size plus one older one. */
const LOG_MAX_BYTES = 5 * 1024 * 1024;

function recordedAppDir() {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.agent-pet', 'app.json'), 'utf8')).appDir;
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
  .find((d) => existsSync(join(d, 'scripts', 'start.mjs')));

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

function openLog() {
  const file = join(tmpdir(), 'agent-pet.log');
  try {
    if (statSync(file).size > LOG_MAX_BYTES) renameSync(file, `${file}.old`);
  } catch {
    // no log yet
  }
  return openSync(file, 'a');
}

try {
  if (!process.env.AGENT_PET_NO_LAUNCH && appDir && !(await isRunning())) {
    const log = openLog();
    const env = { ...process.env, AGENT_PET_PORT: String(PORT) };
    delete env.ELECTRON_RUN_AS_NODE; // set in VS Code / Cursor terminals; would start Electron as plain Node
    spawn(process.execPath, [join(appDir, 'scripts', 'start.mjs')], {
      cwd: appDir,
      detached: true,
      stdio: ['ignore', log, log],
      env,
      windowsHide: true,
    }).unref();
  }
} catch {
  // Never fail the session because the pet couldn't start.
}
process.exit(0);
