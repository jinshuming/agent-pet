#!/usr/bin/env node
// Claude Code / Codex hook → Agent Pet app (both send the same hook payload). Registered as an async hook on every
// lifecycle event, so it never blocks the session. It forwards a trimmed-down
// copy of the payload and always exits 0, even if the app isn't running.
//
// Only fields the pet needs leave this process: no file contents, no prompts,
// no tool output. Commands and paths are clipped.

const PORT = Number(process.env.AGENT_PET_PORT || 23456);
const TIMEOUT_MS = 400;
const STDIN_TIMEOUT_MS = 1000;

const clip = (s, n) => {
  if (Array.isArray(s)) s = s.join(' '); // Codex may pass a command as argv
  return typeof s === 'string' ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : undefined;
};

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    const done = () => resolve(raw);
    setTimeout(done, STDIN_TIMEOUT_MS).unref();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (raw += c));
    process.stdin.on('end', done);
    process.stdin.on('error', done);
  });
}

function pick(p) {
  const input = p.tool_input && typeof p.tool_input === 'object' ? p.tool_input : {};
  return {
    event: p.hook_event_name,
    session: p.session_id,
    cwd: p.cwd,
    // Only the path: the app reads it locally for interrupts and rejected prompts (see transcript-tail.cjs).
    transcript: typeof p.transcript_path === 'string' ? p.transcript_path : undefined,
    agentId: p.agent_id,
    agentType: p.agent_type,
    tool: p.tool_name,
    toolInput: {
      command: clip(input.command, 160),
      filePath: clip(input.file_path ?? input.notebook_path ?? input.path, 300),
      pattern: clip(input.pattern ?? input.query ?? input.url, 120),
      description: clip(input.description, 120),
    },
    notificationType: p.notification_type,
    errorType: p.error_type ?? p.error,
    source: p.source ?? p.reason ?? p.trigger,
    ts: Date.now(),
  };
}

try {
  const raw = await readStdin();
  const payload = pick(JSON.parse(raw || '{}'));
  if (payload.event) {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), TIMEOUT_MS).unref();
    await fetch(`http://127.0.0.1:${PORT}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  }
} catch {
  // App not running, bad payload, timeout: the pet is optional, the session is not.
}
process.exit(0);
