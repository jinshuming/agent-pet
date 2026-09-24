// The team strip: everyone else at work, as little chips beside the pet. The shown
// session's subagents (what each one is doing right now) and other sessions that are
// busy or waiting on you. From AgentSessions.team() in the main process.
import type { AgentState } from './clips';

export type TeamMember = {
  id: string;
  kind: 'subagent' | 'session';
  icon: string;
  name: string;
  label: string;
  state: AgentState;
};

/** A finished chip stays this long with a ✓ before it fades out. */
const DONE_SHOW_MS = 2400;
const MAX_CHIPS = 5;

export class TeamStrip {
  private readonly chips = new Map<string, HTMLDivElement>();

  constructor(private readonly root: HTMLElement) {}

  /** Show `team`; returns how many subagents joined and how many finished since the last update. */
  update(team: TeamMember[]): { started: number; finished: number } {
    let started = 0;
    let finished = 0;
    const live = new Set(team.map((m) => m.id));
    for (const [id, el] of this.chips) {
      if (live.has(id) || el.classList.contains('done')) continue;
      if (el.dataset.kind === 'subagent') finished++;
      this.finish(id, el);
    }
    for (const m of team.slice(0, MAX_CHIPS)) {
      let el = this.chips.get(m.id);
      if (!el || el.classList.contains('done')) {
        el?.remove();
        el = this.chip(m);
        this.chips.set(m.id, el);
        this.root.append(el);
        if (m.kind === 'subagent') started++;
      }
      el.dataset.state = m.state;
      (el.querySelector('.doing') as HTMLElement).textContent = m.label || (m.kind === 'subagent' ? '出发…' : '');
    }
    const more = team.length - MAX_CHIPS;
    this.root.dataset.more = more > 0 ? `+${more}` : '';
    this.root.hidden = this.chips.size === 0;
    return { started, finished };
  }

  /** Stack the chips on the side of him away from the nearest screen edge, from `top` down. */
  place(side: 'left' | 'right', top: number): void {
    this.root.classList.toggle('right', side === 'right');
    this.root.style.top = `${Math.round(top)}px`;
  }

  private chip(m: TeamMember): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'chip';
    el.dataset.kind = m.kind;
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = m.icon;
    const text = document.createElement('span');
    text.className = 'text';
    const name = document.createElement('b');
    name.textContent = m.name;
    const doing = document.createElement('i');
    doing.className = 'doing';
    text.append(name, doing);
    el.append(icon, text);
    return el;
  }

  private finish(id: string, el: HTMLDivElement): void {
    el.classList.add('done');
    (el.querySelector('.doing') as HTMLElement).textContent = el.dataset.kind === 'subagent' ? '✓ 完成' : '';
    window.setTimeout(() => {
      if (this.chips.get(id) !== el) return;
      el.remove();
      this.chips.delete(id);
      this.root.hidden = this.chips.size === 0;
    }, DONE_SHOW_MS);
  }
}
