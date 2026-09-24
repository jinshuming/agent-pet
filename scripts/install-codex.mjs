#!/usr/bin/env node
// Hook Agent Pet into Codex: add this checkout's hooks to ~/.codex/hooks.json.
// Codex sends the same hook payload as Claude Code, so it reuses plugin/scripts.
// Safe to run again (it replaces its own entries); --uninstall removes them.
// Codex asks you to review and trust new hooks once: run /hooks inside Codex.
//
// usage: node scripts/install-codex.mjs [--uninstall] [--codex-home ~/.codex]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');
const homeAt = args.indexOf('--codex-home');
const codexHome = resolve(homeAt >= 0 ? args[homeAt + 1] : process.env.CODEX_HOME || join(homedir(), '.codex'));
const file = join(codexHome, 'hooks.json');

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = join(repo, 'plugin', 'scripts');
const q = (s) => `"${s.replaceAll('"', '\\"')}"`;
const emit = `node ${q(join(scripts, 'emit.mjs'))}`;
const launch = `node ${q(join(scripts, 'launch.mjs'))}`;

// Codex caps SessionEnd / Interrupt hooks at 3 s and always runs SessionEnd synchronously.
const EVENTS = {
  SessionStart: [launch, emit],
  SessionEnd: [emit],
  UserPromptSubmit: [emit],
  PreToolUse: [emit],
  PostToolUse: [emit],
  PermissionRequest: [emit],
  SubagentStart: [emit],
  SubagentStop: [emit],
  Stop: [emit],
  Interrupt: [emit],
  PreCompact: [emit],
  PostCompact: [emit],
};
const SHORT = new Set(['SessionEnd', 'Interrupt']);

/** One of ours: it runs this checkout's emit/launch script, or another agent-pet checkout's. */
const ours = (h) =>
  typeof h?.command === 'string' &&
  (h.command.includes(scripts) || (/agent-pet/.test(h.command) && /plugin[\\/]scripts[\\/](emit|launch)\.mjs/.test(h.command)));

let config = { hooks: {} };
if (existsSync(file)) {
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`${file} isn't valid JSON (${err.message}); fix or move it, then run this again.`);
    process.exit(1);
  }
}
config.hooks ??= {};

// Drop our previous entries everywhere, keep everyone else's.
for (const [event, groups] of Object.entries(config.hooks)) {
  if (!Array.isArray(groups)) continue;
  const kept = groups
    .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !ours(h)) }))
    .filter((g) => g.hooks.length > 0);
  if (kept.length) config.hooks[event] = kept;
  else delete config.hooks[event];
}

if (!uninstall) {
  for (const [event, commands] of Object.entries(EVENTS)) {
    const hooks = commands.map((command) => ({ type: 'command', command, timeout: SHORT.has(event) ? 3 : 10, async: true }));
    (config.hooks[event] ??= []).push({ hooks });
  }
  config.description ??= 'Lifecycle hooks';
}

mkdirSync(codexHome, { recursive: true });
writeFileSync(file, JSON.stringify(config, null, 2) + '\n');

if (uninstall) {
  console.log(`Removed Agent Pet's hooks from ${file}.`);
} else {
  const deps = existsSync(join(repo, 'app', 'node_modules', 'electron'));
  console.log(`Added Agent Pet's hooks to ${file} (${Object.keys(EVENTS).length} events).`);
  console.log('Next: start Codex, run /hooks, and trust the Agent Pet hooks.');
  if (!deps) console.log('The first session also installs the app (npm install in app/), so the pet appears after a minute or two.');
}
