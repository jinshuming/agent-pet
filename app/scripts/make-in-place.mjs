#!/usr/bin/env node
// Turn a clip with root motion (a walk that travels) into one that stays on the
// spot: the pelvis keeps its bob (y) but loses its travel over the floor (x, z).
// The pet then moves the window instead, at the speed this prints, so the feet
// don't slide. splat-engine drives the body from the pelvis track.
//
// usage: node scripts/make-in-place.mjs in.glb out.glb
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: node scripts/make-in-place.mjs in.glb out.glb');
  process.exit(1);
}

const buf = readFileSync(inPath);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${inPath}: not a GLB`);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binOffset = 20 + jsonLen + 8;
const anim = json.animations[0];
const pelvis = json.nodes.findIndex((n) => n.name === 'pelvis');
const ch = anim.channels.find((c) => c.target.node === pelvis && c.target.path === 'translation');
if (!ch) throw new Error(`${inPath}: no pelvis translation track`);
const sampler = anim.samplers[ch.sampler];
const acc = json.accessors[sampler.output];
if (acc.componentType !== 5126) throw new Error(`${inPath}: pelvis translation is not float32`);
const bv = json.bufferViews[acc.bufferView];
const stride = bv.byteStride || 12;
const base = binOffset + (bv.byteOffset || 0) + (acc.byteOffset || 0);
const at = (k, c) => base + k * stride + c * 4;

const times = json.accessors[sampler.input];
const tb = binOffset + (json.bufferViews[times.bufferView].byteOffset || 0) + (times.byteOffset || 0);
const duration = buf.readFloatLE(tb + (times.count - 1) * 4) - buf.readFloatLE(tb);

const x0 = buf.readFloatLE(at(0, 0));
const z0 = buf.readFloatLE(at(0, 2));
const dx = buf.readFloatLE(at(acc.count - 1, 0)) - x0;
const dz = buf.readFloatLE(at(acc.count - 1, 2)) - z0;
for (let k = 0; k < acc.count; k++) {
  // Remove the steady travel, keep the small side-to-side sway around it.
  const f = k / (acc.count - 1);
  buf.writeFloatLE(buf.readFloatLE(at(k, 0)) - dx * f, at(k, 0));
  buf.writeFloatLE(buf.readFloatLE(at(k, 2)) - dz * f, at(k, 2));
}
// The bounds must still hold the (now smaller) range.
const xs = [], zs = [];
for (let k = 0; k < acc.count; k++) {
  xs.push(buf.readFloatLE(at(k, 0)));
  zs.push(buf.readFloatLE(at(k, 2)));
}
if (acc.min && acc.max) {
  acc.min[0] = Math.min(...xs);
  acc.max[0] = Math.max(...xs);
  acc.min[2] = Math.min(...zs);
  acc.max[2] = Math.max(...zs);
  const patched = Buffer.from(JSON.stringify(json).padEnd(jsonLen, ' '));
  if (patched.length !== jsonLen) throw new Error('GLB JSON grew; bounds not patched');
  patched.copy(buf, 20);
}
writeFileSync(outPath, buf);
const speed = Math.hypot(dx, dz) / duration;
console.log(`${outPath}: removed ${Math.hypot(dx, dz).toFixed(2)} m of travel over ${duration.toFixed(2)} s → move the window at ${speed.toFixed(3)} m/s`);
