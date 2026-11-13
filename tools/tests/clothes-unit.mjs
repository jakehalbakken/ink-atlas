// Clothes coverage on the real body and rig, for each figure: what each garment covers.
import assert from 'node:assert/strict';
import { createRestRig, POSE_BONES } from '../../src/pose.js';
import { coverage, TOPS, BOTTOMS, HAIR } from '../../src/clothes.js';
for (const figure of ['male', 'female', 'neutral']) {
  const r = createRestRig({ figure }), P = r.positions, n = P.length / 3;
  const J = (name) => { const b = POSE_BONES.find((x) => x.name === name); return [...r.joints.slice(b.head * 3, b.head * 3 + 3)]; };
  const near = (pt, rad = 0.03) => { const out = []; for (let v = 0; v < n; v++) if (Math.hypot(P[v * 3] - pt[0], P[v * 3 + 1] - pt[1], P[v * 3 + 2] - pt[2]) < rad) out.push(v); assert.ok(out.length, 'found skin near ' + pt); return out; };
  const share = (arr, vs) => vs.filter((v) => arr[v] > 0).length / vs.length;
  // landmarks on the skin
  const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const sh = J('upperarm01.L'), wr = J('wrist.L'), hip = J('upperleg01.L'), ft = J('foot.L'), neck = J('neck01'), headJ = J('head');
  const verts = (pt, rad) => near(pt, rad);
  const chest = verts([0.07, sh[1] - 0.12, 0.12], 0.06).filter((v) => P[v * 3 + 2] > 0.06);
  const forearm = verts(lerp(sh, wr, 0.7), 0.06), upperArmTop = verts(lerp(sh, wr, 0.15), 0.05), hand = verts([wr[0] + 0.06, wr[1] - 0.06, wr[2]], 0.04);
  const calf = verts(lerp(hip, ft, 0.75), 0.07), thighTop = verts(lerp(hip, ft, 0.12), 0.07), foot = verts([ft[0], 0.02, ft[2] + 0.04], 0.05);
  const scalp = verts([0, 1.75, headJ[2]], 0.04), face = verts([0, J('eye.L')[1] - 0.04, 0.14], 0.03);
  const back = (y) => { let best = -1; for (let v = 0; v < n; v++) if (Math.abs(P[v * 3 + 1] - y) < 0.01 && Math.abs(P[v * 3]) < 0.02 && (best < 0 || P[v * 3 + 2] < P[best * 3 + 2])) best = v; return [P[best * 3], P[best * 3 + 1], P[best * 3 + 2]]; };
  const nape = verts(back(neck[1] + 0.03), 0.025);
  const throat = verts([0, neck[1] - 0.005, neck[2] + 0.06], 0.03);
  const tee = coverage(P, r.joints, 'tee', 'shorts', 'short'), long = coverage(P, r.joints, 'long', 'pants', 'neck'), tank = coverage(P, r.joints, 'tank', 'swim');
  const none = coverage(P, r.joints);
  assert.ok(['top', 'bottom', 'hair'].every((k) => none[k].every((x) => x < 0)), 'no clothes, nothing covered');
  assert.ok(share(tee.top, chest) > 0.95, figure + ' tee covers the chest');
  assert.ok(share(tee.top, upperArmTop) > 0.9, figure + ' tee sleeve covers the top of the arm');
  assert.ok(share(tee.top, forearm) < 0.05, figure + ' tee leaves the forearm: ' + share(tee.top, forearm));
  assert.ok(share(long.top, forearm) > 0.95, figure + ' long sleeve covers the forearm');
  assert.ok(share(long.top, hand) < 0.05 && share(tee.top, hand) === 0, figure + ' hands show');
  assert.ok(share(tee.top, throat) < 0.2, figure + ' neckline leaves the throat');
  assert.ok(share(tank.top, chest) > 0.9 && share(tank.top, upperArmTop) < 0.1, figure + ' tank: chest covered, arm bare');
  assert.ok(share(tee.bottom, thighTop) > 0.9 && share(tee.bottom, calf) < 0.05, figure + ' shorts cover the thigh, not the calf');
  assert.ok(share(long.bottom, calf) > 0.95 && share(long.bottom, foot) < 0.05, figure + ' pants cover the calf, not the foot');
  assert.ok(share(tank.bottom, thighTop) < 0.6, figure + ' swim briefs leave most of the upper thigh');
  assert.ok(share(tee.hair, scalp) > 0.95 && share(tee.hair, face) === 0, figure + ' hair on the scalp, not the face');
  assert.ok(share(tee.hair, nape) < 0.3 && share(long.hair, nape) > 0.7, figure + ' only the longer hair covers the nape: ' + share(tee.hair, nape) + ' ' + share(long.hair, nape));
}
assert.ok(TOPS.tee && BOTTOMS.pants && HAIR.short, 'plain names');
console.log('PASS clothes-unit coverage per garment, three figures');
