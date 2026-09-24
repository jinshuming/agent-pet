#!/usr/bin/env node
// Turn a clip about the vertical axis so it faces the camera like the reference
// idle clip. fix-clip-facing only flips 180°; seated clips come out at any angle
// (sit-idle was ~90° off), so this measures the pelvis's heading and cancels it.
//
// Heading = the twist about +Y of the pelvis rotation relative to the reference's
// first frame (swing-twist decomposition), so a pelvis tipped back in a seated pose
// still reads as facing forward. `--at last` measures the last frame instead, for a
// clip whose end must hand over to a standing pose (stand-up). `--dry` only prints.
//
// usage: node scripts/face-forward.mjs [--ref assets/motions/idle.glb] [--at first|last] [--dry] clip.glb ...
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const refPath = opt('--ref') ?? new URL('../assets/motions/idle.glb', import.meta.url).pathname;
const at = opt('--at') ?? 'first';
const dryAt = args.indexOf('--dry');
const dry = dryAt >= 0 && args.splice(dryAt, 1).length > 0;

function open(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binOffset = 20 + jsonLen + 8;
  const anim = json.animations[0];
  const pelvis = json.nodes.findIndex((n) => n.name === 'pelvis');
  const track = (path) => {
    const ch = anim.channels.find((c) => c.target.node === pelvis && c.target.path === path);
    if (!ch) return null;
    const acc = json.accessors[anim.samplers[ch.sampler].output];
    const bv = json.bufferViews[acc.bufferView];
    const n = path === 'rotation' ? 4 : 3;
    const short = acc.componentType === 5122;
    const size = short ? 2 : 4;
    const stride = bv.byteStride || n * size;
    const base = binOffset + (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const off = (k, c) => base + k * stride + c * size;
    return {
      count: acc.count,
      get: (k) => Array.from({ length: n }, (_, c) => (short ? buf.readInt16LE(off(k, c)) / 32767 : buf.readFloatLE(off(k, c)))),
      set: (k, v) => v.forEach((x, c) => (short ? buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), off(k, c)) : buf.writeFloatLE(x, off(k, c)))),
    };
  };
  return { buf, rot: track('rotation'), pos: track('translation') };
}

// Quaternions are [x, y, z, w].
const mul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];
const inv = ([x, y, z, w]) => [-x, -y, -z, w];
/** Twist of q about +Y, in radians. */
const yawOf = ([, y, , w]) => 2 * Math.atan2(y, w);
const ry = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
const deg = (r) => ((((r * 180) / Math.PI + 540) % 360) - 180).toFixed(1);

const ref = open(refPath).rot.get(0);

for (const file of args) {
  const clip = open(file);
  if (!clip.rot) {
    console.log(`${file}: no pelvis rotation track, skipped`);
    continue;
  }
  const heading = (k) => yawOf(mul(clip.rot.get(k), inv(ref)));
  const first = heading(0);
  const last = heading(clip.rot.count - 1);
  const off = at === 'last' ? last : first;
  const note = `heading first ${deg(first)}°, last ${deg(last)}°`;
  if (dry || Math.abs(Math.sin(off / 2)) < Math.sin((1 * Math.PI) / 360)) {
    console.log(`${file}: ${note}${dry ? '' : ', already facing forward'}`);
    continue;
  }
  // Turn the whole clip by -off about Y: pelvis rotation r → Ry(-off)·r, position p → Ry(-off)·p.
  const t = ry(-off);
  const c = Math.cos(-off), s = Math.sin(-off);
  for (let k = 0; k < clip.rot.count; k++) clip.rot.set(k, mul(t, clip.rot.get(k)));
  if (clip.pos)
    for (let k = 0; k < clip.pos.count; k++) {
      const [x, y, z] = clip.pos.get(k);
      clip.pos.set(k, [x * c + z * s, y, -x * s + z * c]);
    }
  writeFileSync(file, clip.buf);
  console.log(`${file}: ${note} → turned ${deg(-off)}° (${at} frame now faces forward)`);
}
