// Clothes: a top, a bottom and hair drawn as a thin shell just off the skin, to see which
// tattoos a T-shirt, tank top, shorts or jeans would cover. For looking only: nothing
// is saved, the ink underneath is untouched, and the clothes follow shape and pose.
//
// Coverage is a signed margin per body vertex (metres, > 0 covered), worked out on the
// rest body from the rig's bone weights (which part of the body a vertex belongs to)
// and distances along the arm and leg. The margin is interpolated across triangles and
// the shader drops pixels below zero, so hems and necklines are smooth curves rather
// than the mesh's triangle edges.
import { POSE_BONES, boneWeightSum } from './pose.js';

export const TOPS = Object.freeze({ none: 'None', tank: 'Tank top', tee: 'T-shirt', long: 'Long sleeve' });
export const BOTTOMS = Object.freeze({ none: 'None', swim: 'Swim briefs', shorts: 'Shorts', pants: 'Long pants' });
export const HAIR = Object.freeze({ none: 'None', short: 'Short', neck: 'Long' }); // long: covers the back of the neck

function descendants(root) {
  const i0 = POSE_BONES.findIndex((b) => b.name === root), out = [root], keep = new Set([i0]);
  POSE_BONES.forEach((b, i) => { if (keep.has(b.parent)) { keep.add(i); out.push(b.name); } });
  return out;
}
let groups = null;
function boneGroups() {
  if (!groups) {
    const g = (roots) => { const a = roots.map((r) => boneWeightSum(descendants(r))); return a[0].map((_, v) => a.reduce((s, x) => s + x[v], 0)); };
    groups = { arm: g(['upperarm01.L', 'upperarm01.R']), leg: g(['upperleg01.L', 'upperleg01.R']), head: g(['neck01']) };
  }
  return groups;
}
const joint = (joints, name, end = 'head') => { const b = POSE_BONES.find((x) => x.name === name), i = b[end] * 3; return [joints[i], joints[i + 1], joints[i + 2]]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);

// Garments, in metres on a 1.75 m body (the body is always normalised to that height).
// neck: radius of the neck opening and how far it dips at the front and back.
// sleeve / leg: length from the shoulder or hip joint, or `full` for wrist or ankle length.
const TOP_CUT = {
  tank: { neck: 0.085, front: 0.11, back: 0.07, strap: 0.122, armpit: 0.11 },
  tee: { neck: 0.075, front: 0.045, back: 0.015, sleeve: 0.15 },
  long: { neck: 0.072, front: 0.04, back: 0.012, sleeve: 'full' },
};
const BOTTOM_CUT = {
  swim: { waist: 0.05, leg: 0.085 },
  shorts: { waist: 0.09, leg: 0.27 },
  pants: { waist: 0.09, leg: 'full' },
};

// Signed coverage per vertex for one garment, from rest positions and rest joints.
export function coverage(positions, joints, top = 'none', bottom = 'none', hair = 'none') {
  const n = positions.length / 3, G = boneGroups();
  if (G.arm.length !== n) throw new Error('Clothes need the full body');
  const neck = joint(joints, 'neck01'), neckY = neck[1], neckZ = neck[2], hipY = joint(joints, 'upperleg01.L')[1], frontZ = joint(joints, 'spine01')[2];
  const limb = (side, a, b) => { const s = joint(joints, a + side), e = joint(joints, b + side), d = sub(e, s), l = len(d); return { s, dir: d.map((x) => x / l), l }; };
  const arms = { L: limb('.L', 'upperarm01', 'wrist'), R: limb('.R', 'upperarm01', 'wrist') }, legs = { L: limb('.L', 'upperleg01', 'foot'), R: limb('.R', 'upperleg01', 'foot') };
  const shoulderY = arms.L.s[1];
  const T = TOP_CUT[top], B = BOTTOM_CUT[bottom];
  const outTop = new Float32Array(n).fill(-1), outBottom = new Float32Array(n).fill(-1), outHair = new Float32Array(n).fill(-1);
  const headZ = joint(joints, 'head')[2], eyeY = joint(joints, 'eye.L')[1], napeY = hair === 'neck' ? neckY - 0.01 : joint(joints, 'neck03')[1] + 0.02;
  for (let v = 0; v < n; v++) {
    const p = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]], side = p[0] >= 0 ? 'L' : 'R';
    const arm = G.arm[v], leg = G.leg[v], head = G.head[v];
    // How far a limb part reaches: only bites where the vertex mostly follows that limb,
    // so the side of the chest never gets cut by a sleeve length (and no seam shows where
    // the torso meets the arm or leg).
    const limbCut = (weight, reach, t) => Math.max(reach - t, (0.5 - weight) * 0.2);
    if (T) {
      const front = Math.min(1, Math.max(0, (p[2] - frontZ) / 0.06));
      const dip = T.back + (T.front - T.back) * front;
      const neckOpen = Math.max(neckY - 0.012 - dip - p[1], Math.hypot(p[0], p[2] - neckZ) - T.neck);
      const a = arms[side], t = dot(sub(p, a.s), a.dir), reach = !T.sleeve ? -1 : T.sleeve === 'full' ? a.l - 0.015 : T.sleeve;
      let m = Math.min((0.5 - leg - head) * 0.2, limbCut(arm, reach, t), neckOpen, Math.max(p[1] - (hipY + 0.02), (arm - 0.5) * 0.2));
      if (T.strap) m = Math.min(m, Math.max(shoulderY - T.armpit - p[1], T.strap - Math.abs(p[0])));
      outTop[v] = m;
    }
    if (B) {
      const l = legs[side], t = dot(sub(p, l.s), l.dir), reach = B.leg === 'full' ? l.l - 0.03 : B.leg;
      outBottom[v] = Math.min((0.5 - arm - head) * 0.2, limbCut(leg, reach, t), hipY + B.waist - p[1]);
    }
    if (hair !== 'none') {
      // hairline: high at the forehead, low at the nape; ears stay clear
      const f = Math.min(1, Math.max(0, (p[2] - (headZ - 0.02)) / 0.09));
      const line = napeY + (eyeY + 0.065 - napeY) * f * f * (3 - 2 * f);
      const ears = Math.max(0.066 - Math.abs(p[0]), p[1] - (eyeY + 0.035), headZ - 0.035 - p[2]);
      const member = hair === 'neck' ? Math.max((head - 0.5) * 0.2, Math.min(0.02, headZ - 0.02 - p[2], p[1] - napeY)) : (head - 0.5) * 0.2;
      outHair[v] = Math.min(member, p[1] - line, ears);
    }
  }
  return { top: outTop, bottom: outBottom, hair: outHair };
}

const LIFT = { top: 0.009, bottom: 0.006, hair: 0.012 };
export function createClothes({ THREE, bodyGeo, scene, rig, posed }) {
  const make = (color, lift) => {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float cover;\nvarying float vCover;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCover = cover;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCover;').replace('void main() {', 'void main() {\nif (vCover < 0.0) discard;');
    };
    const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; mesh.renderOrder = 2; scene.add(mesh);
    return { geo, mat, mesh, lift, cover: null, key: '' };
  };
  const parts = { top: make(0x7f8794, LIFT.top), bottom: make(0x3e5272, LIFT.bottom), hair: make(0x2e2620, LIFT.hair) };
  const KINDS = ['top', 'bottom', 'hair'], LISTS = { top: TOPS, bottom: BOTTOMS, hair: HAIR };
  let choice = { top: 'none', bottom: 'none', hair: 'none' }, coverKey = '', builtFor = '';
  const anyOn = () => KINDS.some((k) => choice[k] !== 'none');
  function build(part, cover) {
    // keep each triangle that has any covered corner; the shader trims the rest
    const I = bodyGeo.index.array, keep = [];
    for (let t = 0; t < I.length; t += 3) if (cover[I[t]] > 0 || cover[I[t + 1]] > 0 || cover[I[t + 2]] > 0) keep.push(I[t], I[t + 1], I[t + 2]);
    const n = cover.length;
    part.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    part.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    part.geo.setAttribute('cover', new THREE.BufferAttribute(cover, 1));
    part.geo.setIndex(keep);
    part.cover = cover;
  }
  // shapeKey: changes when the rest body changes. poseVersion: when the pose does.
  function sync(shapeKey, poseVersion) {
    const want = KINDS.map((k) => choice[k]).join('|') + '|' + shapeKey;
    if (want !== coverKey) {
      coverKey = want; builtFor = '';
      if (anyOn()) {
        const c = coverage(bodyGeo.attributes.position.array, rig().joints, choice.top, choice.bottom, choice.hair);
        for (const k of KINDS) build(parts[k], c[k]);
      }
    }
    for (const k of KINDS) parts[k].mesh.visible = choice[k] !== 'none';
    if (!anyOn()) return;
    const at = want + '|' + poseVersion;
    if (at === builtFor) return; builtFor = at;
    const src = posed() || bodyGeo, P = src.attributes.position.array, N = src.attributes.normal.array;
    for (const part of Object.values(parts)) {
      if (!part.mesh.visible) continue;
      const out = part.geo.attributes.position.array, nor = part.geo.attributes.normal.array;
      for (let i = 0; i < out.length; i++) { out[i] = P[i] + N[i] * part.lift; nor[i] = N[i]; }
      part.geo.attributes.position.needsUpdate = true; part.geo.attributes.normal.needsUpdate = true;
      part.geo.computeBoundingSphere();
    }
  }
  return {
    get choice() { return { ...choice }; },
    set(next) { const c = { ...choice, ...next }; for (const k of KINDS) if (!Object.hasOwn(LISTS[k], c[k])) throw new Error('Unknown clothes'); choice = c; },
    sync,
    meshes: () => KINDS.map((k) => parts[k].mesh),
    // Share of a tattoo's skin (decal support vertices) that the clothes cover, 0..1.
    coveredShare(supports) { if (!supports || !supports.length || !anyOn()) return 0; let c = 0; for (const v of supports) if (this.covered(v)) c++; return c / supports.length; },
    covered(vertex) { return KINDS.some((k) => choice[k] !== 'none' && parts[k].cover && parts[k].cover[vertex] > 0); },
  };
}
