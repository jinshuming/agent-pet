// Score PINOC metahuman-glb motion samples for desktop-pet use.
// usage: node scripts/score-clips.mjs assets/motions/idle.glb <candidate.glb>...
// driftCm: pelvis travel (stay in place); seamDeg: first vs last frame (loops);
// from/toIdleDeg: crossfade distance; armDegPerS: how lively the arms are.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

function readGlb(path) {
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 };
  const accessor = (i) => {
    const a = json.accessors[i];
    const bv = json.bufferViews[a.bufferView];
    const n = comps[a.type];
    // Rotations come as normalized int16 (5122), everything else as float32 (5126).
    const size = a.componentType === 5122 ? 2 : 4;
    const read = (o) => (size === 2 ? Math.max(bin.readInt16LE(o) / 32767, -1) : bin.readFloatLE(o));
    const stride = bv.byteStride || n * size;
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = [];
    for (let k = 0; k < a.count; k++) {
      const row = [];
      for (let c = 0; c < n; c++) row.push(read(base + k * stride + c * size));
      out.push(row);
    }
    return out;
  };
  const anim = json.animations[0];
  const tracks = {};
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler];
    const name = json.nodes[ch.target.node].name;
    (tracks[name] ??= {})[ch.target.path] = { t: accessor(s.input).map((r) => r[0]), v: accessor(s.output) };
  }
  return tracks;
}

const quatAngle = (a, b) => {
  const d = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return (2 * Math.acos(d) * 180) / Math.PI;
};
const BODY = /^(pelvis|spine_0[1-5]|neck_0[12]|head|clavicle_[lr]|upperarm_[lr]|lowerarm_[lr]|hand_[lr]|thigh_[lr]|calf_[lr]|foot_[lr])$/;
const ARMS = /^(upperarm_[lr]|lowerarm_[lr]|hand_[lr])$/;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

const [idlePath, ...paths] = process.argv.slice(2);
const idle = readGlb(idlePath);
const idleFirst = (name) => idle[name]?.rotation?.v[0];

const rows = [];
for (const p of paths) {
  const tr = readGlb(p);
  const body = Object.keys(tr).filter((n) => BODY.test(n) && tr[n].rotation);
  const pel = tr.pelvis?.translation;
  let drift = 0, rise = 0;
  if (pel) {
    const [x0, y0, z0] = pel.v[0];
    for (const [x, y, z] of pel.v) {
      drift = Math.max(drift, Math.hypot(x - x0, z - z0));
      rise = Math.max(rise, Math.abs(y - y0));
    }
  }
  const seam = mean(body.map((n) => quatAngle(tr[n].rotation.v[0], tr[n].rotation.v.at(-1))));
  const fromIdle = mean(body.filter(idleFirst).map((n) => quatAngle(idleFirst(n), tr[n].rotation.v[0])));
  const toIdle = mean(body.filter(idleFirst).map((n) => quatAngle(idleFirst(n), tr[n].rotation.v.at(-1))));
  const armEnergy = mean(
    Object.keys(tr).filter((n) => ARMS.test(n) && tr[n].rotation).map((n) => {
      const { t, v } = tr[n].rotation;
      let sum = 0;
      for (let i = 1; i < v.length; i++) sum += quatAngle(v[i - 1], v[i]);
      return sum / (t.at(-1) - t[0] || 1);
    }),
  );
  const dur = tr.pelvis?.rotation?.t.at(-1) ?? 0;
  rows.push({ clip: basename(p, '.glb'), dur: dur.toFixed(1), driftCm: (drift * 100).toFixed(1), riseCm: (rise * 100).toFixed(1), seamDeg: seam.toFixed(1), fromIdleDeg: fromIdle.toFixed(1), toIdleDeg: toIdle.toFixed(1), armDegPerS: armEnergy.toFixed(0) });
}
console.table(rows);
