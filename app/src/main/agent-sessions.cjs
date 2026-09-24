// Turns raw Claude Code hook events into one pet state.
// Each session keeps its own state; the pet shows the highest-priority one.
const path = require('node:path');
const { TranscriptTail } = require('./transcript-tail.cjs');

/** Higher wins when several sessions are live. */
const PRIORITY = { permission: 6, error: 5, working: 4, thinking: 3, done: 2, greet: 2, idle: 1, sleep: 0 };
/** Transient states play once, then the session settles into `settle`. */
// Long enough for the whole one-shot motion plus crossfades
// (done: 6s panting + 4s proud, error: 4s, greet: 4s).
const FLASH_MS = { done: 11500, error: 5500, greet: 5000 };
/** States in which the session is mid-turn: watch its transcript for an interrupt or a rejection. */
const BUSY = new Set(['thinking', 'working', 'permission']);
/** Tools that stop and wait for the user's answer rather than doing work. */
const ASK_TOOLS = { AskUserQuestion: '❓ 等你回答', ExitPlanMode: '📋 等你确认计划' };
/** Notification types meaning "the agent is waiting on you". */
const WAITING_NOTIFICATIONS = {
  permission_prompt: '🙋 等你授权',
  agent_needs_input: '💬 等你回复',
  elicitation_dialog: '📝 需要你填写',
  elicitation_url_dialog: '🔗 需要你在浏览器里确认',
};
/** After a tool finishes, keep "working" briefly so back-to-back tools don't flicker. */
const TOOL_GAP_MS = 1500;
/** A busy session that goes silent this long is assumed dead (crash, killed terminal). */
const STALE_MS = 10 * 60 * 1000;
/** No live activity anywhere for this long → the pet falls asleep. */
const SLEEP_AFTER_MS = 5 * 60 * 1000;
const TICK_MS = 1000;

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead']);
// apply_patch is Codex's file-editing tool.
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch']);
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch']);

const SEARCH_TOOLS = new Set(['Grep', 'Glob', 'LS', 'ToolSearch']);
const AGENT_TOOLS = new Set(['Task', 'Agent']);
const RUN_TOOLS = new Set(['Bash', 'BashOutput', 'KillShell', 'exec_command', 'shell', 'local_shell']);

const base = (p) => (p ? path.basename(p) : '');

function toolLabel(tool, input = {}) {
  if (!tool) return '';
  if (EDIT_TOOLS.has(tool)) return `✏️ ${base(input.filePath) || tool}`;
  if (READ_TOOLS.has(tool)) return `🔍 ${base(input.filePath) || input.pattern || tool}`;
  if (RUN_TOOLS.has(tool)) return `💻 ${input.description || input.command || tool}`;
  if (WEB_TOOLS.has(tool)) return '🌐 查资料';
  if (AGENT_TOOLS.has(tool)) return `🧑‍🤝‍🧑 ${input.description || '派出子 Agent'}`;
  if (tool.startsWith('mcp__')) return `🔌 ${tool.split('__').slice(1).join('.')}`;
  return `🛠 ${tool}`;
}

/**
 * What kind of work a tool is, so the pet can act it out: typing for edits, reading a
 * tablet for reads, scanning the horizon for searches, watching a machine for commands.
 */
function toolActivity(tool) {
  if (!tool) return null;
  if (EDIT_TOOLS.has(tool)) return 'edit';
  if (SEARCH_TOOLS.has(tool)) return 'search';
  if (READ_TOOLS.has(tool)) return 'read';
  if (RUN_TOOLS.has(tool)) return 'run';
  if (WEB_TOOLS.has(tool)) return 'web';
  if (AGENT_TOOLS.has(tool)) return 'agent';
  if (tool.startsWith('mcp__')) return 'mcp';
  return 'other';
}

/** A permission prompt, as a question: "可以运行 npm test 吗？". */
function permissionLabel(tool, input = {}) {
  if (!tool) return '🙋 等你授权';
  const what = (s) => (s.length > 24 ? `${s.slice(0, 23)}…` : s);
  if (EDIT_TOOLS.has(tool)) return `🙋 可以改 ${what(base(input.filePath) || '文件')} 吗？`;
  if (RUN_TOOLS.has(tool)) return `🙋 可以运行 ${what(input.description || input.command || '命令')} 吗？`;
  if (WEB_TOOLS.has(tool)) return '🙋 可以上网查资料吗？';
  if (READ_TOOLS.has(tool)) return `🙋 可以看 ${what(base(input.filePath) || input.pattern || '文件')} 吗？`;
  if (tool.startsWith('mcp__')) return `🙋 可以用 ${what(tool.split('__').slice(1).join('.'))} 吗？`;
  return `🙋 可以用 ${what(tool)} 吗？`;
}

/** Subagent types by what they look like on the team strip. */
function agentIcon(type = '') {
  const t = type.toLowerCase();
  if (t.includes('explore') || t.includes('search')) return '🔍';
  if (t.includes('plan')) return '📐';
  if (t.includes('review')) return '🧐';
  if (t.includes('test')) return '🧪';
  if (t.includes('guide') || t.includes('doc')) return '📚';
  return '🤖';
}

class AgentSessions {
  /** @param {(view: {state: string, settle: string, label: string}) => void} onChange */
  constructor(onChange) {
    this.onChange = onChange;
    this.sessions = new Map();
    this.lastActivity = Date.now();
    this.lastView = null;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  handle(ev) {
    const now = Date.now();
    const id = ev.session || 'default';
    if (ev.event === 'SessionEnd') {
      this.sessions.delete(id);
      return this.emit();
    }
    let s = this.sessions.get(id);
    if (!s) {
      s = { id, cwd: ev.cwd, state: 'idle', label: '', activity: null, flash: null, gapUntil: 0, subagents: 0, agents: new Map(), updatedAt: now, tail: null };
      this.sessions.set(id, s);
    }
    s.cwd = ev.cwd || s.cwd;
    // The session's own transcript (a subagent's events may point at the subagent's).
    if (ev.transcript && !ev.agentId && s.tail?.path !== ev.transcript) s.tail = new TranscriptTail(ev.transcript);
    s.updatedAt = now;
    this.lastActivity = now;

    // A subagent's own tool calls: they show on its chip in the team strip, not as the pet's own work.
    if (ev.agentId && (ev.event === 'PreToolUse' || ev.event === 'PostToolUse')) {
      const a = s.agents.get(ev.agentId);
      if (a && ev.event === 'PreToolUse') a.label = toolLabel(ev.tool, ev.toolInput);
      // The subagent's permission prompt was answered: the tool it asked for has run.
      if (ev.event === 'PostToolUse' && s.state === 'permission') s.state = 'working';
      if (s.state === 'idle' || s.state === 'thinking') s.state = 'working';
      if (!s.activity) s.activity = 'agent';
      return this.emit();
    }

    switch (ev.event) {
      case 'SessionStart':
        s.state = 'idle';
        s.label = '👋 上线';
        // Say hi to a new or resumed session, not to /clear or a compaction.
        if (!ev.source || ev.source === 'startup' || ev.source === 'resume') {
          s.flash = { state: 'greet', until: now + FLASH_MS.greet };
        }
        break;
      case 'UserPromptSubmit':
        s.state = 'thinking';
        s.label = '💭 思考中';
        s.activity = null;
        s.flash = null;
        // Whatever the transcript said before this prompt (an earlier interrupt) is history.
        if (s.tail) s.tail = new TranscriptTail(s.tail.path);
        break;
      case 'PreToolUse':
        s.gapUntil = 0;
        // Asking you a question or showing a plan: waiting on you, not working.
        if (ASK_TOOLS[ev.tool] && !ev.agentId) {
          s.state = 'permission';
          s.label = ASK_TOOLS[ev.tool];
          break;
        }
        s.state = 'working';
        s.label = toolLabel(ev.tool, ev.toolInput);
        s.activity = toolActivity(ev.tool);
        break;
      case 'PostToolUse':
        // A tool that finished was approved (or its question answered): stop asking.
        if (s.state === 'permission') {
          s.state = 'working';
          s.label = '💭 思考中';
        }
        // Stay in "working" for a moment; tick() drops to thinking if nothing follows.
        s.gapUntil = now + TOOL_GAP_MS;
        break;
      case 'PostToolUseFailure':
        s.flash = { state: 'error', until: now + FLASH_MS.error };
        s.label = `❌ ${ev.tool || '工具'}失败`;
        s.state = 'thinking';
        break;
      case 'PermissionRequest':
        s.state = 'permission';
        s.label = permissionLabel(ev.tool, ev.toolInput);
        break;
      case 'Notification':
        if (WAITING_NOTIFICATIONS[ev.notificationType]) {
          s.state = 'permission';
          s.label = WAITING_NOTIFICATIONS[ev.notificationType];
        } else if (ev.notificationType === 'idle_prompt') {
          s.state = 'idle';
          s.label = '💬 等你回复';
        } else if (ev.notificationType === 'elicitation_complete' || ev.notificationType === 'elicitation_response') {
          if (s.state === 'permission') s.state = 'thinking';
          s.label = '💭 思考中';
        } else {
          return; // auth_success, agent_completed, quota_*: nothing to show
        }
        break;
      // An MCP server asks you for input mid-tool, then gets your answer.
      case 'Elicitation':
        s.state = 'permission';
        s.label = '📝 需要你填写';
        break;
      case 'ElicitationResult':
        if (s.state === 'permission') s.state = 'working';
        s.label = toolLabel(ev.tool, ev.toolInput) || '💭 思考中';
        s.gapUntil = now + TOOL_GAP_MS;
        break;
      case 'SubagentStart':
        s.subagents += 1;
        if (ev.agentId) s.agents.set(ev.agentId, { id: ev.agentId, type: ev.agentType || '', label: '', since: now });
        s.state = 'working';
        s.activity = 'agent';
        s.label = `🧑‍🤝‍🧑 子 Agent ×${s.subagents}`;
        break;
      case 'SubagentStop':
        s.subagents = Math.max(0, s.subagents - 1);
        if (ev.agentId) s.agents.delete(ev.agentId);
        else if (s.agents.size > s.subagents) s.agents.delete([...s.agents.keys()][0]);
        if (s.subagents > 0 && s.state === 'working') s.label = `🧑‍🤝‍🧑 子 Agent ×${s.subagents}`;
        break;
      case 'PreCompact':
        s.state = 'thinking';
        s.activity = 'tidy';
        s.label = '🧹 整理上下文';
        break;
      case 'Stop':
        s.state = 'idle';
        s.subagents = 0;
        s.agents.clear();
        s.flash = { state: 'done', until: now + FLASH_MS.done };
        s.label = '✅ 完成';
        break;
      // Codex reports Esc mid-turn as its own event (Claude Code needs the transcript for that).
      case 'Interrupt':
        s.state = 'idle';
        s.subagents = 0;
        s.agents.clear();
        s.flash = null;
        s.label = '';
        break;
      case 'StopFailure':
        s.state = 'idle';
        s.subagents = 0;
        s.agents.clear();
        s.flash = { state: 'error', until: now + FLASH_MS.error };
        s.label = `⚠️ ${ev.errorType || '出错了'}`;
        break;
      default:
        return; // PostCompact etc.: bookkeeping only
    }
    if (s.state !== 'working' && s.state !== 'thinking') s.activity = null;
    this.emit();
  }

  /** What no hook reports: read the transcript of each busy session for an Esc or a rejected prompt. */
  watchTranscripts(now) {
    let changed = false;
    for (const s of this.sessions.values()) {
      if (!s.tail || !BUSY.has(s.state)) continue;
      for (const kind of s.tail.poll()) {
        s.updatedAt = now;
        s.gapUntil = 0;
        if (kind === 'interrupted') {
          // Esc: the turn is over, and Stop never fires for it.
          s.state = 'idle';
          s.subagents = 0;
          s.agents.clear();
          s.activity = null;
          s.label = '⏹ 已中断';
        } else {
          // Permission denied: the agent reads the refusal and either carries on or stops.
          s.state = 'thinking';
          s.activity = null;
          s.label = '🙅 被拒绝了';
        }
        console.log(`[transcript] ${s.id.slice(0, 8)} ${kind}`);
        changed = true;
      }
    }
    return changed;
  }

  tick() {
    const now = Date.now();
    let changed = this.watchTranscripts(now);
    for (const s of this.sessions.values()) {
      if (s.gapUntil && now >= s.gapUntil && s.state === 'working' && s.subagents === 0) {
        s.state = 'thinking';
        s.label = '💭 思考中';
        s.activity = null;
        s.gapUntil = 0;
        changed = true;
      }
      if (s.flash && now >= s.flash.until) {
        // A finished turn (or a hello) shouldn't keep saying so forever.
        if (s.state === 'idle' && (s.flash.state === 'done' || s.flash.state === 'greet')) s.label = '';
        s.flash = null;
        changed = true;
      }
      // Silent this long: the terminal was closed without SessionEnd (or it's a test leftover).
      if (now - s.updatedAt > STALE_MS) {
        this.sessions.delete(s.id);
        changed = true;
      }
    }
    if (changed) this.emit();
    else if (this.lastView?.state === 'idle' && now - this.lastActivity > SLEEP_AFTER_MS) this.emit();
  }

  /** Resolve every session to one view: {state, settle, label}. */
  view() {
    const now = Date.now();
    let best = null;
    for (const s of this.sessions.values()) {
      const state = s.flash ? s.flash.state : s.state;
      if (!best || PRIORITY[state] > PRIORITY[best.state]) best = { s, state };
    }
    if (!best) {
      const asleep = now - this.lastActivity > SLEEP_AFTER_MS;
      return { state: asleep ? 'sleep' : 'idle', settle: asleep ? 'sleep' : 'idle', label: '', activity: null, team: [] };
    }
    const { s, state } = best;
    let settle = s.state;
    const team = this.team(s);
    if (state === 'idle' && now - this.lastActivity > SLEEP_AFTER_MS) return { state: 'sleep', settle: 'sleep', label: '💤', activity: null, team };
    // Name the project only when sessions are in different ones.
    const projects = new Set([...this.sessions.values()].map((x) => x.cwd));
    const multi = projects.size > 1 && s.cwd ? `${base(s.cwd)} · ` : '';
    const activity = state === 'working' || state === 'thinking' ? s.activity : null;
    return { state, settle, label: s.label ? multi + s.label : '', activity, team };
  }

  /**
   * Everyone else at work, for the team strip beside the pet: the shown session's
   * subagents, then the other sessions that are busy or waiting on you.
   */
  team(shown) {
    const out = [];
    for (const s of this.sessions.values()) {
      for (const a of s.agents.values()) {
        out.push({ id: a.id, kind: 'subagent', icon: agentIcon(a.type), name: a.type || '子 Agent', label: a.label, state: 'working' });
      }
    }
    for (const s of this.sessions.values()) {
      if (s === shown) continue;
      const state = s.flash ? s.flash.state : s.state;
      if (state === 'idle' || state === 'sleep' || state === 'greet') continue;
      out.push({ id: s.id, kind: 'session', icon: '💼', name: base(s.cwd) || '会话', label: s.label, state });
    }
    return out.slice(0, 8);
  }

  emit() {
    const v = this.view();
    const key = JSON.stringify(v);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.lastView = v;
    this.onChange(v);
  }

  snapshot() {
    return {
      view: this.lastView ?? this.view(),
      sessions: [...this.sessions.values()].map(({ id, cwd, state, label, flash, subagents, tail }) => ({
        id,
        cwd,
        state,
        label,
        flash: flash?.state ?? null,
        subagents,
        watching: Boolean(tail),
      })),
    };
  }
}

module.exports = { AgentSessions, toolLabel, toolActivity, permissionLabel };
