// Combines agent state, user reactions and dragging into one motion.
// Priority (after CoPet): dragging / flying / hanging > critical agent state > reaction > agent state.
import type { SplatPetRenderer } from '../render/SplatPetRenderer';
import {
  AGENT_SEQUENCES,
  BUSY,
  DRAG_SEQUENCE,
  HANG_SEQUENCE,
  IDLE_FIDGETS,
  IDLE_FIDGET_MS,
  LEAN_CLIPS,
  REACTION_SEQUENCES,
  REST_MS,
  type AgentState,
  type Reaction,
  type Step,
  type Wall,
} from './clips';
import { FLY_LINES, HANG_LINES, LEAN_LINES, REACTION_LINES, REST_LINES, STATE_LINES, pick } from './lines';

const CRITICAL: ReadonlySet<AgentState> = new Set(['permission', 'error']);
/** Agent states that leave him free to rest. */
const RESTFUL: ReadonlySet<AgentState> = new Set(['idle', 'sleep']);

/** Left alone: walking to a wall, sat against it, nodding off, asleep, or getting back up. */
export type Rest = 'walking' | 'sitting' | 'dozing' | 'asleep' | 'standing';

export type RestHooks = {
  /** Start walking to the nearest side of the screen; returns which side. */
  walk(): Wall;
  /** Stop a walk in progress. */
  stop(): void;
  /** He has sat down against `wall` (the window can now be fitted to it). */
  sat(wall: Wall): void;
};
const SLEEP_TINT = { intensity: 0.35, color: { r: 0.15, g: 0.18, b: 0.35 } };
const ERROR_TINT = { intensity: 0.3, color: { r: 1, g: 0.15, b: 0.1 } };

export class PetController {
  private agent: AgentState = 'idle';
  /** Where a transient state (done / error) settles once its motion ends. */
  private settle: AgentState = 'idle';
  /** What the agent is doing, from the main process (e.g. "✏️ main.ts"). */
  private label = '';
  /** The one-shot currently playing over the agent state ('preview' = from the menu, 'fidget' = idle life). */
  private reaction: Reaction | 'preview' | 'fidget' | null = null;
  private fidgetTimer: number | undefined;
  private dragging = false;
  /** Thrown through the air, or hanging from the top edge. Agent motions wait until he lands. */
  private airborne: 'flying' | 'hanging' | null = null;
  /** Standing against a side of the screen: idle becomes leaning on it. */
  private wall: Wall | null = null;
  private rest: Rest | null = null;
  /** The side he's walking to or sitting against. */
  private restSide: Wall | null = null;

  constructor(
    private readonly renderer: SplatPetRenderer,
    private readonly onLabel: (text: string) => void,
    /** Ask main to drop him from the top edge (the agent needs attention). */
    private readonly onLetGo: () => void = () => {},
    /** He has leaned in and is holding the pose (the window can now be fitted to the wall). */
    private readonly onLeaning: (wall: Wall) => void = () => {},
    private readonly restHooks: RestHooks = { walk: () => 'right', stop: () => {}, sat: () => {} },
  ) {
    this.applyAgent();
  }

  get agentState(): AgentState {
    return this.agent;
  }

  get isAirborne(): boolean {
    return this.airborne !== null;
  }

  get isHanging(): boolean {
    return this.airborne === 'hanging';
  }

  get isLeaning(): boolean {
    return this.wall !== null && this.agent === 'idle' && !this.held && !this.reaction;
  }

  get isResting(): boolean {
    return this.rest !== null;
  }

  get isWalking(): boolean {
    return this.rest === 'walking';
  }

  /** What the renderer needs to turn him: walking toward, or sitting against, `side`. */
  get restPose(): { rest: Rest; side: Wall } | null {
    return this.rest && this.restSide ? { rest: this.rest, side: this.restSide } : null;
  }

  /**
   * Nothing is keeping him busy: the agent is idle or asleep, nobody is holding him,
   * and nothing but an idle fidget is playing. The rest clock only runs while this holds.
   */
  get isFree(): boolean {
    return RESTFUL.has(this.agent) && !this.held && this.rest !== 'standing' && (this.reaction === null || this.reaction === 'fidget');
  }

  /** Called every frame with how long he's been left alone; walks him to a wall and puts him to sleep. */
  restTick(quietMs: number): void {
    if (!this.isFree) return;
    if (this.rest === null && quietMs >= REST_MS.sit) {
      this.reaction = null; // cut a fidget short
      if (this.wall) return this.sitDown(this.wall);
      this.rest = 'walking';
      this.restSide = this.restHooks.walk();
      this.onLabel(pick(REST_LINES.walk));
      this.renderer.play([{ clip: 'walk', loop: true }]);
      return;
    }
    if (this.rest === 'sitting' && quietMs >= REST_MS.sleep) this.doze();
  }

  /** Touched, or the agent got busy: get up (or stop walking). Returns whether he was resting. */
  wake(): boolean {
    if (!this.rest) return false;
    if (this.rest === 'standing') return true;
    if (this.rest === 'walking') {
      this.restHooks.stop();
      this.endRest();
      this.applyAgent();
      return true;
    }
    this.rest = 'standing';
    this.renderer.setTint(0);
    this.onLabel(pick(REST_LINES.wake));
    this.renderer.play([{ clip: 'standUp', loop: false }], () => {
      if (this.rest !== 'standing') return;
      this.endRest();
      this.applyAgent(); // still against the wall: he goes on to lean on it
    });
    return true;
  }

  private endRest(): void {
    this.rest = null;
    this.restSide = null;
  }

  private sitDown(wall: Wall): void {
    this.rest = 'sitting';
    this.restSide = wall;
    this.onLabel(pick(REST_LINES.sit));
    this.renderer.play([{ clip: 'sitDown', loop: false }], () => {
      if (this.rest !== 'sitting') return;
      this.renderer.play([{ clip: 'sitIdle', loop: true }]);
      this.restHooks.sat(wall);
    });
  }

  private doze(): void {
    this.rest = 'dozing';
    this.onLabel(pick(REST_LINES.doze));
    this.renderer.setTint(SLEEP_TINT.intensity * 0.5, SLEEP_TINT.color);
    this.renderer.play([{ clip: 'sitDoze', loop: false }], () => {
      if (this.rest !== 'dozing') return;
      this.rest = 'asleep';
      this.onLabel(pick(REST_LINES.asleep));
      this.renderer.setTint(SLEEP_TINT.intensity, SLEEP_TINT.color);
      this.renderer.play([{ clip: 'sitSleep', loop: true }]);
    });
  }

  /** Dragged, flying or hanging: the body is busy, so agent motions and reactions wait. */
  private get held(): boolean {
    return this.dragging || this.airborne !== null;
  }

  setAgentState(state: AgentState, settle: AgentState = 'idle', label = ''): void {
    const same = state === this.agent;
    this.settle = settle;
    this.label = label;
    // Consecutive tool calls re-send "working": keep the loop (and any reaction) running.
    if (same && !this.held) {
      if (!this.reaction) this.onLabel(this.agentLine());
      return;
    }
    this.agent = state;
    this.reaction = null;
    // The agent has work: he gets up off the floor first (wake re-applies the state after).
    if (this.rest && !RESTFUL.has(state)) {
      this.wake();
      return;
    }
    // Hanging around while the agent needs you would hide the plea: let go and come down.
    if (this.airborne === 'hanging' && CRITICAL.has(state)) this.onLetGo();
    if (!this.held) this.applyAgent();
  }

  /**
   * A click-type reaction. While the agent is busy, every click gets the impatient one.
   * Getting dizzy isn't a choice: it plays whatever the agent is doing.
   */
  react(reaction: Reaction): void {
    // Poking him while he sits or sleeps wakes him instead.
    if (this.rest && this.wake()) return;
    const dizzy = reaction === 'dizzy';
    if (this.held || (CRITICAL.has(this.agent) && !dizzy)) return;
    const r: Reaction = BUSY.has(this.agent) && reaction !== 'drop' && !dizzy ? 'busyPoke' : reaction;
    this.onLabel(pick(REACTION_LINES[r]));
    // Spamming clicks while he's already telling you to wait just changes the line.
    if (r === 'busyPoke' && this.reaction === 'busyPoke') return;
    this.reaction = r;
    this.renderer.play(REACTION_SEQUENCES[r], () => {
      this.reaction = null;
      this.applyAgent();
    });
  }

  /**
   * Menu preview: play any motion once, bypassing the usual state rules
   * (busy remapping, critical-state blocking), then return to the agent state.
   */
  preview(steps: Step[], line: string): void {
    if (this.held) return;
    this.reaction = 'preview';
    this.onLabel(line);
    this.renderer.play(steps, () => {
      this.reaction = null;
      this.applyAgent();
    });
  }

  beginDrag(): void {
    this.dragging = true;
    this.endRest();
    this.airborne = null;
    this.wall = null;
    this.reaction = null;
    this.onLabel('放我下来！');
    this.renderer.play(DRAG_SEQUENCE);
  }

  endDrag(): void {
    this.dragging = false;
    this.land(false);
  }

  /** Flung, or let go of the top edge: flail until main reports the landing. */
  fly(reason: keyof typeof FLY_LINES = 'fling'): void {
    this.dragging = false;
    // Hopping down from a ledge at the end of a walk to the wall: still on his way to sit.
    if (reason !== 'hop') this.endRest();
    this.airborne = 'flying';
    this.wall = null;
    this.reaction = null;
    this.onLabel(pick(FLY_LINES[reason] ?? FLY_LINES.fling));
    this.renderer.play(DRAG_SEQUENCE);
  }

  /** Holding on to the top edge of the screen (the renderer lifts him so his hands reach it). */
  hang(): void {
    this.dragging = false;
    this.endRest();
    this.airborne = 'hanging';
    this.wall = null;
    this.reaction = null;
    this.onLabel(pick(HANG_LINES));
    this.renderer.play(HANG_SEQUENCE);
  }

  /** Back on the ground, maybe against a side of the screen. A hard landing leaves him dizzy. */
  land(hard: boolean, wall: Wall | null = null): void {
    this.airborne = null;
    this.wall = wall;
    // Arrived at the wall he was walking to: sit down against it.
    if (this.rest === 'walking') {
      if (wall && !hard) return this.sitDown(wall);
      this.endRest();
    }
    // Set down against a wall: no stumble, he goes straight to leaning (when idle).
    if (CRITICAL.has(this.agent) || (wall && !hard)) this.applyAgent();
    else this.react(hard ? 'dizzy' : 'drop');
  }

  /** Working shows what the agent is doing; other states speak in the idol's voice. */
  private agentLine(): string {
    if (this.agent === 'working') return this.label;
    return pick(STATE_LINES[this.agent]) || this.label;
  }

  /** Replay the current agent state from the start (e.g. after the character changed). */
  refresh(): void {
    this.reaction = null;
    if (!this.held) this.applyAgent();
  }

  /** While idle (and nothing else is playing), queue the next little idle action. */
  private scheduleFidget(): void {
    window.clearTimeout(this.fidgetTimer);
    if (this.agent !== 'idle' || this.wall) return;
    const delay = IDLE_FIDGET_MS.min + Math.random() * (IDLE_FIDGET_MS.max - IDLE_FIDGET_MS.min);
    this.fidgetTimer = window.setTimeout(() => {
      if (this.agent !== 'idle' || this.reaction || this.held || this.rest) return this.scheduleFidget();
      const f = IDLE_FIDGETS[Math.floor(Math.random() * IDLE_FIDGETS.length)];
      this.reaction = 'fidget';
      this.onLabel(pick(f.lines));
      this.renderer.play(f.steps, () => {
        this.reaction = null;
        this.applyAgent();
      });
    }, delay);
  }

  /** Back to the rest pose after something interrupted it (a menu preview, a character swap). */
  private resumeRest(): void {
    const loop = { walking: 'walk', sitting: 'sitIdle', dozing: 'sitSleep', asleep: 'sitSleep' } as const;
    if (this.rest === 'standing') return; // its own callback takes over
    const asleep = this.rest === 'asleep' || this.rest === 'dozing';
    this.renderer.setTint(asleep ? SLEEP_TINT.intensity : 0, SLEEP_TINT.color);
    this.onLabel(pick(REST_LINES[asleep ? 'asleep' : this.rest === 'walking' ? 'walk' : 'sit']));
    this.renderer.play([{ clip: loop[this.rest!], loop: true }]);
  }

  /** Idle against a wall: lean in, then hold the cool pose until something else happens. */
  private lean(wall: Wall): void {
    const { enter, hold } = LEAN_CLIPS[wall];
    this.onLabel(pick(LEAN_LINES));
    this.renderer.play([{ clip: enter, loop: false }], () => {
      if (this.agent !== 'idle' || this.reaction || this.held || this.wall !== wall) return;
      this.renderer.play([{ clip: hold, loop: true }]);
      this.onLeaning(wall);
    });
  }

  private applyAgent(): void {
    // Resting keeps its own pose; only getting up (wake) hands back to the agent state.
    if (this.rest) return this.resumeRest();
    this.scheduleFidget();
    const state = this.agent;
    this.onLabel(this.agentLine());
    const tint = state === 'sleep' ? SLEEP_TINT : state === 'error' ? ERROR_TINT : null;
    this.renderer.setTint(tint?.intensity ?? 0, tint?.color);
    if (state === 'idle' && this.wall) return this.lean(this.wall);
    this.renderer.play(AGENT_SEQUENCES[state], () => {
      // Transient states (done, error) settle once their motion ends.
      if (this.agent !== state || this.reaction || this.held) return;
      this.agent = this.settle;
      this.applyAgent();
    });
  }
}
