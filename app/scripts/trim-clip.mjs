#!/usr/bin/env node
// Cut a time range out of a clip, so it starts at 0, and pin the pelvis over one
// spot on the floor (x, z held at the clip's first frame; the y bob stays).
// For game mode's jump: the library Jump crouches for 0.7 s before leaving the
// ground, far too slow for a key press, and travels forward a metre; the window
// does the travelling instead.
//
// usage: node scripts/trim-clip.mjs in.glb out.glb <from s> <to s>
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath, fromArg, toArg] = process.argv.slice(2);
const from = Number(fromArg);
const to = Number(toArg);
if (!inPath || !outPath || !(to > from)) {
  console.error('usage: node scripts/trim-clip.mjs in.glb out.glb <from s> <to s>');
  process.exit(1);
}

const pad4 = (n) => (n + 3) & ~3;
const buf = readFileSync(inPath);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${inPath}: not a GLB`);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));

const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const floats = (i) => {
  const acc = json.accessors[i];
  if (acc.componentType !== 5126) throw new Error(`${inPath}: accessor ${i} is not float32`);
  const n = COMPS[acc.type];
  const bv = json.bufferViews[acc.bufferView];
  const stride = bv.byteStride || n * 4;
  const src = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  return Array.from({ length: acc.count }, (_, k) => Array.from({ length: n }, (_, c) => bin.readFloatLE(src + k * stride + c * 4)));
};

const anim = json.animations[0];
const pelvis = json.nodes.findIndex((n) => n.name === 'pelvis');
const accessors = [];
const views = [];
const chunks = [];
let offset = 0;
/** Append a packed float accessor holding `rows`; returns its index. */
function push(rows, type) {
  const n = COMPS[type];
  const out = Buffer.alloc(rows.length * n * 4);
  rows.forEach((r, k) => r.forEach((v, c) => out.writeFloatLE(v, (k * n + c) * 4)));
  const min = Array.from({ length: n }, (_, c) => Math.min(...rows.map((r) => r[c])));
  const max = Array.from({ length: n }, (_, c) => Math.max(...rows.map((r) => r[c])));
  accessors.push({ bufferView: views.length, componentType: 5126, count: rows.length, type, min, max });
  views.push({ buffer: 0, byteOffset: offset, byteLength: out.length });
  chunks.push(out, Buffer.alloc(pad4(out.length) - out.length));
  offset += pad4(out.length);
  return accessors.length - 1;
}

const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
/** Append elements k0..k1 of accessor `i` as they are (rotations may be normalized integers); returns the new index. */
function copy(i, k0, k1) {
  const acc = json.accessors[i];
  const elem = COMPS[acc.type] * SIZE[acc.componentType];
  const bv = json.bufferViews[acc.bufferView];
  const stride = bv.byteStride || elem;
  const src = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = Buffer.alloc((k1 - k0 + 1) * elem);
  for (let k = k0; k <= k1; k++) bin.copy(out, (k - k0) * elem, src + k * stride, src + k * stride + elem);
  const { min, max, byteOffset, ...rest } = acc;
  accessors.push({ ...rest, bufferView: views.length, count: k1 - k0 + 1 });
  views.push({ buffer: 0, byteOffset: offset, byteLength: out.length });
  chunks.push(out, Buffer.alloc(pad4(out.length) - out.length));
  offset += pad4(out.length);
  return accessors.length - 1;
}

anim.samplers = anim.samplers.map((s, si) => {
  const times = floats(s.input).map((r) => r[0]);
  let k0 = times.findIndex((t) => t >= from - 1e-4);
  let k1 = times.findLastIndex((t) => t <= to + 1e-4);
  // A constant track (one or two keys) keeps a single key at its first value.
  if (k0 < 0 || k1 < k0) k0 = k1 = 0;
  const t0 = times[k0];
  const pinned = anim.channels.some((c) => c.sampler === si && c.target.node === pelvis && c.target.path === 'translation');
  const input = push(times.slice(k0, k1 + 1).map((t) => [t - t0]), 'SCALAR');
  if (!pinned) return { ...s, input, output: copy(s.output, k0, k1) };
  // Over where the clip starts, like every other clip: the range's own start may be a metre on.
  const all = floats(s.output);
  const output = push(all.slice(k0, k1 + 1).map(([, y]) => [all[0][0], y, all[0][2]]), 'VEC3');
  return { ...s, input, output };
});
json.accessors = accessors;
json.bufferViews = views;
json.buffers = [{ byteLength: offset }];
delete json.skins?.[0]?.inverseBindMatrices; // its accessor is gone; unused by the pet

const newBin = Buffer.concat(chunks);
let jsonBuf = Buffer.from(JSON.stringify(json));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(jsonBuf.length, 0);
jsonHead.writeUInt32LE(0x4e4f534a, 4); // JSON
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(newBin.length, 0);
binHead.writeUInt32LE(0x004e4942, 4); // BIN
writeFileSync(outPath, Buffer.concat([header, jsonHead, jsonBuf, binHead, newBin]));
console.log(`${outPath}: ${from}–${to} s of ${inPath}, pelvis pinned over the floor`);
