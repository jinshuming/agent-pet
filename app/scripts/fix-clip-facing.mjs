#!/usr/bin/env node
// PINOC text-to-motion clips come out facing away from the camera compared to
// the library clips the pet is framed for. splat-engine drives the body from the
// pelvis (the root track is ignored), so turn the clip 180° about the vertical
// axis in place: pelvis rotation q → Ry(180°)·q, pelvis translation (x,y,z) → (-x,y,-z).
//
// A clip is only flipped when that brings its first pelvis pose closer to the
// reference idle clip, so running this twice (or on library clips) is a no-op.
//
// usage: node scripts/fix-clip-facing.mjs [--ref assets/motions/idle.glb] clip.glb ...
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const refAt = args.indexOf('--ref');
const refPath = refAt >= 0 ? args.splice(refAt, 2)[1] : new URL('../assets/motions/idle.glb', import.meta.url).pathname;

function open(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binOffset = 20 + jsonLen + 8;
  const anim = json.animations[0];
  const pelvis = json.nodes.findIndex((n) => n.name === 'pelvis');
  /** Read/write accessor of the pelvis track for `path`. */
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
    const at = (k, c) => base + k * stride + c * size;
    return {
      count: acc.count,
      get: (k) => Array.from({ length: n }, (_, c) => (short ? buf.readInt16LE(at(k, c)) / 32767 : buf.readFloatLE(at(k, c)))),
      set: (k, v) => v.forEach((x, c) => (short ? buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), at(k, c)) : buf.writeFloatLE(x, at(k, c)))),
    };
  };
  return { buf, rot: track('rotation'), pos: track('translation') };
}

/** Ry(180°)·q for q = [x, y, z, w]. */
const turn = ([x, y, z, w]) => [z, w, -x, -y];
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));

const refPose = open(refPath).rot.get(0);

for (const file of args) {
  const clip = open(file);
  if (!clip.rot) {
    console.log(`${file}: no pelvis rotation track, skipped`);
    continue;
  }
  const first = clip.rot.get(0);
  if (angle(turn(first), refPose) >= angle(first, refPose)) {
    console.log(`${file}: already faces the camera, unchanged`);
    continue;
  }
  for (let k = 0; k < clip.rot.count; k++) clip.rot.set(k, turn(clip.rot.get(k)));
  if (clip.pos) for (let k = 0; k < clip.pos.count; k++) {
    const [x, y, z] = clip.pos.get(k);
    clip.pos.set(k, [-x, y, -z]);
  }
  writeFileSync(file, clip.buf);
  console.log(`${file}: turned 180° (${clip.rot.count} rotation keys)`);
}
