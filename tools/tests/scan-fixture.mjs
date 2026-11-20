// Stand-in body scans for the scan tests: the body itself made into another person (heavier, less
// muscular, wider hips, arms closer in with straight elbows, feet apart), as a phone app might
// save it: in metres at 1.83 m, lying with Z up and turned, on a patch of floor. Written as GLB
// (by hand, one mesh under a node with its own transform), OBJ and the plain triangle list.
import { skinForState } from '../../src/scan-body.js';
import { createRestRig } from '../../src/pose.js';
import { INDEX, COUNTS } from '../../src/mesh.js';
import { mul3, turnY } from '../../src/scan-fit.js';

export const PERSON = { figure: 'male', muscle: 0.3, weight: 0.78, fit: { hips: 0.4, chest: 0.2 } };
export const STANCE = { L: { lift: -0.35, straight: 1 }, R: { lift: -0.25, straight: 1 }, legL: 0.12, legR: 0.08 };
export const TALL = 1.83;

// { positions (metres, Z up, turned, floor added), index } and the node transform used for GLB
export function personScan({ floor = true, turn = 0.61 } = {}) {
  const posed = skinForState(PERSON)(STANCE)(createRestRig(PERSON).positions);
  const tris = []; for (let t = 0; t < INDEX.length; t += 3) if (INDEX[t] < COUNTS.body && INDEX[t + 1] < COUNTS.body && INDEX[t + 2] < COUNTS.body) tris.push(INDEX[t], INDEX[t + 1], INDEX[t + 2]);
  const R = mul3([1, 0, 0, 0, 0, -1, 0, 1, 0], turnY(turn)), s = TALL / 1.75, n = COUNTS.body;
  const pos = [];
  for (let v = 0; v < n; v++) { const x = posed[v * 3], y = posed[v * 3 + 1], z = posed[v * 3 + 2]; pos.push(s * (R[0] * x + R[1] * y + R[2] * z) + 0.4, s * (R[3] * x + R[4] * y + R[5] * z) - 1.2, s * (R[6] * x + R[7] * y + R[8] * z) + 0.05); }
  const idx = tris.slice();
  if (floor) { let zlo = Infinity; for (let i = 2; i < pos.length; i += 3) zlo = Math.min(zlo, pos[i]); const b = pos.length / 3, h = 0.6, z = zlo - 0.002; pos.push(0.4 - h, -1.2 - h, z, 0.4 + h, -1.2 - h, z, 0.4 + h, -1.2 + h, z, 0.4 - h, -1.2 + h, z); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  return { positions: new Float32Array(pos), index: new Uint32Array(idx) };
}

// A GLB with the mesh under a node that moves it 2 m along x (the reader must use world space)
export function glb({ positions, index }) {
  const P = new Float32Array(positions); for (let i = 0; i < P.length; i += 3) P[i] -= 2;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i++) { const k = i % 3; lo[k] = Math.min(lo[k], P[i]); hi[k] = Math.max(hi[k], P[i]); }
  const pb = Buffer.from(P.buffer), ib = Buffer.from(new Uint32Array(index).buffer), bin = Buffer.concat([pb, ib]);
  const json = {
    asset: { version: '2.0', generator: 'ink-atlas test' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, translation: [2, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pb.length, target: 34962 }, { buffer: 0, byteOffset: pb.length, byteLength: ib.length, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: P.length / 3, type: 'VEC3', min: lo, max: hi }, { bufferView: 1, componentType: 5125, count: index.length, type: 'SCALAR' }],
  };
  let js = Buffer.from(JSON.stringify(json)); if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
  let bn = bin; if (bn.length % 4) bn = Buffer.concat([bn, Buffer.alloc(4 - (bn.length % 4))]);
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bn.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.write('JSON', 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bn.length, 0); c2.write('BIN\0', 4);
  return Buffer.concat([head, c1, js, c2, bn]);
}

// An OBJ wound the other way round, in centimetres
export function obj({ positions, index }) {
  const out = ['# scan'];
  for (let i = 0; i < positions.length; i += 3) out.push(`v ${(positions[i] * 100).toFixed(3)} ${(positions[i + 1] * 100).toFixed(3)} ${(positions[i + 2] * 100).toFixed(3)}`);
  for (let t = 0; t < index.length; t += 3) out.push(`f ${index[t] + 1} ${index[t + 2] + 1} ${index[t + 1] + 1}`);
  return out.join('\n');
}
