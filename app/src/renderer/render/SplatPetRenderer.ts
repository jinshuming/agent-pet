// The only module that talks to @viggle/splat-engine / PlayCanvas.
// Everything above it deals in Steps (clip + loop) and screen coordinates.
import { Animation, Character, Scene } from '@viggle/splat-engine';
import { Vec3 } from 'playcanvas';
import { CLIP_FALLBACK, CLIP_FILES, type ClipName, type Step } from '../pet/clips';

const CROSSFADE_S = 0.25;
const FOV_DEG = 30;
/**
 * Fraction of the canvas height the standing character fills after auto-framing.
 * The rest is headroom: raised arms, jumps and the drag pose reach well past the
 * standing silhouette and must not hit the window edge.
 */
const FILL_HEIGHT = 0.53;
/** Gap between the feet and the bottom edge, as a fraction of the canvas height. Mirrored in main.cjs (FEET_GAP_PX). */
const FEET_MARGIN = 0.15;
const ALPHA_HIT_THRESHOLD = 24; // 0..255

export type BodyPart = 'head' | 'body';
export type HitResult = { hit: false } | { hit: true; part: BodyPart };

export class SplatPetRenderer {
  private seq: Step[] = [];
  private seqIndex = 0;
  private onSeqDone: (() => void) | null = null;
  private headBone = -1;
  private neckBone = -1;
  /** Head, pelvis, hands and feet: their projected box is the "near the body" zone for spinning. */
  private extentBones: number[] = [];
  private handBones: number[] = [];
  private readonly tmp = new Vec3();
  private readonly pixel = new Uint8Array(4);
  /** Camera height chosen by autoFrame; setLift offsets from it. */
  private framedCamY: number | null = null;

  // ---------- frame budget ----------
  // A desktop pet runs all day next to real work, so it renders at `targetFps`
  // (the caller lowers it while nothing fast is happening) instead of the display's
  // 60–120 Hz. Frames in between skip both the draw and the skinning.
  private targetFps = 60;
  private lastRenderAt = 0;
  /** Frames autoFrame / measureClips need drawn no matter the budget. */
  private forceRender = 0;
  private displayDt = 1000 / 60;
  private lastTickAt = 0;
  private renders: number[] = [];

  private constructor(
    private readonly scene: Scene,
    private character: Character,
    private readonly canvas: HTMLCanvasElement,
    private readonly loadedClips: ReadonlySet<ClipName>,
  ) {
    this.findBones();
    scene.app.autoRender = false;
    scene.app.on('update', () => {
      this.tickSequence();
      this.budgetFrame();
    });
  }

  /** Render (and skin) this frame only if it's due under the frame budget. */
  private budgetFrame(): void {
    const now = performance.now();
    if (this.lastTickAt) this.displayDt += (Math.min(100, now - this.lastTickAt) - this.displayDt) * 0.05;
    this.lastTickAt = now;
    const interval = 1000 / this.targetFps;
    // Half a display frame of slack, so 30 fps on a 60 Hz display lands on every other frame.
    const due = this.forceRender > 0 || now - this.lastRenderAt >= interval - this.displayDt / 2;
    if (!due) return;
    if (this.forceRender > 0) this.forceRender--;
    this.lastRenderAt = now;
    this.scene.app.renderNextFrame = true;
    this.renders.push(now);
    if (this.renders.length > 240) this.renders.shift();
  }

  /** Frames per second to draw (10–120). Skinning follows, so skipped frames cost almost nothing. */
  setTargetFps(fps: number): void {
    const next = Math.min(120, Math.max(10, Math.round(fps)));
    if (next === this.targetFps) return;
    this.targetFps = next;
    this.applySkinningRate();
  }

  get fps(): number {
    return this.targetFps;
  }

  /** Pose evaluation + skinning only on the frames that get drawn. */
  private applySkinningRate(): void {
    const displayFps = 1000 / this.displayDt;
    this.character.armature.updateInterval = Math.max(1, Math.round(displayFps / this.targetFps));
  }

  /** Dev: the bones this character's splats are bound to (a subset of the clips' 441). */
  boneNames(): string[] {
    return [...this.character.armature.boneNames];
  }

  /** Dev: measured draw rate over the last second and the JS heap. */
  stats(): { renderFps: number; displayFps: number; targetFps: number; heapMB: number | null } {
    const now = performance.now();
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return {
      renderFps: this.renders.filter((t) => now - t <= 1000).length,
      displayFps: Math.round(1000 / this.displayDt),
      targetFps: this.targetFps,
      heapMB: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : null,
    };
  }

  private findBones(): void {
    const names = this.character.armature.boneNames;
    this.headBone = names.findIndex((n) => n.toLowerCase() === 'head');
    this.neckBone = names.findIndex((n) => /^neck_?0?1$/i.test(n));
    this.extentBones = names
      .map((n, i) => (/^(head|pelvis|hand_[lr]|foot_[lr])$/i.test(n) ? i : -1))
      .filter((i) => i >= 0);
    this.handBones = names.map((n, i) => (/^hand_[lr]$/i.test(n) ? i : -1)).filter((i) => i >= 0);
    console.log(`[pet] ${names.length} bones, head=${this.headBone}, neck=${this.neckBone}, extent=${this.extentBones.length}`);
  }

  /**
   * Swap in another character without rebuilding the scene: the clips are shared
   * through the scene's animation library. Re-frames the camera for the new body.
   * The caller re-applies whatever motion should play afterwards.
   */
  // loadVsplat, not load: Character.load keeps every file's bytes in a process-wide cache,
  // so each character swap used to leave ~100 MB behind.
  async setCharacter(characterUrl: string): Promise<void> {
    const next = await Character.loadVsplat(this.scene, characterUrl);
    const old = this.character;
    this.character = next;
    old.destroy();
    this.findBones();
    this.applySkinningRate();
    this.setYaw(0);
    this.play([{ clip: 'idle', loop: true }]);
    await this.autoFrame();
  }

  static async create(canvas: HTMLCanvasElement, characterUrl: string): Promise<SplatPetRenderer> {
    const scene = await Scene.create(canvas, {
      bgColor: { r: 0, g: 0, b: 0, a: 0 },
      // Required for a genuinely transparent backbuffer; also lets us read
      // pixels back for alpha hit-testing and auto-framing.
      preserveDrawingBuffer: true,
      backend: 'webgl',
      maxPixelRatio: Math.min(window.devicePixelRatio, 2),
      fov: FOV_DEG,
      cameraPosition: { x: 0, y: 0.8, z: 5 },
      cameraTarget: { x: 0, y: 0.8, z: 0 },
    });
    scene.start();

    const clipEntries = Object.entries(CLIP_FILES) as [ClipName, string][];
    const [character, ...clipResults] = await Promise.all([
      Character.loadVsplat(scene, characterUrl),
      // One missing or broken clip must not take the whole pet down.
      ...clipEntries.map(([name, url]) =>
        Animation.loadGlb(scene, url, name).then(
          () => name,
          (err: unknown) => {
            console.warn(`[pet] clip ${name} (${url}) failed to load, falling back to idle: ${err}`);
            return null;
          },
        ),
      ),
    ]);
    const loaded = new Set(clipResults.filter((n): n is ClipName => n !== null));
    const r = new SplatPetRenderer(scene, character, canvas, loaded);
    r.play([{ clip: 'idle', loop: true }]);
    await r.autoFrame();
    return r;
  }

  // ---------- animation ----------

  /** Replace the current motion with a sequence. `onDone` fires when a non-looping sequence ends. */
  play(steps: Step[], onDone?: () => void): void {
    this.seq = steps;
    this.seqIndex = 0;
    this.onSeqDone = onDone ?? null;
    this.startStep(steps[0]);
  }

  /**
   * Looping steps are played as one-shots that crossfade back into their own
   * first frame just before the end: generated clips rarely end in exactly the
   * pose they start in (typing: ~15° apart), and a hard loop would visibly snap.
   */
  private startStep(step: Step, quiet = false): void {
    const fallback = CLIP_FALLBACK[step.clip];
    const clip: ClipName = this.loadedClips.has(step.clip)
      ? step.clip
      : fallback && this.loadedClips.has(fallback)
        ? fallback
        : 'idle';
    const ok = this.character.crossfadeTo(clip, { duration: CROSSFADE_S, loop: false });
    if (!ok) console.warn(`[pet] clip not found: ${clip}`);
    const a = this.character.armature;
    if (!quiet) console.debug(`[pet] play ${clip} loop=${step.loop} duration=${a.animationDuration.toFixed(2)}`);
  }

  private tickSequence(): void {
    const step = this.seq[this.seqIndex];
    if (!step) return;
    if (step.loop) {
      const a = this.character.armature;
      const blendFrames = CROSSFADE_S * a.frameRate;
      if (a.animationDuration > 0 && a.animationTime >= a.animationDuration - blendFrames - 1) this.startStep(step, true);
      return;
    }
    if (!this.character.isFinished) return;
    if (this.seqIndex + 1 < this.seq.length) {
      this.seqIndex += 1;
      this.startStep(this.seq[this.seqIndex]);
      return;
    }
    const done = this.onSeqDone;
    this.onSeqDone = null;
    done?.();
  }

  /** Whether a clip loaded successfully (missing ones silently play idle). */
  hasClip(clip: ClipName): boolean {
    return this.loadedClips.has(clip);
  }

  get currentClip(): ClipName | null {
    return (this.character.currentAnimationName as ClipName | null) ?? null;
  }

  /**
   * Turn the whole body toward the cursor (cheap stand-in for head look-at) or spin it.
   * Characters face -Z; the camera sits on +Z, so 0° here means "facing the viewer".
   * `pitch`/`roll` tip the body about its feet, for the dizzy sway.
   */
  setYaw(deg: number, pitch = 0, roll = 0): void {
    this.character.setRotation(pitch, 180 + deg, roll);
  }

  /**
   * Shift the character up inside the canvas by `fraction` of the canvas height
   * (0 = normal framing). Used while he hangs from the top of the screen: the
   * window can't go above the menu bar, so his hands have to come up to meet it.
   */
  setLift(fraction: number): void {
    if (this.framedCamY === null) return;
    const cam = this.scene.cameraEntity;
    const { z } = cam.getPosition();
    const y = this.framedCamY - fraction * 2 * z * Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
    cam.setPosition(0, y, z);
    cam.lookAt(0, y, 0);
  }

  setTint(intensity: number, color?: { r: number; g: number; b: number }): void {
    this.character.setTint(intensity, color);
  }

  // ---------- picking ----------

  /** Per-pixel alpha test under the cursor, then classify head vs body via the projected head bone. */
  hitTest(clientX: number, clientY: number): HitResult {
    const alpha = this.readAlpha(clientX, clientY);
    if (alpha < ALPHA_HIT_THRESHOLD) return { hit: false };
    const head = this.boneScreen(this.headBone);
    const neck = this.boneScreen(this.neckBone);
    if (head && neck) {
      // Everything above the neck (plus a little slack) counts as head.
      const neckY = neck.y + Math.abs(neck.y - head.y) * 0.3;
      return { hit: true, part: clientY <= neckY ? 'head' : 'body' };
    }
    return { hit: true, part: 'body' };
  }

  /**
   * Beside him but not on him: inside the box around his head, hands and feet, grown by
   * `margin` (a fraction of his on-screen height). Pressing there spins him instead of
   * clicking through to the desktop.
   */
  nearBody(clientX: number, clientY: number, margin = 0.22): boolean {
    const pts = this.extentBones.map((b) => this.boneScreen(b)).filter((p): p is { x: number; y: number } => !!p);
    if (pts.length < 2) return false;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const top = this.headTopScreen()?.y ?? Math.min(...ys);
    const bottom = Math.max(...ys);
    const pad = (bottom - top) * margin;
    return (
      clientX >= Math.min(...xs) - pad &&
      clientX <= Math.max(...xs) + pad &&
      clientY >= top - pad * 0.5 &&
      clientY <= bottom + pad * 0.3
    );
  }

  /** Screen y (CSS px) of his higher hand: the one holding on while he hangs. Null without hand bones. */
  topHandY(): number | null {
    const ys = this.handBones.map((b) => this.boneScreen(b)?.y).filter((y): y is number => y !== undefined);
    return ys.length ? Math.min(...ys) : null;
  }

  /** CSS px per metre at the character: how fast to move the window for a walk. */
  pxPerMeter(): number {
    const dist = this.scene.cameraEntity.getPosition().z;
    return this.canvas.clientHeight / (2 * dist * Math.tan(((FOV_DEG / 2) * Math.PI) / 180));
  }

  /** Screen (CSS px) position of the top of the head, for speech bubbles. */
  headTopScreen(): { x: number; y: number } | null {
    const head = this.boneScreen(this.headBone);
    const neck = this.boneScreen(this.neckBone);
    if (!head) return null;
    const span = neck ? Math.abs(neck.y - head.y) : 20;
    return { x: head.x, y: head.y - span * 2.2 };
  }

  private boneScreen(boneIdx: number): { x: number; y: number } | null {
    if (boneIdx < 0) return null;
    const m = this.character.armature.getBoneWorldMatrix(boneIdx);
    if (!m) return null;
    m.getTranslation(this.tmp);
    const cam = this.scene.cameraEntity.camera!;
    const s = cam.worldToScreen(this.tmp);
    return { x: s.x, y: s.y };
  }

  private gl(): WebGL2RenderingContext {
    return (this.scene.graphicsDevice as unknown as { gl: WebGL2RenderingContext }).gl;
  }

  /** Read one pixel's alpha from the (preserved) default framebuffer. */
  private readAlpha(clientX: number, clientY: number): number {
    const gl = this.gl();
    const sx = this.canvas.width / this.canvas.clientWidth;
    const sy = this.canvas.height / this.canvas.clientHeight;
    const x = Math.floor(clientX * sx);
    const y = this.canvas.height - 1 - Math.floor(clientY * sy);
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return 0;
    const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixel);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
    return this.pixel[3];
  }

  /** Horizontal extent of the rendered silhouette, in CSS px from the canvas's left edge. */
  silhouetteX(): { left: number; right: number } | null {
    const b = this.scanAlphaBounds();
    if (!b) return null;
    const k = this.canvas.clientWidth / this.canvas.width;
    return { left: b.minX * k, right: (b.maxX + 1) * k };
  }

  /** Bounding box (in canvas pixels, top-left origin) of all non-transparent pixels. */
  private scanAlphaBounds(): { minY: number; maxY: number; minX: number; maxX: number } | null {
    const gl = this.gl();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const buf = new Uint8Array(w * h * 4);
    const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        if (buf[(row * w + col) * 4 + 3] >= ALPHA_HIT_THRESHOLD) {
          const top = h - 1 - row;
          if (col < minX) minX = col;
          if (col > maxX) maxX = col;
          if (top < minY) minY = top;
          if (top > maxY) maxY = top;
        }
      }
    }
    return maxY < 0 ? null : { minX, maxX, minY, maxY };
  }

  /**
   * Dev only: play every loaded clip once and record how far the silhouette
   * reaches, as fractions of the canvas (0 = top/left edge, 1 = bottom/right).
   * A clip that touches 0 or 1 is being clipped by the window.
   */
  async measureClips(): Promise<Record<string, { top: number; bottom: number; left: number; right: number; clipped: boolean }>> {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const out: Record<string, { top: number; bottom: number; left: number; right: number; clipped: boolean }> = {};
    const saved = { seq: this.seq, index: this.seqIndex, done: this.onSeqDone };
    this.forceRender = Number.MAX_SAFE_INTEGER;
    this.setYaw(0);
    for (const clip of this.loadedClips) {
      this.play([{ clip, loop: false }]);
      let minX = w, maxX = -1, minY = h, maxY = -1;
      const deadline = performance.now() + 15000;
      for (let frame = 0; !(frame > 10 && this.character.isFinished) && performance.now() < deadline; frame++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (frame % 2) continue;
        const b = this.scanAlphaBounds();
        if (!b) continue;
        minX = Math.min(minX, b.minX);
        maxX = Math.max(maxX, b.maxX);
        minY = Math.min(minY, b.minY);
        maxY = Math.max(maxY, b.maxY);
      }
      const r3 = (n: number) => Math.round(n * 1000) / 1000;
      out[clip] = {
        top: r3(minY / h),
        bottom: r3(maxY / h),
        left: r3(minX / w),
        right: r3(maxX / w),
        clipped: minY <= 0 || minX <= 0 || maxY >= h - 1 || maxX >= w - 1,
      };
    }
    this.forceRender = 0;
    this.seq = saved.seq;
    this.seqIndex = saved.index;
    this.onSeqDone = saved.done;
    if (saved.seq[0]) this.startStep(saved.seq[saved.index] ?? saved.seq[0]);
    return out;
  }

  /**
   * Frame the camera on the character using what was actually rendered, so
   * any character size/proportion works. Two passes converge well enough.
   */
  private async autoFrame(): Promise<void> {
    this.forceRender = Number.MAX_SAFE_INTEGER; // it reads back what was drawn, so draw every frame
    try {
      await this.frameCamera();
    } finally {
      this.forceRender = 0;
    }
  }

  private async frameCamera(): Promise<void> {
    const nextFrames = (n: number) =>
      new Promise<void>((resolve) => {
        const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      });
    const cam = this.scene.cameraEntity;
    const halfFov = ((FOV_DEG / 2) * Math.PI) / 180;
    // Start from wherever the camera is: on a character swap it was framed for the previous one.
    let camY = cam.getPosition().y;
    let dist = cam.getPosition().z;
    for (let pass = 0; pass < 2; pass++) {
      await nextFrames(6);
      const b = this.scanAlphaBounds();
      if (!b) {
        console.warn('[pet] autoFrame: nothing visible in the alpha channel – transparency pipeline issue?');
        return;
      }
      const h = this.canvas.height;
      // World units per pixel at the character plane (camera looks down -z at x=z=0).
      const worldPerPx = (2 * dist * Math.tan(halfFov)) / h;
      const topWorld = camY + (h / 2 - b.minY) * worldPerPx;
      const bottomWorld = camY + (h / 2 - b.maxY) * worldPerPx;
      const heightWorld = topWorld - bottomWorld;
      dist = heightWorld / FILL_HEIGHT / (2 * Math.tan(halfFov));
      // Anchor the feet near the bottom so the spare room sits above the head.
      const viewWorld = 2 * dist * Math.tan(halfFov);
      camY = bottomWorld + viewWorld * (0.5 - FEET_MARGIN);
      cam.setPosition(0, camY, dist);
      cam.lookAt(0, camY, 0);
      this.framedCamY = camY;
      console.log(`[pet] autoFrame pass ${pass}: height=${heightWorld.toFixed(2)}m dist=${dist.toFixed(2)} camY=${camY.toFixed(2)}`);
    }
  }
}
