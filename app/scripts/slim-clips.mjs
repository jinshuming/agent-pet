#!/usr/bin/env node
// Cut PINOC metahuman-glb clips down to the 86 bones the pet's characters are bound to.
//
// A metahuman-glb skins all 441 MetaHuman joints (face, twist and IK bones included).
// splat-engine sizes a clip by its skin, not by what it animates: every joint gets a
// keyframe object per frame in the JS heap (~20 MB per clip), and at play time the
// clip is filtered down to the character's 86-bone rig anyway. Skinning only those 86
// (splat-engine's BONE_NAMES rig, whose parents all stay inside the set) gives the same
// pose at about a fifth of the file size and memory. Node hierarchy is left untouched.
//
// Safe to run again: a clip already skinned to 86 joints is skipped.
// usage: node scripts/slim-clips.mjs assets/motions/*.glb
import { readFileSync, writeFileSync } from 'node:fs';

/** splat-engine's 86-bone character rig (Armature.boneNames of every PINOC character). */
const BONES = [
  'root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'spine_04', 'spine_05', 'neck_01', 'neck_02', 'head',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'pinky_metacarpal_l', 'pinky_01_l', 'pinky_02_l', 'pinky_03_l', 'ring_metacarpal_l', 'ring_01_l', 'ring_02_l', 'ring_03_l',
  'thumb_01_l', 'thumb_02_l', 'thumb_03_l', 'middle_metacarpal_l', 'middle_01_l', 'middle_02_l', 'middle_03_l',
  'index_metacarpal_l', 'index_01_l', 'index_02_l', 'index_03_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'pinky_metacarpal_r', 'pinky_01_r', 'pinky_02_r', 'pinky_03_r', 'ring_metacarpal_r', 'ring_01_r', 'ring_02_r', 'ring_03_r',
  'thumb_01_r', 'thumb_02_r', 'thumb_03_r', 'middle_metacarpal_r', 'middle_01_r', 'middle_02_r', 'middle_03_r',
  'index_metacarpal_r', 'index_01_r', 'index_02_r', 'index_03_r',
  'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'littletoe_01_r', 'littletoe_02_r', 'ringtoe_01_r', 'ringtoe_02_r',
  'middletoe_01_r', 'middletoe_02_r', 'bigtoe_01_r', 'bigtoe_02_r', 'indextoe_01_r', 'indextoe_02_r', 'calf_twist_01_r',
  'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'indextoe_01_l', 'indextoe_02_l', 'bigtoe_01_l', 'bigtoe_02_l',
  'littletoe_01_l', 'littletoe_02_l', 'middletoe_01_l', 'middletoe_02_l', 'ringtoe_01_l', 'ringtoe_02_l', 'calf_twist_01_l',
];

const pad4 = (n) => (n + 3) & ~3;

function slim(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));

  const skin = json.skins?.[0];
  if (!skin) return `${file}: no skin, skipped`;
  if (skin.joints.length === BONES.length) return `${file}: already ${BONES.length} joints, skipped`;
  const byName = new Map(json.nodes.map((n, i) => [n.name, i]));
  const missing = BONES.filter((b) => !byName.has(b));
  if (missing.length) throw new Error(`${file}: no node for ${missing.join(', ')}`);
  const keep = new Set(BONES.map((b) => byName.get(b)));

  skin.joints = BONES.map((b) => byName.get(b));
  delete skin.inverseBindMatrices; // optional in glTF, and unused by the pet

  // Keep only channels that drive a kept joint; renumber samplers and accessors.
  const anims = json.animations ?? [];
  const usedAccessors = new Map(); // old index -> new index
  const accessors = [];
  const takeAccessor = (i) => {
    if (!usedAccessors.has(i)) {
      usedAccessors.set(i, accessors.length);
      accessors.push(json.accessors[i]);
    }
    return usedAccessors.get(i);
  };
  for (const anim of anims) {
    const samplerMap = new Map();
    const samplers = [];
    anim.channels = anim.channels.filter((ch) => keep.has(ch.target.node));
    for (const ch of anim.channels) {
      if (!samplerMap.has(ch.sampler)) {
        const s = anim.samplers[ch.sampler];
        samplerMap.set(ch.sampler, samplers.length);
        samplers.push({ ...s, input: takeAccessor(s.input), output: takeAccessor(s.output) });
      }
      ch.sampler = samplerMap.get(ch.sampler);
    }
    anim.samplers = samplers;
  }

  // One tightly packed buffer view per kept accessor.
  const views = [];
  const chunks = [];
  let offset = 0;
  for (const acc of accessors) {
    const bv = json.bufferViews[acc.bufferView];
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type];
    const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
    const elem = comps * size;
    const stride = bv.byteStride || elem;
    const src = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const out = Buffer.alloc(acc.count * elem);
    for (let k = 0; k < acc.count; k++) bin.copy(out, k * elem, src + k * stride, src + k * stride + elem);
    views.push({ buffer: 0, byteOffset: offset, byteLength: out.length });
    chunks.push(out);
    const padded = pad4(out.length);
    if (padded > out.length) chunks.push(Buffer.alloc(padded - out.length));
    acc.bufferView = views.length - 1;
    delete acc.byteOffset;
    offset += padded;
  }
  json.accessors = accessors;
  json.bufferViews = views;
  json.buffers = [{ byteLength: offset }];

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
  const out = Buffer.concat([header, jsonHead, jsonBuf, binHead, newBin]);
  writeFileSync(file, out);
  const kb = (n) => `${Math.round(n / 1024)} KB`;
  return `${file}: ${json.nodes.length} nodes, joints 441 → ${BONES.length}, ${kb(buf.length)} → ${kb(out.length)}`;
}

let failed = false;
for (const f of process.argv.slice(2)) {
  try {
    console.log(slim(f));
  } catch (err) {
    failed = true;
    console.error(String(err.message ?? err));
  }
}
process.exit(failed ? 1 : 0);
