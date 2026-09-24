#!/usr/bin/env node
// Mirror a metahuman-glb clip left↔right, e.g. to make "lean on the left wall"
// from "lean on the right wall". Text-to-motion often ignores which side a prompt
// names, so the mirror of a good clip beats a second generation.
//
// Each bone takes its mirror partner's motion (upperarm_l ↔ upperarm_r,
// FACIAL_L_… ↔ FACIAL_R_…), reflected across the body's midline: a world-space
// rotation delta q = (v, w) becomes (2(v·n)n - v, w) for the midline's normal n,
// applied on top of the bone's own rest pose. The pelvis translation is reflected too.
//
// "World" is the space the engine plays the clip in: it drives the body from the
// pelvis and ignores everything above it (root, Armature), so those count as identity,
// and n is measured from the rest pose (thigh_l → thigh_r) in that space.
//
// usage: node scripts/mirror-clip.mjs in.glb out.glb
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: node scripts/mirror-clip.mjs in.glb out.glb');
  process.exit(1);
}

const buf = Buffer.from(readFileSync(inPath));
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${inPath}: not a GLB`);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binOffset = 20 + jsonLen + 8;
const { nodes } = json;
const anim = json.animations[0];

// ---------- quaternions [x, y, z, w] ----------
const mul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const inv = (q) => [-q[0], -q[1], -q[2], q[3]];
const apply = (q, v) => mul(mul(q, [...v, 0]), inv(q)).slice(0, 3);
const IDENTITY = [0, 0, 0, 1];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Set by the skeleton section: unit normal of the body's midline plane. */
let midlineNormal = [1, 0, 0];
/** Reflect a vector across the midline plane. */
const reflectVec = (v) => {
  const d = 2 * dot(v, midlineNormal);
  return v.map((x, c) => x - d * midlineNormal[c]);
};
/** Conjugate a rotation by the midline reflection: the axis reflects, the angle reverses. */
const reflect = ([x, y, z, w]) => {
  const r = reflectVec([x, y, z]);
  return [-r[0], -r[1], -r[2], w];
};

// ---------- accessors ----------
function accessor(index, n) {
  const acc = json.accessors[index];
  const bv = json.bufferViews[acc.bufferView];
  const short = acc.componentType === 5122;
  const size = short ? 2 : 4;
  const stride = bv.byteStride || n * size;
  const base = binOffset + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const at = (k, c) => base + k * stride + c * size;
  return {
    count: acc.count,
    get: (k) => Array.from({ length: n }, (_, c) => (short ? Math.max(-1, buf.readInt16LE(at(k, c)) / 32767) : buf.readFloatLE(at(k, c)))),
    set: (k, v) =>
      v.forEach((x, c) => (short ? buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), at(k, c)) : buf.writeFloatLE(x, at(k, c)))),
  };
}

const tracks = nodes.map(() => ({}));
for (const ch of anim.channels) {
  const s = anim.samplers[ch.sampler];
  if (ch.target.path === 'rotation') tracks[ch.target.node].rot = accessor(s.output, 4);
  if (ch.target.path === 'translation') tracks[ch.target.node].pos = accessor(s.output, 3);
}
const frames = Math.max(...tracks.map((t) => t.rot?.count ?? 0));

// ---------- skeleton ----------
const parent = [];
nodes.forEach((n, i) => (n.children || []).forEach((c) => (parent[c] = i)));
const byName = new Map(nodes.map((n, i) => [n.name, i]));
const partnerName = (name) =>
  name
    .replace(/^FACIAL_([LR])_/, (_, s) => `FACIAL_${s === 'L' ? 'R' : 'L'}_`)
    .replace(/_([lr])(?=_|$)/, (_, s) => `_${s === 'l' ? 'r' : 'l'}`);
// Unpaired bones (centre line, or a facial bone with no twin) mirror onto themselves.
const partner = nodes.map((n, i) => byName.get(partnerName(n.name)) ?? i);

// The engine ignores the pelvis's ancestors (root, Armature): treat them as identity.
const pelvis = byName.get('pelvis');
const ignored = new Set();
for (let i = parent[pelvis]; i !== undefined; i = parent[i]) ignored.add(i);
const restRot = nodes.map((n, i) => (ignored.has(i) ? IDENTITY : n.rotation ?? IDENTITY));
const localRot = (i, k) =>
  tracks[i].rot && !ignored.has(i) ? tracks[i].rot.get(Math.min(k, tracks[i].rot.count - 1)) : restRot[i];

/** World rotations of every node for one frame (k = -1: the rest pose). */
function worldRots(k) {
  const g = [];
  const at = (i) => {
    if (g[i]) return g[i];
    const local = k < 0 ? restRot[i] : localRot(i, k);
    return (g[i] = parent[i] === undefined ? local : mul(at(parent[i]), local));
  };
  nodes.forEach((_, i) => at(i));
  return g;
}

const rest = worldRots(-1);

// Midline normal: the direction from one hip joint to the other in the rest pose.
{
  const pos = [];
  const at = (i) => {
    if (pos[i]) return pos[i];
    const t = ignored.has(i) ? [0, 0, 0] : nodes[i].translation ?? [0, 0, 0];
    if (parent[i] === undefined) return (pos[i] = t);
    const p = at(parent[i]);
    const o = apply(rest[parent[i]], t);
    return (pos[i] = [p[0] + o[0], p[1] + o[1], p[2] + o[2]]);
  };
  const l = at(byName.get('thigh_l'));
  const r = at(byName.get('thigh_r'));
  const d = [l[0] - r[0], l[1] - r[1], l[2] - r[2]];
  const len = Math.hypot(...d);
  midlineNormal = d.map((x) => x / len);
}
const mirroredLocal = nodes.map(() => []);
const mirroredPelvisPos = [];
let mismatched = 0;

for (let k = 0; k < frames; k++) {
  const g = worldRots(k);
  const out = [];
  const at = (i) => {
    if (out[i]) return out[i];
    const p = partner[i];
    // The partner's world-space change from its rest pose, reflected, on top of our own rest pose.
    const delta = mul(g[p], inv(rest[p]));
    return (out[i] = mul(reflect(delta), rest[i]));
  };
  nodes.forEach((_, i) => {
    const world = at(i);
    mirroredLocal[i][k] = parent[i] === undefined ? world : mul(inv(at(parent[i])), world);
  });
  if (tracks[pelvis]?.pos) {
    const pp = parent[pelvis];
    const t = tracks[pelvis].pos.get(Math.min(k, tracks[pelvis].pos.count - 1));
    const v = apply(pp === undefined ? IDENTITY : g[pp], t);
    const w = reflectVec(v);
    mirroredPelvisPos[k] = apply(inv(pp === undefined ? IDENTITY : out[pp]), w);
  }
}

nodes.forEach((_, i) => {
  const t = tracks[i].rot;
  if (!t || ignored.has(i)) return;
  if (t.count !== (tracks[partner[i]].rot?.count ?? t.count)) mismatched++;
  for (let k = 0; k < t.count; k++) t.set(k, mirroredLocal[i][k]);
});
if (tracks[pelvis]?.pos) for (let k = 0; k < tracks[pelvis].pos.count; k++) tracks[pelvis].pos.set(k, mirroredPelvisPos[k]);

writeFileSync(outPath, buf);
const paired = partner.filter((p, i) => p !== i).length;
const axis = midlineNormal.map((x) => x.toFixed(2)).join(', ');
console.log(`${outPath}: mirrored ${frames} frames across n=(${axis}), ${paired} paired bones${mismatched ? `, ${mismatched} with mismatched key counts (held)` : ''}`);
