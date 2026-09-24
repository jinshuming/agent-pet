import { PetController, type LetGoReason } from './pet/Controller';
import {
  CLIP_LABELS,
  REACTION_LABELS,
  HANG,
  REACTION_SEQUENCES,
  REST_MS,
  SIT_YAW_DEG,
  WALK_SPEED_MPS,
  WALK_YAW_DEG,
  type AgentState,
  type ClipName,
  type Reaction,
  type Wall,
} from './pet/clips';
import { REACTION_LINES, SPIN_LINES, pick } from './pet/lines';
import { CHARACTERS, findCharacter } from './pet/characters';
import { SplatPetRenderer, type BodyPart } from './render/SplatPetRenderer';

type AgentView = { state: AgentState; settle: AgentState; label: string };
type MenuItem = { id: string; label: string };
type Preview = { kind: 'reaction' | 'clip'; id: string } | { kind: 'rest'; id: 'sit' | 'sleep' };
/** From main, which flies the window: see "Physics" in main.cjs. */
type Physics =
  | { kind: 'drop' | 'hang' }
  | { kind: 'fly'; reason: 'fling' | 'tired' | 'poked' | 'critical' | 'hop' }
  | { kind: 'land'; hard: boolean; wall: Wall | null };

declare global {
  interface Window {
    petBridge: {
      setInteractive(interactive: boolean): void;
      moveBy(dx: number, dy: number): void;
      dragBegin(): void;
      dragMove(): void;
      onSize(cb: (s: { width: number; height: number }) => void): void;
      release(vx: number, vy: number): void;
      grab(): void;
      letGo(reason: LetGoReason): void;
      onPhysics(cb: (p: Physics) => void): void;
      leanContact(side: Wall, left: number, right: number): void;
      walk(side: Wall, speed: number): void;
      scaleBy(factor: number): void;
      showMenu(catalog: { reactions: MenuItem[]; clips: MenuItem[]; characters: MenuItem[]; character: string }): void;
      onSetCharacter(cb: (id: string) => void): void;
      onPreview(cb: (p: Preview) => void): void;
      onCursor(cb: (p: { x: number; y: number; w: number; h: number }) => void): void;
      onAgentState(cb: (v: AgentView) => void): void;
      ready(): void;
    };
  }
}

// The main process passes the saved choice as ?character=<id>; see pet/characters.ts.
let character = findCharacter(new URLSearchParams(location.search).get('character'));
const DRAG_THRESHOLD_PX = 4;
const MULTI_CLICK_MS = 320;
const MAX_YAW_DEG = 35;
const TINY_HEIGHT_PX = 170;
// Spin game: ⌥-drag or a sideways two-finger swipe spins him; enough turns make him dizzy.
const SPIN_DEG_PER_PX = 0.9;
const SPIN_DEG_PER_WHEEL = 0.6;
const SPIN_FRICTION = 1.6; // 1/s: how fast a flick loses speed
// High, so a faster flick really does spin him harder (it coasts about v / SPIN_FRICTION degrees).
const SPIN_MAX_DEG_S = 2880;
const SPIN_SETTLE_DEG_S = 45; // below this he stops coasting and turns back to face you
const DIZZY_TURNS = 3;
const DIZZY_DRAIN_TURNS_S = 0.35; // the meter drains while he isn't spinning
const DIZZY_SWAY_MS = 6500; // about the dizzy clip's length
const DIZZY_SWAY_DEG = 9;

const bridge = window.petBridge;
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const bubble = document.getElementById('bubble') as HTMLDivElement;

function setBubble(text: string): void {
  bubble.textContent = text;
  bubble.hidden = !text;
}

setBubble('loading…');
const renderer = await SplatPetRenderer.create(canvas, character.file);
const pet = new PetController(
  renderer,
  setBubble,
  (reason) => bridge.letGo(reason),
  // Leaning: fit the window so the silhouette's outermost point touches the wall.
  (wall) => fitToWall(wall),
  {
    walk: () => {
      const side = nearestWall();
      bridge.walk(side, WALK_SPEED_MPS * renderer.pxPerMeter());
      return side;
    },
    stop: () => bridge.grab(),
    sat: (wall) => fitToWall(wall),
  },
);

function fitToWall(wall: Wall): void {
  const x = renderer.silhouetteX();
  if (x) bridge.leanContact(wall, x.left, x.right);
}

/** The side of this display his feet are closer to. */
function nearestWall(): Wall {
  const s = window.screen as Screen & { availLeft?: number };
  const left = s.availLeft ?? 0;
  const cx = window.screenX + window.innerWidth / 2;
  return cx - left < left + s.availWidth - cx ? 'left' : 'right';
}
bridge.onAgentState((v) => pet.setAgentState(v.state, v.settle, v.label));
// Right-click menu previews: play any reaction or single clip once.
bridge.onPreview((p) => {
  // Right-click → 模拟互动 → 休息: pretend he's been left alone that long.
  if (p.kind === 'rest') {
    lastTouched = performance.now() - (p.id === 'sleep' ? REST_MS.sleep : REST_MS.sit);
    return;
  }
  const { kind, id } = p;
  if (kind === 'reaction') {
    const r = id as Reaction;
    if (r === 'dizzy') swayStart = performance.now();
    pet.preview(REACTION_SEQUENCES[r], pick(REACTION_LINES[r]) || REACTION_LABELS[r]);
  } else {
    const clip = id as ClipName;
    pet.preview([{ clip, loop: false }], CLIP_LABELS[clip]);
  }
});
// Right-click → 切换角色. Swaps are serialized; only the last request made while one is loading runs.
let swapping: Promise<void> | null = null;
let pendingCharacter: string | null = null;
bridge.onSetCharacter((id) => {
  pendingCharacter = id;
  if (swapping) return;
  swapping = (async () => {
    while (pendingCharacter) {
      const next = findCharacter(pendingCharacter);
      pendingCharacter = null;
      if (next.id === character.id) continue;
      setBubble('换装中…');
      try {
        await renderer.setCharacter(next.file);
        character = next;
        console.log(`[pet] character → ${next.id}`);
      } catch (err) {
        console.warn(`[pet] could not load character ${next.id}: ${err}`);
      }
      pet.refresh();
    }
  })().finally(() => (swapping = null));
});
bridge.ready(); // main replays the current agent state now that we can show it
// Dev server only (the packaged app loads from file://).
if (location.protocol.startsWith('http')) (window as unknown as { __petDebug: unknown }).__petDebug = { measureClips: () => renderer.measureClips() };

// ---------- window size ----------
// Pin the canvas to the size main intends. On Windows a move can nudge the window by a pixel
// (see place() in main.cjs); a canvas that followed would rebuild its WebGL buffer and blank a frame.
bridge.onSize(({ width, height }) => {
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  // Below about 25% the speech bubble would be wider than the whole pet: hide it.
  document.body.classList.toggle('tiny', height < TINY_HEIGHT_PX);
});

// ---------- click-through toggling ----------
/** 'body': on him (grab). 'near': the empty space around him (spin). null: clicks go through to the desktop. */
type Hover = 'body' | 'near' | null;
let interactive = false;
let hover: Hover = null;
function setHover(next: Hover): void {
  if (next === hover) return;
  hover = next;
  document.body.style.cursor = next === 'body' ? 'grab' : next === 'near' ? 'ew-resize' : 'default';
  if (!!next === interactive) return;
  interactive = !!next;
  bridge.setInteractive(interactive);
}
/** Spinning from beside him needs him standing free: not flying, hanging, or resting. */
const canSpinFromBeside = () => !pet.isAirborne && !pet.isResting;
function hoverAt(x: number, y: number): Hover {
  if (renderer.hitTest(x, y).hit) return 'body';
  return canSpinFromBeside() && renderer.nearBody(x, y) ? 'near' : null;
}

// ---------- dragging: main places the window at the cursor, at most once per frame ----------
let dragPending = false;
function startDrag(): void {
  document.body.style.cursor = 'grabbing';
  bridge.dragBegin();
  pet.beginDrag();
}

// ---------- pointer: hover / click / multi-click / drag ----------
/** `beside`: pressed in the empty space around him, which only ever spins him. */
type Press = { screenX: number; screenY: number; part: BodyPart; dragging: boolean; spin: boolean; beside?: boolean };
let press: Press | null = null;
/** Recent pointer positions while dragging, for the release velocity. */
let trail: { t: number; x: number; y: number }[] = [];
const VELOCITY_WINDOW_MS = 90;

function releaseVelocity(now: number): { vx: number; vy: number } {
  const recent = trail.filter((p) => now - p.t <= VELOCITY_WINDOW_MS);
  // Held still before letting go: a plain drop, not a throw.
  if (recent.length < 2 || now - recent[recent.length - 1].t > 50) return { vx: 0, vy: 0 };
  const a = recent[0];
  const b = recent[recent.length - 1];
  const dt = Math.max(1, b.t - a.t) / 1000;
  return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
}
let clicks: { count: number; part: BodyPart; timer: number } | null = null;
/** Recent clicks while he hangs, to tell slow pokes from a flurry. */
let hangClicks: number[] = [];

/** Last time you touched him (click, drag, spin, menu) or he was busy: the rest clock counts from here. */
let lastTouched = performance.now();
const touch = () => (lastTouched = performance.now());

window.addEventListener('pointermove', (e) => {
  if (press) {
    const dx = e.screenX - press.screenX;
    const dy = e.screenY - press.screenY;
    if (press.spin) {
      if (!press.dragging && Math.abs(dx) > DRAG_THRESHOLD_PX) press.dragging = true;
      if (press.dragging) {
        spinBy(dx * SPIN_DEG_PER_PX);
        press.screenX = e.screenX;
      }
      return;
    }
    if (!press.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      press.dragging = true;
      startDrag();
    }
    if (press.dragging) {
      dragPending = true;
      press.screenX = e.screenX;
      press.screenY = e.screenY;
      trail.push({ t: e.timeStamp, x: e.screenX, y: e.screenY });
      if (trail.length > 16) trail.shift();
    }
    return;
  }
  setHover(hoverAt(e.clientX, e.clientY));
});

window.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const hit = renderer.hitTest(e.clientX, e.clientY);
  if (!hit.hit) {
    // Beside him: a sideways drag spins him, harder the faster you swipe.
    if (!canSpinFromBeside() || !renderer.nearBody(e.clientX, e.clientY)) return;
    touch();
    press = { screenX: e.screenX, screenY: e.screenY, part: 'body', dragging: false, spin: true, beside: true };
    document.body.setPointerCapture(e.pointerId);
    return;
  }
  touch();
  // No spinning him while he sits or walks: the click wakes him instead.
  press = { screenX: e.screenX, screenY: e.screenY, part: hit.part, dragging: false, spin: e.altKey && !pet.isResting };
  if (pet.isWalking) bridge.grab(); // stop the walk; a drag picks him up, a click wakes him
  trail = [{ t: e.timeStamp, x: e.screenX, y: e.screenY }];
  document.body.setPointerCapture(e.pointerId);
  if (pet.isAirborne && !press.spin) {
    bridge.grab(); // stop the flight or the hang timer
    // Caught in mid-air: he's straight away being dragged. (Hanging waits: a click lets go.)
    if (!pet.isHanging) {
      press.dragging = true;
      startDrag();
    }
  }
});

window.addEventListener('pointerup', (e) => {
  if (!press || e.button !== 0) return;
  const p = press;
  press = null;
  if (p.beside) return; // a spin from beside him (or a click on empty space): no reaction
  if (p.dragging) {
    document.body.style.cursor = 'grab';
    if (!p.spin) {
      // Main decides: thrown (fly), pushed against the top edge (hang), or set down (drop).
      const { vx, vy } = releaseVelocity(e.timeStamp);
      bridge.release(vx, vy);
    }
    return; // a spin keeps coasting on its own
  }
  // Poking him while he hangs: slow pokes he fights off (and tires), a quick flurry knocks him off.
  if (pet.isHanging) {
    const now = performance.now();
    hangClicks = [...hangClicks.filter((t) => now - t < HANG.fastWindowMs), now];
    if (hangClicks.length >= HANG.fastClicks) {
      hangClicks = [];
      pet.letGo('poked');
    } else pet.hangPoke();
    return;
  }
  // Resolve single / double / triple click after a short window.
  if (clicks) {
    clicks.count += 1;
    clearTimeout(clicks.timer);
  } else {
    clicks = { count: 1, part: p.part, timer: 0 };
  }
  clicks.timer = window.setTimeout(() => {
    const { count, part } = clicks!;
    clicks = null;
    if (count >= 3) pet.react('petted');
    else if (count === 2) pet.react('doubleClick');
    else pet.react(part === 'head' ? 'headPat' : 'poke');
  }, MULTI_CLICK_MS);
});

// Resize: trackpad pinch (arrives as wheel + ctrlKey) or ⌘/Ctrl + scroll over the pet.
// Spin: a sideways two-finger swipe (or Shift + mouse wheel) over the pet.
window.addEventListener(
  'wheel',
  (e) => {
    if (!(e.ctrlKey || e.metaKey)) {
      if (!interactive || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      touch();
      if (pet.isResting) pet.wake();
      else spinBy(-e.deltaX * SPIN_DEG_PER_WHEEL);
      return;
    }
    e.preventDefault(); // no page zoom
    if (!interactive) return;
    bridge.scaleBy(Math.exp(-e.deltaY * 0.004));
  },
  { passive: false },
);

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!renderer.hitTest(e.clientX, e.clientY).hit) return;
  touch();
  const entries = <K extends string>(labels: Record<K, string>) =>
    (Object.entries(labels) as [K, string][]).map(([id, label]) => ({ id, label }));
  bridge.showMenu({
    reactions: entries(REACTION_LABELS),
    clips: entries(CLIP_LABELS).filter(({ id }) => renderer.hasClip(id)),
    characters: CHARACTERS.map(({ id, name }) => ({ id, label: name })),
    character: character.id,
  });
});

// ---------- spin game ----------
/** Accumulated spin in degrees; any multiple of 360 means "facing the viewer". */
let spin = 0;
/** Degrees per second, from the last input or coasting after a flick. */
let spinVel = 0;
let lastSpinInput = 0;
/** Turns spun recently; draining. Crossing DIZZY_TURNS arms the dizzy spell for when he stops. */
let dizziness = 0;
let spinLineShown = false;
let swayStart = -Infinity;

function spinBy(deg: number): void {
  const now = performance.now();
  const dt = Math.max(0.008, (now - lastSpinInput) / 1000);
  // Smooth the input speed so a flick's release velocity isn't one noisy sample.
  spinVel = Math.max(-SPIN_MAX_DEG_S, Math.min(SPIN_MAX_DEG_S, spinVel * 0.6 + (deg / Math.min(dt, 0.1)) * 0.4));
  lastSpinInput = now;
  spin += deg;
  dizziness += Math.abs(deg) / 360;
  if (!spinLineShown && dizziness > 1) {
    spinLineShown = true;
    setBubble(pick(SPIN_LINES));
  }
}

const isSpinning = () => !!press?.spin || performance.now() - lastSpinInput < 120 || Math.abs(spinVel) > SPIN_SETTLE_DEG_S;

/** Coast, settle back to facing the viewer, and trigger the dizzy spell. dt in seconds. */
function stepSpin(dt: number): void {
  const moving = performance.now() - lastSpinInput < 120;
  // A mouse held still sends no events: while the button is down you're gripping him, so no coasting.
  if (press?.spin && !moving) spinVel = 0;
  if (!moving && !press?.spin) {
    spinVel *= Math.exp(-SPIN_FRICTION * dt);
    if (Math.abs(spinVel) > SPIN_SETTLE_DEG_S) {
      spin += spinVel * dt;
      dizziness += (Math.abs(spinVel) * dt) / 360;
    } else {
      spinVel = 0;
      // Turn back to the nearest "facing you" angle, the short way round.
      const home = Math.round(spin / 360) * 360;
      spin += (home - spin) * Math.min(1, dt * 4);
      if (Math.abs(home - spin) < 0.5) spin = 0;
      if (dizziness >= DIZZY_TURNS) {
        dizziness = 0;
        swayStart = performance.now();
        pet.react('dizzy');
      }
      dizziness = Math.max(0, dizziness - DIZZY_DRAIN_TURNS_S * dt);
      if (dizziness < 0.5) spinLineShown = false;
    }
  }
}

/** Body sway while dizzy: big loose circles that shrink as he finds his balance. */
function dizzySway(now: number): { pitch: number; roll: number } {
  const p = (now - swayStart) / DIZZY_SWAY_MS;
  if (p < 0 || p >= 1) return { pitch: 0, roll: 0 };
  const amp = DIZZY_SWAY_DEG * (1 - p) ** 1.6;
  const t = (now - swayStart) / 1000;
  // Two unrelated frequencies, so the sway wanders instead of ticking like a metronome.
  return { roll: amp * Math.sin(t * 2.3), pitch: amp * 0.55 * Math.sin(t * 1.55 + 1.1) };
}

// ---------- look toward the cursor + keep the bubble above the head ----------
let targetYaw = 0;
let yaw = 0;
bridge.onCursor(({ x, w }) => {
  const nx = (x - w / 2) / (w * 1.5);
  targetYaw = Math.max(-MAX_YAW_DEG, Math.min(MAX_YAW_DEG, nx * 2 * MAX_YAW_DEG));
});

// ---------- physics (main flies the window; we play along) ----------
/**
 * While hanging, his top hand is held at GRIP_AT of the window height (the menu bar edge),
 * whichever clip is playing: the body swings and drops below it the way a hanging body does.
 * Without hand bones, fall back to the lift measured for the two-handed clip (/debug/extents).
 */
const GRIP_AT = 0.014;
const HANG_LIFT = 0.155;
const MAX_LIFT = 0.4;
let lift = 0;
let appliedLift = 0;
bridge.onPhysics((p) => {
  console.debug(`[pet] physics ${JSON.stringify(p)}`);
  if (p.kind === 'drop') pet.endDrag();
  else if (p.kind === 'hang') pet.hang();
  else if (p.kind === 'fly') pet.fly(p.reason);
  else if (p.kind === 'land') {
    if (p.hard) swayStart = performance.now();
    pet.land(p.hard, p.wall ?? null);
  }
});

// ---------- resting: turn him side-on to walk, back to the wall to sit ----------
let restYaw = 0;
function restYawTarget(): number {
  const pose = pet.restPose;
  if (!pose) return 0;
  // +yaw turns him toward the screen's right. Walking: face the wall. Sitting: back to it.
  const toWall = pose.side === 'right' ? 1 : -1;
  return pose.rest === 'walking' ? toWall * WALK_YAW_DEG : -toWall * SIT_YAW_DEG;
}

let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (dragPending && press?.dragging && !press.spin) bridge.dragMove();
  dragPending = false;
  if (!pet.isFree) lastTouched = now;
  pet.restTick(now - lastTouched);
  restYaw += (restYawTarget() - restYaw) * Math.min(1, dt * 5);
  stepSpin(dt);
  const sway = dizzySway(now);
  const dizzy = sway.pitch !== 0 || sway.roll !== 0;
  const lookAllowed =
    !press?.dragging && !pet.isAirborne && !pet.isLeaning && !pet.isResting && !isSpinning() && !dizzy && pet.agentState !== 'sleep';
  // Reach up to the menu bar while hanging (hands pinned to it); ease back down once he lets go.
  pet.hangTick(now);
  let liftTarget = 0;
  if (pet.isHanging) {
    const hand = renderer.topHandY();
    const h = canvas.clientHeight;
    liftTarget = hand === null || !h ? HANG_LIFT : Math.min(MAX_LIFT, Math.max(0, lift + (hand - GRIP_AT * h) / h));
  }
  lift += (liftTarget - lift) * Math.min(1, dt * 12);
  if (!pet.isHanging && lift < 0.001) lift = 0;
  if (lift !== appliedLift) {
    renderer.setLift(lift);
    appliedLift = lift;
  }
  yaw += ((lookAllowed ? targetYaw : 0) - yaw) * 0.12;
  renderer.setYaw(spin + yaw + restYaw, sway.pitch, sway.roll);
  const top = renderer.headTopScreen();
  if (top) {
    bubble.style.left = `${top.x}px`;
    bubble.style.top = `${Math.max(4, top.y)}px`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
