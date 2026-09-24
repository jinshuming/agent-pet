// Combines agent state, user reactions and dragging into one motion.
// Priority (after CoPet): dragging / flying / hanging > critical agent state > reaction > agent state.
import type { SplatPetRenderer } from '../render/SplatPetRenderer';
import {
  ACTIVITY_CLIPS,
  AGENT_SEQUENCES,
  BOREDOM,
  BUSY,
  BUSY_DWELL_MS,
  DRAG_SEQUENCE,
  HANG,
  HANG_SEQUENCE,
  LEAN_CLIPS,
  PERMISSION_ALTERNATE_MS,
  PERMISSION_STAGES,
  REACTION_SEQUENCES,
  REST_MS,
  REST_SLEEPY_MS,
  THINK_CLIPS,
  THINK_VARY_MS,
  type Activity,
  type AgentState,
  type ClipName,
  type Fidget,
  type Reaction,
  type Step,
  type Wall,
} from './clips';
import {
  ACCEPT_LINES,
  FLY_LINES,
  HANG_LINES,
  HANG_POKE_LINES,
  HANG_TIRED_LINES,
  LEAN_LINES,
  PERMISSION_NAG_LINES,
  REACTION_LINES,
  REST_LINES,
  STATE_LINES,
  TEAM_LINES,
  pick,
} from './lines';

const CRITICAL: ReadonlySet<AgentState> = new Set(['permission', 'error']);
/** Agent states that leave him free to rest. */
const RESTFUL: ReadonlySet<AgentState> = new Set(['idle', 'sleep']);
/** Coming from one of these into thinking/working means a new task: he rolls up his sleeves first. */
const UNOCCUPIED: ReadonlySet<AgentState> = new Set(['idle', 'sleep', 'done', 'greet']);

/**
 * How much he looks at the cursor: `head` turns the neck and head, `body` the whole body.
 * `wander`: with the cursor parked he looks around on his own. `fast`: snap to it (he wants you).
 */
export type Gaze = { head: number; body: number; wander: boolean; fast: boolean };
const NO_GAZE: Gaze = { head: 0, body: 0, wander: false, fast: false };

const rand = (r: { min: number; max: number }) => r.min + Math.random() * (r.max - r.min);

/** Left alone: walking to a wall, sat against it, nodding off, asleep, or getting back up. */
export type Rest = 'walking' | 'sitting' | 'dozing' | 'asleep' | 'standing';

/** Why he lets go of the top edge: arms gave out, knocked off, or the agent needs you. */
export type LetGoReason = 'tired' | 'poked' | 'critical';

/** Hands on the edge: two, one slipping off, one, or already letting go. */
type Grip = 'two' | 'slipping' | 'one' | 'falling';

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
  /** The kind of work, while thinking or working (the tool the agent runs). */
  private activity: Activity | null = null;
  /**
   * The one-shot currently playing over the agent state ('preview' = from the menu,
   * 'fidget' = idle life, 'team' = a subagent reporting back).
   */
  private reaction: Reaction | 'preview' | 'fidget' | 'team' | null = null;
  private fidgetTimer: number | undefined;
  private lastFidget: ClipName | null = null;
  /** How long he's been left with nothing to do (from main.ts, every frame): how bored he is. */
  private quietMs = 0;
  // Busy (thinking / working): which loop plays, since when, and the timers that change it.
  private pendingAccept = false;
  private busyClip: ClipName | null = null;
  private busySince = 0;
  private thinkClip: ClipName = THINK_CLIPS[0];
  private dwellTimer: number | undefined;
  private varyTimer: number | undefined;
  private lineTimer: number | undefined;
  // Waiting on you: since when, and the timer that makes him more insistent.
  private permissionSince = 0;
  private nagTimer: number | undefined;
  private dragging = false;
  /** You're steering him (game mode, see game.ts): the body is yours, agent motions wait. */
  private gaming = false;
  /** Thrown through the air, or hanging from the top edge. Agent motions wait until he lands. */
  private airborne: 'flying' | 'hanging' | null = null;
  /** Standing against a side of the screen: idle becomes leaning on it. */
  private wall: Wall | null = null;
  private rest: Rest | null = null;
  /** The side he's walking to or sitting against. */
  private restSide: Wall | null = null;
  // Hanging from the top edge (see HANG).
  private grip: Grip = 'two';
  private hangSince = 0;
  /** Grip spent struggling against pokes, on top of the time he's hung. */
  private hangSpentMs = 0;
  private oneArmMs = 0;
  /** A one-shot (slipping, struggling) is playing over the hang loop. */
  private hangAction = false;

  constructor(
    private readonly renderer: SplatPetRenderer,
    private readonly onLabel: (text: string) => void,
    /** Ask main to drop him from the top edge (the agent needs attention). */
    private readonly onLetGo: (reason: LetGoReason) => void = () => {},
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

  /**
   * Called every frame with how long he's been left alone; walks him to a wall and puts him to sleep.
   * Once every agent is asleep he's drowsy and does it much sooner.
   */
  restTick(quietMs: number): void {
    this.quietMs = quietMs;
    if (!this.isFree) return;
    const ms = this.agent === 'sleep' ? REST_SLEEPY_MS : REST_MS;
    if (this.rest === null && quietMs >= ms.sit) {
      this.reaction = null; // cut a fidget short
      if (this.wall) return this.sitDown(this.wall);
      this.rest = 'walking';
      this.restSide = this.restHooks.walk();
      this.onLabel(pick(REST_LINES.walk));
      this.renderer.play([{ clip: 'walk', loop: true }]);
      return;
    }
    if (this.rest === 'sitting' && quietMs >= ms.sleep) this.doze();
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

  /** Dragged, flying, hanging or in game mode: the body is busy, so agent motions and reactions wait. */
  private get held(): boolean {
    return this.dragging || this.airborne !== null || this.gaming;
  }

  /** Game mode takes the body over; leaving it hands back to the agent state (or to a flight main starts). */
  setGame(on: boolean): void {
    if (on === this.gaming) return;
    this.gaming = on;
    this.dragging = false;
    this.airborne = null;
    this.wall = null;
    this.reaction = null;
    if (on) {
      if (this.rest === 'walking') this.restHooks.stop();
      this.endRest();
      this.renderer.setTint(0);
      this.stopBusy();
      window.clearTimeout(this.fidgetTimer);
      window.clearTimeout(this.nagTimer);
    } else this.applyAgent();
  }

  get isGaming(): boolean {
    return this.gaming;
  }

  setAgentState(state: AgentState, settle: AgentState = 'idle', label = '', activity: Activity | null = null): void {
    const prev = this.agent;
    const same = state === prev;
    const activityChanged = activity !== this.activity;
    this.settle = settle;
    this.label = label;
    this.activity = activity;
    if (state !== 'permission') {
      window.clearTimeout(this.nagTimer);
      this.permissionSince = 0;
    } else if (!same) this.permissionSince = performance.now();
    // Consecutive tool calls re-send "working": keep the loop (and any reaction) running,
    // but a different kind of tool gets its own motion (once the current one has had its moment).
    if (same && !this.held) {
      if (this.reaction) return;
      this.say(state === 'permission' ? this.permissionLine() : this.agentLine());
      if (BUSY.has(state) && activityChanged && !this.rest) this.busyChanged();
      return;
    }
    // A new task after doing nothing: he gets ready for it first.
    this.pendingAccept = BUSY.has(state) && (UNOCCUPIED.has(prev) || this.pendingAccept);
    this.agent = state;
    // Thinking ↔ working flips with every tool call: change the motion, but not faster than BUSY_DWELL_MS,
    // and let a reaction (an impatient "wait") finish first.
    if (BUSY.has(prev) && BUSY.has(state) && !this.held && !this.rest) {
      if (this.reaction) return;
      this.say(this.agentLine());
      this.busyChanged();
      return;
    }
    this.reaction = null;
    // The agent has work: he gets up off the floor first (wake re-applies the state after).
    if (this.rest && !RESTFUL.has(state)) {
      this.wake();
      return;
    }
    // Hanging around while the agent needs you would hide the plea: let go and come down.
    if (this.airborne === 'hanging' && CRITICAL.has(state)) this.letGo('critical');
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
    this.grip = 'two';
    this.hangSince = performance.now();
    this.hangSpentMs = 0;
    this.oneArmMs = HANG.oneArmMs.min + Math.random() * (HANG.oneArmMs.max - HANG.oneArmMs.min);
    this.hangAction = false;
    this.onLabel(pick(HANG_LINES));
    this.renderer.play(HANG_SEQUENCE);
  }

  /** Called every frame: his grip wears out. Both hands, then one, then he drops. */
  hangTick(now: number): void {
    if (this.airborne !== 'hanging' || this.hangAction) return;
    const t = now - this.hangSince + this.hangSpentMs;
    if (this.grip === 'two' && t >= HANG.twoHandMs) this.slipOneHand();
    else if (this.grip === 'one' && t >= HANG.twoHandMs + this.oneArmMs) this.letGo('tired');
  }

  /** A slow poke while he hangs: he kicks and twists to shake it off, which tires him faster. */
  hangPoke(): void {
    if (this.airborne !== 'hanging' || this.grip === 'falling') return;
    this.hangSpentMs += HANG.pokeCostMs;
    this.onLabel(pick(HANG_POKE_LINES[this.grip === 'two' ? 'two' : 'one']));
    if (this.hangAction) return; // already struggling (or slipping): the line is enough
    this.hangAction = true;
    const clip = this.grip === 'two' ? 'hangStruggle' : 'hangSlip';
    this.renderer.play([{ clip, loop: false }], () => {
      if (this.airborne !== 'hanging') return;
      this.hangAction = false;
      this.resumeHang();
    });
  }

  /** Let go of the top edge (main flies him down and reports the landing). */
  letGo(reason: LetGoReason): void {
    if (this.airborne !== 'hanging' || this.grip === 'falling') return;
    this.grip = 'falling';
    this.onLetGo(reason);
  }

  private slipOneHand(): void {
    this.grip = 'slipping';
    this.hangAction = true;
    this.onLabel(pick(HANG_TIRED_LINES));
    this.renderer.play([{ clip: 'hangLoseGrip', loop: false }], () => {
      if (this.airborne !== 'hanging') return;
      this.grip = 'one';
      this.hangAction = false;
      this.resumeHang();
    });
  }

  private resumeHang(): void {
    this.renderer.play(this.grip === 'two' ? HANG_SEQUENCE : [{ clip: 'hangOneArm', loop: true }]);
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

  /** Working shows what the agent is doing, waiting shows what it's asking; other states speak in the idol's voice. */
  private agentLine(): string {
    if (this.agent === 'working' || (this.agent === 'permission' && this.label)) return this.label;
    if (this.agent === 'thinking' && this.activity === 'tidy') return this.label;
    return pick(STATE_LINES[this.agent]) || this.label;
  }

  /** The question, with a nudge in front once he's been waiting a while. */
  private permissionLine(stage = this.permissionStage().index): string {
    const nag = pick(PERMISSION_NAG_LINES[stage]);
    return nag ? `${nag}\n${this.agentLine()}` : this.agentLine();
  }

  /** Show a line; a later say() (or setAgentState) replaces it. */
  private say(text: string): void {
    window.clearTimeout(this.lineTimer);
    this.onLabel(text);
  }

  /** Show a line for `ms`, then go back to saying what the agent is doing. */
  private sayFor(text: string, ms: number): void {
    this.say(text);
    this.lineTimer = window.setTimeout(() => {
      if (!this.reaction && !this.held && !this.rest) this.onLabel(this.agentLine());
    }, ms);
  }

  /** Dev (/debug/pet): what the controller thinks is going on. */
  debugState(): Record<string, unknown> {
    return {
      agent: this.agent,
      activity: this.activity,
      reaction: this.reaction,
      dragging: this.dragging,
      gaming: this.gaming,
      airborne: this.airborne,
      wall: this.wall,
      rest: this.rest,
      busyClip: this.busyClip,
      clip: this.renderer.currentClip,
      quietS: Math.round(this.quietMs / 1000),
    };
  }

  /** How much he looks at the cursor right now (see Gaze). */
  get gaze(): Gaze {
    if (this.gaming) return NO_GAZE;
    if (this.dragging || this.airborne === 'flying') return NO_GAZE;
    if (this.airborne === 'hanging') return { head: 0.5, body: 0, wander: false, fast: false };
    if (this.rest) return this.rest === 'sitting' ? { head: 0.8, body: 0, wander: true, fast: false } : NO_GAZE;
    if (this.reaction === 'fidget') return { head: 0.35, body: 0.5, wander: false, fast: false };
    if (this.reaction) return { head: 0.3, body: 0.6, wander: false, fast: false };
    if (this.isLeaning) return { head: 0.8, body: 0, wander: true, fast: false };
    switch (this.agent) {
      case 'permission':
        return { head: 1, body: 1, wander: false, fast: true };
      case 'thinking':
        return { head: 0.5, body: 0.35, wander: false, fast: false };
      case 'working':
        return { head: 0.35, body: 0.25, wander: false, fast: false };
      case 'error':
        return { head: 0.3, body: 0.5, wander: false, fast: false };
      default: // idle, greet, done, sleep
        return { head: 1, body: 0.7, wander: this.agent === 'idle' || this.agent === 'sleep', fast: false };
    }
  }

  /** A subagent finished and reported back: a nod, then back to supervising. */
  teamReport(): void {
    if (this.held || this.rest || this.reaction || !BUSY.has(this.agent)) return;
    this.reaction = 'team';
    this.say(pick(TEAM_LINES.report));
    this.renderer.play([{ clip: 'report', loop: false }], () => {
      if (this.reaction !== 'team') return;
      this.reaction = null;
      this.applyAgent();
    });
  }

  // ---------- busy: thinking and working ----------

  /** The loop for what the agent is doing now: by kind of tool, or one of the ways of thinking. */
  private busyTarget(): ClipName {
    if (this.activity && (this.agent === 'working' || this.activity === 'tidy')) return ACTIVITY_CLIPS[this.activity];
    return this.agent === 'working' ? 'typing' : this.thinkClip;
  }

  /** The agent moved on to another kind of work: switch motions once the current one has played BUSY_DWELL_MS. */
  private busyChanged(): void {
    window.clearTimeout(this.dwellTimer);
    const wait = this.busySince + BUSY_DWELL_MS - performance.now();
    if (wait > 0) {
      this.dwellTimer = window.setTimeout(() => this.busyChanged(), wait);
      return;
    }
    if (this.held || this.rest || this.reaction || !BUSY.has(this.agent)) return;
    if (this.busyTarget() !== this.busyClip) this.playBusy();
  }

  private playBusy(intro: Step[] = []): void {
    const clip = this.busyTarget();
    const steps = [...intro];
    // Subagents going out: send them off before settling in to watch them.
    if (clip === 'supervise' && this.busyClip !== 'supervise') {
      steps.push({ clip: 'dispatch', loop: false });
      if (!intro.length) this.sayFor(pick(TEAM_LINES.dispatch), 3000);
    }
    steps.push({ clip, loop: true });
    this.busyClip = clip;
    this.busySince = performance.now();
    this.renderer.play(steps);
    this.scheduleThinkVariation();
  }

  /** Thinking for a long time: now and then he thinks a different way (scratching his head, counting on his fingers). */
  private scheduleThinkVariation(): void {
    window.clearTimeout(this.varyTimer);
    if (this.agent !== 'thinking' || this.activity) return;
    this.varyTimer = window.setTimeout(() => {
      if (this.agent !== 'thinking' || this.activity || this.held || this.rest) return;
      if (this.reaction) return this.scheduleThinkVariation();
      const others = THINK_CLIPS.filter((c) => c !== this.thinkClip);
      this.thinkClip = others[Math.floor(Math.random() * others.length)];
      this.playBusy();
    }, rand(THINK_VARY_MS));
  }

  private stopBusy(): void {
    window.clearTimeout(this.dwellTimer);
    window.clearTimeout(this.varyTimer);
    this.busyClip = null;
  }

  // ---------- waiting on you ----------

  /** Which PERMISSION_STAGES entry applies after waiting this long, and how long until the next one. */
  private permissionStage(): { index: number; nextMs: number } {
    const t = performance.now() - this.permissionSince;
    const last = PERMISSION_STAGES.length - 1;
    const lastAt = PERMISSION_STAGES[last].afterMs;
    if (t < lastAt) {
      let index = 0;
      while (index < last && t >= PERMISSION_STAGES[index + 1].afterMs) index++;
      return { index, nextMs: PERMISSION_STAGES[index + 1].afterMs - t };
    }
    // Past the last stage: take turns with the one before it.
    const k = Math.floor((t - lastAt) / PERMISSION_ALTERNATE_MS);
    return { index: k % 2 === 0 ? last : last - 1, nextMs: PERMISSION_ALTERNATE_MS - ((t - lastAt) % PERMISSION_ALTERNATE_MS) };
  }

  private playPermission(): void {
    window.clearTimeout(this.nagTimer);
    if (!this.permissionSince) this.permissionSince = performance.now();
    const { index, nextMs } = this.permissionStage();
    this.say(this.permissionLine(index));
    this.renderer.play([{ clip: PERMISSION_STAGES[index].clip, loop: true }]);
    this.nagTimer = window.setTimeout(() => {
      if (this.agent === 'permission' && !this.held && !this.reaction && !this.rest) this.playPermission();
    }, nextMs + 50);
  }

  /** Replay the current agent state from the start (e.g. after the character changed). */
  refresh(): void {
    this.reaction = null;
    if (this.airborne === 'hanging') {
      this.hangAction = false;
      if (this.grip === 'slipping') this.grip = 'one';
      this.resumeHang(); // a character swap mid-hang must not leave him standing in the air
    } else if (!this.held) this.applyAgent();
  }

  /** How bored he is: the BOREDOM tier for how long he's had nothing to do. */
  private boredom(): (typeof BOREDOM)[number] {
    let tier = BOREDOM[0];
    for (const t of BOREDOM) if (this.quietMs >= t.afterMs) tier = t;
    return tier;
  }

  /** While idle (and nothing else is playing), queue the next little idle action; the more bored, the sooner. */
  private scheduleFidget(): void {
    window.clearTimeout(this.fidgetTimer);
    if (this.agent !== 'idle' || this.wall) return;
    this.fidgetTimer = window.setTimeout(() => {
      if (this.agent !== 'idle' || this.reaction || this.held || this.rest || this.wall) return this.scheduleFidget();
      const pool = this.boredom().fidgets.filter((f) => f.clip !== this.lastFidget);
      const f: Fidget = pool[Math.floor(Math.random() * pool.length)];
      this.lastFidget = f.clip;
      this.reaction = 'fidget';
      this.say(pick(f.lines));
      this.renderer.play([{ clip: f.clip, loop: false }], () => {
        this.reaction = null;
        this.applyAgent();
      });
    }, rand(this.boredom().every));
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
    const tint = state === 'error' ? ERROR_TINT : null;
    this.renderer.setTint(tint?.intensity ?? 0, tint?.color);
    if (!BUSY.has(state)) this.stopBusy();
    if (state === 'permission') return this.playPermission();
    if (BUSY.has(state)) {
      // A new task: "got it!", roll up the sleeves, then get to it.
      if (this.pendingAccept) {
        this.pendingAccept = false;
        this.sayFor(pick(ACCEPT_LINES), 2600);
        return this.playBusy([{ clip: 'accept', loop: false }]);
      }
      this.say(this.agentLine());
      return this.playBusy();
    }
    this.say(this.agentLine());
    if (state === 'idle' && this.wall) return this.lean(this.wall);
    this.renderer.play(AGENT_SEQUENCES[state], () => {
      // Transient states (done, error) settle once their motion ends.
      if (this.agent !== state || this.reaction || this.held) return;
      this.agent = this.settle;
      this.applyAgent();
    });
  }
}
