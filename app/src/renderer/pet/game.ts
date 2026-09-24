// Game mode: you steer him around the desktop like a side-scroller.
// A/D (or ←/→) run, Space / W / ↑ jump (again in the air for a double jump, or off a
// side of the screen for a wall jump), S / ↓ crouch, or drop faster in the air.
// The floor is the top of the Dock, the walls are the sides of the screen, the ceiling
// is the menu bar. The physics runs here, once per drawn frame, and main just puts the
// window where it's told; the pet's own motions (agent states, reactions) wait meanwhile.
import type { SplatPetRenderer } from '../render/SplatPetRenderer';
import type { ClipName, Step } from './clips';

/** Tuned in metres (the renderer converts), so every size of pet plays the same. */
const G = {
  /** The run clip's own stride speed (make-in-place); running plays it `runPlayback`× faster. */
  runClipMps: 2.43,
  runPlayback: 1.5,
  /** Seconds to reach full speed / to stop, on the ground and in the air. */
  accelS: 0.08,
  stopS: 0.06,
  airAccelS: 0.16,
  gravity: 30, // m/s²
  fallGravity: 1.5, // × gravity on the way down: a snappier arc
  fastFallGravity: 3, // × gravity holding S in the air
  maxFall: 22, // m/s
  jumpHeight: 1.6, // m, about his own height
  doubleJump: 0.85, // × the first jump's speed
  /** Letting go of jump on the way up cuts the rise to this share: tap for a hop, hold for a leap. */
  jumpCut: 0.45,
  coyoteS: 0.09, // still allowed to jump just after leaving the ground…
  bufferS: 0.12, // …and a press just before landing counts
  wallSlide: 3.5, // m/s: holding into a wall slows the fall
  wallJumpLockS: 0.18, // after a wall jump, pushing back toward the wall waits this long
  hardLanding: 17, // m/s downward: he lands heavily
};
/** Where the feet stand, as a fraction of the window height (main.cjs FEET_AT). */
const FEET_AT = 0.85;
/** Half the standing silhouette's width, as a fraction of the window width (main.cjs BODY_HALF_W). */
const BODY_HALF_W = 0.13;
/** Facing: side-on while moving, three-quarters toward you (so you see his face) standing. */
const RUN_YAW = 90;
const STAND_YAW = 30;
const FADE = 0.1;

type Anim = 'stand' | 'run' | 'crouch' | 'air' | 'land' | 'hardLand';
const ANIMS: Record<Anim, Step[]> = {
  stand: [{ clip: 'breathe', loop: true, fade: 0.2 }],
  run: [{ clip: 'gameRun', loop: true, fade: FADE }],
  crouch: [{ clip: 'gameCrouch', loop: true, fade: 0.15 }],
  // Plays once and holds its last frame until he lands.
  air: [{ clip: 'gameJump', loop: false, fade: 0.06 }],
  land: [{ clip: 'gameLand', loop: false, fade: 0.06 }],
  hardLand: [{ clip: 'land', loop: false, fade: 0.06 }],
};
export const GAME_CLIPS: ClipName[] = ['gameRun', 'gameJump', 'gameLand', 'gameCrouch', 'land'];

const KEYS: Record<string, 'left' | 'right' | 'down' | 'jump'> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyW: 'jump',
  ArrowUp: 'jump',
  Space: 'jump',
};

export const GAME_HINT = 'A/D 跑 · 空格跳（可二段跳、蹬墙跳）· S 蹲\nEsc 退出游戏';
const PAUSED_HINT = '点我一下继续玩\nEsc 退出';

export class GameMode {
  private on = false;
  private held = { left: false, right: false, down: false, jump: false };
  // Window top-left, in screen px, and velocity in px/s (y grows downward).
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private grounded = true;
  /** Which side of the screen he's touching, if any. */
  private wall: -1 | 0 | 1 = 0;
  private facing: -1 | 1 = 1;
  private airJumps = 1;
  private sinceGround = 0;
  private sincePress = Infinity;
  private wallLock = 0;
  private yaw = 0;
  private anim: Anim | null = null;
  private placed = '';
  private hintTimer: number | undefined;

  constructor(
    private readonly renderer: SplatPetRenderer,
    private readonly place: (x: number, y: number) => void,
    private readonly say: (text: string) => void,
  ) {}

  get active(): boolean {
    return this.on;
  }

  /** Start from where the window is now (screen px), standing wherever he stands. */
  start(x: number, y: number): void {
    this.on = true;
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    this.held = { left: false, right: false, down: false, jump: false };
    this.sincePress = Infinity;
    // Put down in mid-air earlier (the pet can stand anywhere): he falls to the floor.
    this.grounded = this.y >= this.bounds().floor - 1;
    this.sinceGround = 0;
    this.anim = null;
    this.placed = '';
    this.yaw = 0;
    void this.renderer.preload(GAME_CLIPS);
    this.hint(GAME_HINT, 5000);
  }

  /** Back to being a pet: how fast he was moving (px/s), so main can fly the rest of a jump. */
  stop(): { vx: number; vy: number; grounded: boolean } {
    this.on = false;
    window.clearTimeout(this.hintTimer);
    this.renderer.setPlaybackSpeed(1);
    return { vx: this.vx, vy: this.vy, grounded: this.grounded };
  }

  /** The window moved or resized under us (a size change grows it around the feet). */
  resync(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.placed = '';
  }

  /** A character swap restarted the motion: play ours again. */
  refresh(): void {
    const a = this.anim;
    this.anim = null;
    if (a) this.play(a);
  }

  /** Dev (/debug/pet): where he is and what he's doing. */
  debugState(): Record<string, unknown> {
    const r = Math.round;
    return { x: r(this.x), y: r(this.y), vx: r(this.vx), vy: r(this.vy), grounded: this.grounded, wall: this.wall, anim: this.anim, held: this.held };
  }

  /** Returns whether the key is one of the game's (so the page shouldn't act on it). */
  keyDown(code: string, repeat: boolean): boolean {
    const k = KEYS[code];
    if (!k) return false;
    if (k === 'jump' && !repeat && !this.held.jump) this.sincePress = 0;
    this.held[k] = true;
    return true;
  }

  keyUp(code: string): void {
    const k = KEYS[code];
    if (!k) return;
    this.held[k] = false;
    // Short press, short hop.
    if (k === 'jump' && this.vy < 0) this.vy *= G.jumpCut;
  }

  /** The window lost the keyboard: nothing is held any more, and he waits for you to come back. */
  blur(): void {
    this.held = { left: false, right: false, down: false, jump: false };
    if (this.on) this.hint(PAUSED_HINT, 0);
  }

  focus(): void {
    if (this.on) this.hint(GAME_HINT, 3000);
  }

  /** One frame (dt in s). Moves the window and picks the motion; returns the body yaw. */
  step(dt: number): number {
    const m = this.renderer.pxPerMeter();
    const b = this.bounds();
    const h = this.held;
    const dir = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    const crouching = this.grounded && h.down;
    this.sincePress += dt;
    this.sinceGround = this.grounded ? 0 : this.sinceGround + dt;
    this.wallLock = Math.max(0, this.wallLock - dt);

    // ---- run ----
    const top = G.runClipMps * G.runPlayback * m;
    let want = crouching ? 0 : dir * top;
    if (this.wallLock > 0 && Math.sign(want) === this.wall) want = 0;
    const rate = top / (!this.grounded ? G.airAccelS : want === 0 ? G.stopS : G.accelS);
    this.vx += Math.max(-rate * dt, Math.min(rate * dt, want - this.vx));
    if (dir) this.facing = dir > 0 ? 1 : -1;

    // ---- jump: from the ground (or just off it), off a wall, or once more in the air ----
    const v0 = Math.sqrt(2 * G.gravity * G.jumpHeight) * m;
    if (this.sincePress <= G.bufferS) {
      if (this.grounded || this.sinceGround <= G.coyoteS) {
        this.jump(v0);
      } else if (this.wall) {
        this.jump(v0 * 0.95);
        this.vx = -this.wall * top * 0.9;
        this.facing = this.wall > 0 ? -1 : 1;
        this.wallLock = G.wallJumpLockS;
      } else if (this.airJumps > 0) {
        this.airJumps -= 1;
        this.jump(v0 * G.doubleJump);
      }
    }

    // ---- fall ----
    if (!this.grounded) {
      const g = G.gravity * m * (h.down ? G.fastFallGravity : this.vy > 0 ? G.fallGravity : 1);
      this.vy = Math.min(G.maxFall * m, this.vy + g * dt);
      // Pushing into a side of the screen on the way down: slide down it.
      if (this.wall && dir === this.wall && this.vy > G.wallSlide * m) this.vy = G.wallSlide * m;
    }

    // ---- move, and collide with the screen's edges ----
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.wall = 0;
    if (this.x <= b.left) {
      this.x = b.left;
      this.vx = Math.max(0, this.vx);
      this.wall = -1;
    } else if (this.x >= b.right) {
      this.x = b.right;
      this.vx = Math.min(0, this.vx);
      this.wall = 1;
    }
    if (this.y <= b.ceiling && this.vy < 0) {
      this.y = b.ceiling;
      this.vy = 0; // bumped his head on the menu bar
    }
    let landed: 'soft' | 'hard' | null = null;
    if (this.y >= b.floor) {
      if (!this.grounded) landed = this.vy > G.hardLanding * m ? 'hard' : 'soft';
      this.y = b.floor;
      this.vy = 0;
      this.grounded = true;
      this.airJumps = 1;
    } else if (this.grounded && this.y < b.floor - 1) {
      this.grounded = false; // the floor moved away (the Dock hid, a size change)
    }
    const at = `${Math.round(this.x)},${Math.round(this.y)}`;
    if (at !== this.placed) {
      this.placed = at;
      this.place(Math.round(this.x), Math.round(this.y));
    }

    // ---- motion ----
    const speed = Math.abs(this.vx) / top;
    if (!this.grounded) this.play('air');
    else if (landed === 'hard') this.play('hardLand');
    else if (crouching) this.play('crouch');
    else if (speed > 0.15) this.play('run');
    else if (landed === 'soft') this.play('land');
    else if (this.anim !== 'land' && this.anim !== 'hardLand') this.play('stand');
    // The run clip keeps pace with the feet; everything else plays as authored.
    this.renderer.setPlaybackSpeed(this.anim === 'run' ? G.runPlayback * Math.max(0.6, speed) : 1);

    const yawTarget = this.facing * (this.grounded && speed < 0.15 ? STAND_YAW : RUN_YAW);
    this.yaw += (yawTarget - this.yaw) * Math.min(1, dt * 14);
    return this.yaw;
  }

  private jump(v: number): void {
    this.vy = -v;
    this.grounded = false;
    this.sinceGround = Infinity; // no second coyote jump
    this.sincePress = Infinity;
    this.play('air', true);
  }

  private play(a: Anim, restart = false): void {
    if (a === this.anim && !restart) return;
    this.anim = a;
    const settles = a === 'land' || a === 'hardLand';
    this.renderer.play(ANIMS[a], () => {
      // A landing finishes into standing (the next frame picks running if you're moving).
      if (settles && this.anim === a) this.anim = null;
    });
  }

  /** Where the window may go on this display (window top-left, screen px). */
  private bounds(): { left: number; right: number; ceiling: number; floor: number } {
    const s = window.screen as Screen & { availLeft?: number; availTop?: number };
    const left = s.availLeft ?? 0;
    const top = s.availTop ?? 0;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const half = w * BODY_HALF_W;
    return {
      left: left + half - w / 2,
      right: left + s.availWidth - half - w / 2,
      ceiling: top,
      // Feet just above the Dock, like everywhere else he stands.
      floor: top + s.availHeight - 8 - h * FEET_AT,
    };
  }

  private hint(text: string, ms: number): void {
    window.clearTimeout(this.hintTimer);
    this.say(text);
    if (ms) this.hintTimer = window.setTimeout(() => this.on && this.say(''), ms);
  }
}
