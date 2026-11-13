// Clothes: a top, a bottom and hair, to see which tattoos a T-shirt, tank top, shorts or
// jeans would cover. For looking only: nothing is saved, the ink underneath is untouched,
// and the clothes follow shape and pose.
//
// Each garment is cut from the body surface, then given room: it stands off the skin by
// a garment-specific ease (looser toward a T-shirt's hem or down a jean leg), and it
// bridges hollows instead of following them (no navel, crease or crotch showing through).
// Folds, hems with stitching, knit or denim texture and soft fabric sheen are drawn in
// the material, so they cost no extra geometry and follow every pose.
//
// Coverage is a signed margin per body vertex (metres, > 0 covered), worked out on the
// rest body from the rig's bone weights (which part of the body a vertex belongs to)
// and distances along the arm and leg. The margin is interpolated across triangles and
// the shader drops pixels below zero, so hems and necklines are smooth curves rather
// than the mesh's triangle edges.
import { POSE_BONES, boneWeightSum } from './pose.js';
import { INDEX, COUNTS } from './mesh.js';

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

// ---- how each garment sits: ease off the skin (metres) by region and position
// t: 0 at the top of the region, 1 at the hem. Returns metres.
const EASE = {
  tee: { torso: (t) => 0.009 + 0.016 * t * t, arm: (t) => 0.013 + 0.012 * t },
  long: { torso: (t) => 0.007 + 0.011 * t * t, arm: (t) => 0.009 + 0.008 * t - 0.012 * Math.max(0, t - 0.88) / 0.12 },
  tank: { torso: (t) => 0.006 + 0.012 * t * t, arm: () => 0.006 },
  swim: { hips: () => 0.0025, leg: () => 0.0025 },
  shorts: { hips: () => 0.008, leg: (t) => 0.012 + 0.014 * t },
  pants: { hips: () => 0.006, leg: (t) => 0.009 + 0.022 * Math.min(1, t * 1.15) },
};
const MIN_LIFT = { top: 0.0055, bottom: 0.0035, hair: 0.004 };
const LOOK = {
  // colour, roughness, sheen, pattern: 0 knit, 1 denim, 2 smooth, 3 hair
  tee: { color: 0x8d939c, rough: 0.94, sheen: 0.55, pattern: 0 },
  long: { color: 0x3a3e46, rough: 0.92, sheen: 0.5, pattern: 0 },
  tank: { color: 0x26292f, rough: 0.9, sheen: 0.45, pattern: 0 },
  swim: { color: 0x1d2027, rough: 0.55, sheen: 0.25, pattern: 2 },
  shorts: { color: 0x3a4660, rough: 0.9, sheen: 0.4, pattern: 0 },
  pants: { color: 0x3c5679, rough: 0.88, sheen: 0.3, pattern: 1 },
  hair: { color: 0x241b15, rough: 0.55, sheen: 0.22, pattern: 3 },
};

// Per-vertex: how much room each garment gives, and where the vertex sits for the folds
// (region: 0 torso, 1 arm, 2 leg, 3 head; distance along it; angle around it).
export function fit(positions, joints, top = 'none', bottom = 'none', hair = 'none') {
  const n = positions.length / 3, G = boneGroups();
  const easeTop = new Float32Array(n), easeBottom = new Float32Array(n), easeHair = new Float32Array(n), place = new Float32Array(n * 4);
  const neck = joint(joints, 'neck01'), hip = joint(joints, 'upperleg01.L'), spine = joint(joints, 'spine01'), chestY = joint(joints, 'spine03')[1];
  const limb = (side, a, b) => { const s = joint(joints, a + side), e = joint(joints, b + side), d = sub(e, s), l = len(d); return { s, dir: d.map((x) => x / l), l }; };
  const arms = { L: limb('.L', 'upperarm01', 'wrist'), R: limb('.R', 'upperarm01', 'wrist') }, legs = { L: limb('.L', 'upperleg01', 'foot'), R: limb('.R', 'upperleg01', 'foot') };
  const headC = joint(joints, 'head'), crown = [headC[0], headC[1] + 0.13, headC[2] - 0.01];
  const T = EASE[top], B = EASE[bottom], sleeve = TOP_CUT[top] ? TOP_CUT[top].sleeve : null, legLen = BOTTOM_CUT[bottom] ? BOTTOM_CUT[bottom].leg : null;
  const around = (d, axis) => { const ref = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], x = sub(ref, axis.map((v) => v * dot(ref, axis))), lx = len(x), u = x.map((v) => v / lx), w = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]]; return Math.atan2(dot(d, w), dot(d, u)); };
  for (let v = 0; v < n; v++) {
    const p = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]], side = p[0] >= 0 ? 'L' : 'R';
    const arm = G.arm[v], leg = G.leg[v], head = G.head[v];
    const torsoT = Math.min(1, Math.max(0, (chestY - p[1]) / Math.max(0.05, chestY - hip[1]))), hipT = Math.min(1, Math.max(0, (hip[1] + 0.1 - p[1]) / 0.2));
    // where it sits, for the folds: x = how much it is arm (+) or leg (-), or 2 + for hair;
    // y = distance along that limb (or polar angle from the crown); z = angle around it.
    // (the angle goes in as its cosine and sine, so it has no seam where it wraps round)
    const put = (x, y, ang) => { place[v * 4] = x; place[v * 4 + 1] = y; place[v * 4 + 2] = Math.cos(ang); place[v * 4 + 3] = Math.sin(ang); };
    if (head > 0.5) { const d = sub(p, crown); put(2 + head, Math.acos(Math.max(-1, Math.min(1, -d[1] / (len(d) || 1)))), Math.atan2(d[0], d[2])); }
    else if (arm >= leg) { const a = arms[side], d = sub(p, a.s); put(arm, dot(d, a.dir), around(d, a.dir)); }
    else { const a = legs[side], d = sub(p, a.s); put(-leg, dot(d, a.dir), around(d, a.dir)); }
    if (T) {
      const a = arms[side], t = dot(sub(p, a.s), a.dir), reach = sleeve === 'full' ? a.l : sleeve || 0.08;
      const armE = T.arm(Math.min(1, Math.max(0, t / reach))), torE = T.torso(torsoT);
      easeTop[v] = torE + (armE - torE) * Math.min(1, Math.max(0, arm * 1.6 - 0.3));
    }
    if (B) {
      const l = legs[side], t = dot(sub(p, l.s), l.dir), reach = legLen === 'full' ? l.l : legLen || 0.1;
      const legE = B.leg(Math.min(1, Math.max(0, t / reach))), hipE = B.hips(hipT);
      easeBottom[v] = hipE + (legE - hipE) * Math.min(1, Math.max(0, leg * 1.6 - 0.3));
    }
    if (hair !== 'none') { const d = sub(p, headC); easeHair[v] = 0.005 + 0.012 * Math.max(0, Math.min(1, (d[1] + 0.02) / 0.12)) + (hair === 'neck' ? 0.006 * Math.max(0, Math.min(1, -d[2] / 0.08)) : 0); }
  }
  return { top: easeTop, bottom: easeBottom, hair: easeHair, place };
}

// Body triangles only (no eyes or genital geometry): garments are cut from the skin.
function bodyTriangles() { const out = []; for (let t = 0; t < INDEX.length; t += 3) if (INDEX[t] < COUNTS.body && INDEX[t + 1] < COUNTS.body && INDEX[t + 2] < COUNTS.body) out.push(INDEX[t], INDEX[t + 1], INDEX[t + 2]); return out; }
let BODY_TRIS = null;

const NOISE = `
float cHash(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float cNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(cHash(i),cHash(i+vec3(1,0,0)),f.x),mix(cHash(i+vec3(0,1,0)),cHash(i+vec3(1,1,0)),f.x),f.y),
  mix(mix(cHash(i+vec3(0,0,1)),cHash(i+vec3(1,0,1)),f.x),mix(cHash(i+vec3(0,1,1)),cHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float cFbm(vec3 p){float a=.5,s=0.0;for(int i=0;i<4;i++){s+=a*cNoise(p);p*=2.03;a*=.5;}return s;}
vec3 clothBump(vec3 surf_pos,vec3 surf_norm,vec2 dHdxy,float faceDirection){
 vec3 sx=normalize(dFdx(surf_pos)),sy=normalize(dFdy(surf_pos)),r1=cross(sy,surf_norm),r2=cross(surf_norm,sx);
 float det=dot(sx,r1)*faceDirection;vec3 g=sign(det)*(dHdxy.x*r1+dHdxy.y*r2);return normalize(abs(det)*surf_norm-g);}
`;
// Height of the fabric surface (metres) and a shade for its colour, from where it sits.
const HEIGHT = `
uniform float uPattern; uniform float uLong; uniform float uHem; uniform float uSleeve; uniform float uLoose;
float clothShade;
float clothHeight(vec3 p, vec4 place, float cover, float px){
 vec2 cs=normalize(place.zw+vec2(1e-5,0.0));
 float h=0.0; clothShade=1.0;
 // detail only where a pixel is small enough to show it
 float fine=1.0-smoothstep(.0005,.0016,px), mid=1.0-smoothstep(.002,.006,px);
 if(place.x>1.5){ // hair: strands running down from the crown
  float s=cNoise(vec3(cs*30.0,place.y*6.0))*.6+cNoise(vec3(cs*90.0,place.y*12.0))*.4;
  h+=.0008*s*mid;clothShade*=.8+.35*s;
  return h;
 }
 if(uPattern<1.5){ // knit or woven cotton: fine texture and a soft heathered colour
  h+=.0002*fine*(cNoise(p*vec3(900.0,1300.0,900.0))-.5);
  clothShade*=1.0+.06*(cFbm(p*45.0)-.5);
 }
 if(uPattern>.5&&uPattern<1.5){ // denim: twill and streaks down the leg
  h+=.00016*fine*sin((p.x+p.z+p.y)*1500.0);
  clothShade*=1.0+.14*(cNoise(vec3(cs*3.0,place.y*2.2))-.5)+.07*(cNoise(p*200.0)-.5);
 }
 float arm=clamp(place.x,0.0,1.0), leg=clamp(-place.x,0.0,1.0), torso=1.0-max(arm,leg);
 // body of a top: soft vertical drape below the chest, more toward the hem
 float ang=atan(p.x,p.z), lower=smoothstep(1.28,1.0,p.y), wob=cFbm(vec3(cos(ang)*1.5,sin(ang)*1.5,p.y*3.0));
 h+=torso*.003*lower*sin(ang*6.0+wob*9.0)*mid;
 // sleeves and trouser legs: uneven folds round the limb, bunching toward the end
 float along=place.y, w=cNoise(vec3(cs*1.2,along*9.0));
 float rings=sin(along*(arm>leg?150.0:105.0)+w*7.0+cNoise(vec3(cs*1.6,0.0))*4.0);
 float bunchArm=.0007+.0011*smoothstep(uSleeve*.4,uSleeve,along);
 float bunchLeg=.0006+.004*smoothstep(uLong-.18,uLong-.03,along);
 h+=uLoose*(arm*bunchArm+leg*bunchLeg)*rings*smoothstep(.25,.75,w+.3)*mid;
 // hems: a turned band with a line of stitching
 float band=smoothstep(uHem+.0015,uHem,cover);
 h+=.0009*band*mid; clothShade*=1.0-.07*band;
 float stitch=smoothstep(.0011,.0,abs(cover-uHem*.7))*step(.45,fract((p.x+p.y+p.z)*230.0))*fine;
 h-=.0003*stitch; clothShade*=1.0+.1*stitch;
 return h;
}
`;

export function createClothes({ THREE, bodyGeo, scene, rig, posed }) {
  const make = (kind) => {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x888888, roughness: 0.9, metalness: 0, sheen: 0.5, sheenRoughness: 0.75, sheenColor: new THREE.Color(0xbfc3c9), side: THREE.DoubleSide });
    const uniforms = { uPattern: { value: 0 }, uLong: { value: 1 }, uHem: { value: 0.014 }, uEdge: { value: 0 }, uSleeve: { value: 0.15 }, uLoose: { value: 1 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float cover;\nattribute vec3 rpos;\nattribute vec4 place;\nvarying float vCover;\nvarying vec3 vRpos;\nvarying vec4 vPlace;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCover = cover; vRpos = rpos; vPlace = place;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCover;\nvarying vec3 vRpos;\nvarying vec4 vPlace;\nuniform float uEdge;\n' + NOISE + HEIGHT)
        .replace('void main() {', 'void main() {\nfloat edgeCut = uEdge > 0.0 ? uEdge * cHash(floor(vRpos * 900.0)) : 0.0;\nif (vCover < edgeCut) discard;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat px = length(fwidth(vRpos));\nfloat clothH = clothHeight(vRpos, vPlace, vCover, px);\ndiffuseColor.rgb *= clothShade;\nif (!gl_FrontFacing) diffuseColor.rgb *= .45;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec2 dH = vec2(dFdx(clothH), dFdy(clothH)) / max(vec2(length(dFdx(vViewPosition)), length(dFdy(vViewPosition))), vec2(1e-6));\n  normal = clothBump(-vViewPosition, normal, clamp(dH, -1.5, 1.5), faceDirection); }');
    };
    mat.customProgramCacheKey = () => 'ink-cloth';
    const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; mesh.renderOrder = 2; scene.add(mesh);
    return { kind, geo, mat, uniforms, mesh, cover: null, ease: null, verts: null, nbr: null, key: '' };
  };
  const parts = { top: make('top'), bottom: make('bottom'), hair: make('hair') };
  const KINDS = ['top', 'bottom', 'hair'], LISTS = { top: TOPS, bottom: BOTTOMS, hair: HAIR };
  let choice = { top: 'none', bottom: 'none', hair: 'none' }, coverKey = '', builtFor = '', bareDepth = 0;
  const anyOn = () => KINDS.some((k) => choice[k] !== 'none');
  function style(part, name) {
    const L = part.kind === 'hair' ? LOOK.hair : LOOK[name] || LOOK.tee;
    part.mat.color.setHex(L.color); part.mat.roughness = L.rough; part.mat.sheen = L.sheen;
    part.mat.sheenColor.setHex(L.pattern === 3 ? 0x6b5242 : 0xc4c8ce);
    part.uniforms.uPattern.value = L.pattern;
    part.uniforms.uHem.value = part.kind === 'hair' ? -1 : name === 'swim' ? 0.006 : 0.014;
    part.uniforms.uEdge.value = part.kind === 'hair' ? 0.008 : 0;
    part.uniforms.uLoose.value = name === 'swim' ? 0 : name === 'tank' ? 0.6 : 1;
    const cut = TOP_CUT[name]; part.uniforms.uSleeve.value = cut && cut.sleeve === 'full' ? 0.58 : (cut && cut.sleeve) || 0.1;
  }
  function build(part, cover, ease, place, restP, legLength) {
    // keep each triangle that has any covered corner; the shader trims the rest
    if (!BODY_TRIS) BODY_TRIS = bodyTriangles();
    const I = BODY_TRIS, keep = [];
    for (let t = 0; t < I.length; t += 3) if (cover[I[t]] > 0 || cover[I[t + 1]] > 0 || cover[I[t + 2]] > 0) keep.push(I[t], I[t + 1], I[t + 2]);
    const n = cover.length;
    part.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    part.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    part.geo.setAttribute('cover', new THREE.BufferAttribute(cover, 1));
    part.geo.setAttribute('place', new THREE.BufferAttribute(place, 4));
    part.geo.setAttribute('rpos', new THREE.BufferAttribute(new Float32Array(restP), 3));
    part.geo.setIndex(keep);
    // neighbours of each garment vertex, for bridging hollows
    const used = new Set(keep), verts = Int32Array.from(used), slot = new Map(); verts.forEach((v, i) => slot.set(v, i));
    const lists = Array.from(verts, () => new Set());
    for (let t = 0; t < keep.length; t += 3) for (let k = 0; k < 3; k++) { const a = keep[t + k], b = keep[t + (k + 1) % 3]; lists[slot.get(a)].add(b); lists[slot.get(b)].add(a); }
    const off = new Int32Array(verts.length + 1); lists.forEach((l, i) => { off[i + 1] = off[i] + l.size; });
    const nb = new Int32Array(off[verts.length]); lists.forEach((l, i) => { let k = off[i]; for (const x of l) nb[k++] = x; });
    part.cover = cover; part.ease = ease; part.verts = verts; part.nbr = { off, nb };
    part.uniforms.uLong.value = legLength;
  }
  // Lay a garment over the (posed) body: out along the normal by its ease, then fill in
  // hollows by moving each point out (never in) toward the average of its neighbours.
  function drape(part, P, N) {
    const out = part.geo.attributes.position.array, { verts, nbr: { off, nb } } = part, minLift = MIN_LIFT[part.kind];
    const lift = new Float32Array(P.length / 3);
    for (const v of verts) { const e = part.ease[v] || minLift; lift[v] = e; }
    const iters = part.kind === 'hair' ? 6 : 18, next = new Float32Array(lift.length);
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i], o = v * 3, c = off[i + 1] - off[i]; if (!c) { next[v] = lift[v]; continue; }
        // average neighbour surface point, measured along this vertex's normal
        let ax = 0, ay = 0, az = 0;
        for (let k = off[i]; k < off[i + 1]; k++) { const u = nb[k], q = u * 3, l = lift[u]; ax += P[q] + N[q] * l; ay += P[q + 1] + N[q + 1] * l; az += P[q + 2] + N[q + 2] * l; }
        const want = (ax / c - P[o]) * N[o] + (ay / c - P[o + 1]) * N[o + 1] + (az / c - P[o + 2]) * N[o + 2];
        next[v] = Math.max(part.ease[v] || minLift, minLift, lift[v] + 0.6 * (want - lift[v]));
      }
      for (const v of verts) lift[v] = next[v];
    }
    for (const v of verts) { const o = v * 3, l = lift[v]; out[o] = P[o] + N[o] * l; out[o + 1] = P[o + 1] + N[o + 1] * l; out[o + 2] = P[o + 2] + N[o + 2] * l; }
    part.geo.attributes.position.needsUpdate = true;
    part.geo.computeVertexNormals();
    part.geo.computeBoundingSphere();
  }
  // Whatever a bottom covers hides the genital geometry under it.
  function underwear(hide) {
    const count = hide ? INDEX.length : Infinity, geos = [bodyGeo];
    const pg = posed(); if (pg && pg !== bodyGeo) geos.push(pg);
    for (const g of geos) if (g.drawRange.count !== count) g.setDrawRange(0, count);
  }
  // shapeKey: changes when the rest body changes. poseVersion: when the pose does.
  function sync(shapeKey, poseVersion) {
    const want = KINDS.map((k) => choice[k]).join('|') + '|' + shapeKey;
    if (want !== coverKey) {
      coverKey = want; builtFor = '';
      if (anyOn()) {
        const P0 = bodyGeo.attributes.position.array, J = rig().joints;
        const c = coverage(P0, J, choice.top, choice.bottom, choice.hair), e = fit(P0, J, choice.top, choice.bottom, choice.hair);
        const legL = (() => { const s = joint(J, 'upperleg01.L'), f = joint(J, 'foot.L'); return len(sub(f, s)); })();
        for (const k of KINDS) { style(parts[k], choice[k]); build(parts[k], c[k], e[k], e.place, P0.subarray(0, c[k].length * 3), choice.bottom === 'pants' ? legL : 0.27); }
      }
    }
    for (const k of KINDS) parts[k].mesh.visible = choice[k] !== 'none' && !bareDepth;
    underwear(choice.bottom !== 'none' && !bareDepth);
    if (!anyOn()) return;
    const at = want + '|' + poseVersion;
    if (at === builtFor) return; builtFor = at;
    const src = posed() || bodyGeo, P = src.attributes.position.array, N = src.attributes.normal.array;
    for (const part of Object.values(parts)) if (choice[part.kind] !== 'none') drape(part, P, N);
  }
  return {
    get choice() { return { ...choice }; },
    set(next) { const c = { ...choice, ...next }; for (const k of KINDS) if (!Object.hasOwn(LISTS[k], c[k])) throw new Error('Unknown clothes'); choice = c; },
    sync,
    meshes: () => KINDS.map((k) => parts[k].mesh),
    // Run fn with the clothes off and the whole body drawn (for exports of the skin).
    bare(fn) { bareDepth++; for (const k of KINDS) parts[k].mesh.visible = false; underwear(false); try { return fn(); } finally { bareDepth--; if (!bareDepth) { for (const k of KINDS) parts[k].mesh.visible = choice[k] !== 'none'; underwear(choice.bottom !== 'none'); } } },
    // Share of a tattoo's skin (decal support vertices) that the clothes cover, 0..1.
    coveredShare(supports) { if (!supports || !supports.length || !anyOn()) return 0; let c = 0; for (const v of supports) if (this.covered(v)) c++; return c / supports.length; },
    covered(vertex) { return KINDS.some((k) => choice[k] !== 'none' && parts[k].cover && parts[k].cover[vertex] > 0); },
  };
}
