import { visibleInkAt, rankedInkHits, cycleInkHit } from './ink-picking.js';
import * as THREE from 'three';
import { INDEX, INDEX_ALL, COUNTS, shapePositions, shapePositionsV1, legacyPositions } from './mesh.js';
import { FIT_GROUPS, fitVisible, fitFromV47 } from './fit.js';
import { createSkin, updateSkin } from './skin.js';
import { buildAdjacency, buildDecal, UV_MARGIN } from './decal.js';
import './slider.js';
import {twoPointerDelta,wrapAngle,planTapPlacement} from './view-gestures.js';
import {findLiveAlignment} from './live-alignment.js';
import { editArtwork } from './cleanup.js';
import { applyArtworkRevision } from './cleanup-links.js';
import { openShelf, openProjectShelf } from './shelf.js';
import { openPlanning } from './planning.js';
import { openLayers } from './layers.js';
import { makeArtistPacket } from './artist-packet.js';
import { cleanState, imageKeysFor } from './project.js';
import { openStore } from './store.js';
import { sampleSun, sampleSprig } from './sample-art.js';
import { dataUrlBlob, shareOrDownload, canShareFiles } from './share.js';
import { createBeforeAfter } from './before-after.js';
import { createPoseView } from './pose-view.js';
import { createClothes, TOPS, BOTTOMS, HAIR } from './clothes.js';
import { installPenTap, controlAt } from './pen-tap.js';
import { POSE_CATALOG, POSE_GROUPS, MOTION_CATALOG } from './pose-catalog.js';

const $ = (s) => document.querySelector(s);
const V3 = THREE.Vector3;
const SKINS = ['#f1d3bd', '#e0b394', '#c6916c', '#9a6644', '#6a422a'];
const FOV = 30;
const STENCIL = '#8474ff';

/* ---------- state ---------- */
// v2: muscle and weight run 0..1 with 0.5 = average; `fit` holds the fine-tune sliders (-1..1, see fit.js).
const freshState = () => ({ app: 'ink-atlas-proto', v: 2, tattoos: [], skin: 1, heightCm: 175, figure: 'male', muscle: 0.6, weight: 0.5, fit: {}, genitals: true });
let state = freshState();
let images = {}; // key -> dataURL
const imgEls = {}; // key -> HTMLImageElement
let selectedId = null;
let tapPlaceId = null;
let soloIds = null;
const undoStack = [];
const redoStack = [];
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- three setup ---------- */
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
stage.appendChild(renderer.domElement);
const canvas = renderer.domElement;
canvas.style.touchAction = 'none';

const scene = new THREE.Scene();
{
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 215, 20, 256, 256, 380);
  gr.addColorStop(0, '#474b59'); gr.addColorStop(0.55, '#2a2d37'); gr.addColorStop(1, '#17181d');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4652, 1.15));
const key = new THREE.DirectionalLight(0xfff4ea, 2.1);
key.position.set(-0.7, 0.9, 0.6); camera.add(key);
const keyTarget = new THREE.Object3D(); keyTarget.position.set(0, 1, 0); scene.add(keyTarget); key.target = keyTarget;
const rim = new THREE.DirectionalLight(0xb9c4ff, 1.0); rim.position.set(2, 2.5, -3); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0xffd9c4, 0.5); rim2.position.set(-2.5, 1, -2); scene.add(rim2);

const bodyGeo = new THREE.BufferGeometry();
bodyGeo.setAttribute('position', new THREE.BufferAttribute(legacyPositions(), 3));
const idxBody = new THREE.BufferAttribute(INDEX, 1), idxAll = new THREE.BufferAttribute(INDEX_ALL, 1); // without / with the genital geometry
bodyGeo.setIndex(idxBody);
bodyGeo.computeVertexNormals();
bodyGeo.computeBoundingBox(); bodyGeo.computeBoundingSphere();
const { mat: skinMat, uniforms: skinU } = createSkin(bodyGeo, SKINS[1]);
let shapeKey = 0;
let poseView = null; // set up once the body exists; poses are for looking and never saved
const genitalsShown = () => state.figure === 'male' && state.genitals !== false;
// Vertices past this are the genital geometry, which is only on the body when shown.
const vertEnd = () => (genitalsShown() ? COUNTS.body + COUNTS.eyes + COUNTS.genital : COUNTS.body + COUNTS.eyes) * 3;
// Put raw positions on the body and refresh everything derived from them.
function setBodyPositions(pos, withGenitals) {
  bodyGeo.attributes.position.array.set(pos); bodyGeo.attributes.position.needsUpdate = true;
  bodyGeo.setIndex(withGenitals ? idxAll : idxBody);
  bodyGeo.computeVertexNormals(); bodyGeo.computeBoundingBox(); bodyGeo.computeBoundingSphere();
  const fem = state.figure === 'female' ? 1 : state.figure === 'male' ? 0 : 0.5;
  updateSkin(bodyGeo, skinU, (0.0155 + 0.006 * fem) * (1 + 0.35 * ((state.fit && state.fit.nippleSize) || 0)));
  shapeKey++; needsRender = true; if (poseView) poseView.invalidate();
}
function applyShape() { setBodyPositions(shapePositions(state), genitalsShown()); }
const body = new THREE.Mesh(bodyGeo, skinMat);
scene.add(body); body.updateMatrixWorld(true);

let floorShadow = null;
{ // soft floor shadow
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.001; scene.add(m); floorShadow = m;
}
const decalGroup = new THREE.Group(); scene.add(decalGroup);
const areolaSize = () => { const fem = state.figure === 'female' ? 1 : state.figure === 'male' ? 0 : 0.5; return (0.0155 + 0.006 * fem) * (1 + 0.35 * ((state.fit && state.fit.nippleSize) || 0)); };
poseView = createPoseView({ THREE, bodyMesh: body, bodyGeo, skinMat, state: () => state, areola: areolaSize, onChange: () => { needsRender = true; if (typeof renderPose === 'function') renderPose(); } });
const clothes = createClothes({ THREE, bodyGeo, scene, rig: () => poseView.restRig(), posed: () => (poseView.active ? (poseView.ensure(), poseView.geometry) : null) });
const decals = {}; // id -> {mesh, outline, tex, texKey}

/* ---------- camera rig ---------- */
const cur = { theta: 0.35, phi: 1.45, roll: 0, r: 4.2, tx: 0, ty: 0.86, tz: 0 };
const goal = { ...cur };
let glide = true; let needsRender = true;
function fullBodyR() {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return Math.max(2.7 / (2 * t), 1.35 / (2 * t * camera.aspect));
}
function fullBody(theta) {
  if (theta != null) goal.theta = theta;
  goal.roll = 0; goal.phi = 1.5; goal.r = fullBodyR(); goal.tx = 0; goal.ty = 0.73; goal.tz = 0.02; glide = true; needsRender = true;
}
function focusTattoo(t) {
  const spot = viewSpot(t);
  const n = new V3(...spot.normal);
  goal.theta = Math.atan2(n.x, n.z);
  goal.phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)), 0.75, 2.0);
  goal.tx = spot.pos[0]; goal.ty = spot.pos[1]; goal.tz = spot.pos[2];
  // the tattoo fills about a third of the free space, with enough body round it to see where it sits
  const ext = Math.max(t.width, t.width / t.aspect) * 2.2 + 0.12;
  const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const bounds=canvas.getBoundingClientRect(),dock=$('#dock').getBoundingClientRect();
  const top=Math.max(bounds.top,$('#top').getBoundingClientRect().bottom,$('#views').getBoundingClientRect().bottom)+12;
  const bottom=Math.max(top+80,Math.min(bounds.bottom-12,dock.top-14));
  const available=THREE.MathUtils.clamp((bottom-top)/Math.max(1,bounds.height),.18,1);
  goal.r = THREE.MathUtils.clamp(ext / (2 * tn * Math.min(available, camera.aspect)), 0.45, 3.2);
  const shiftFrac=THREE.MathUtils.clamp(.5-((top+bottom)/2-bounds.top)/Math.max(1,bounds.height),-.2,.4),shift=2*goal.r*tn*shiftFrac;
  // Move the aim point in camera-screen up, including view roll, so the selected
  // artwork lands in the measured unobscured area rather than behind the dock.
  const st=Math.sin(goal.theta),ct=Math.cos(goal.theta),sp=Math.sin(goal.phi),cp=Math.cos(goal.phi),sr=Math.sin(goal.roll||0),cr=Math.cos(goal.roll||0);
  const up=new V3(-cp*st*cr-ct*sr,sp*cr,-cp*ct*cr+st*sr);
  goal.tx=spot.pos[0]-up.x*shift;goal.ty=spot.pos[1]-up.y*shift;goal.tz=spot.pos[2]-up.z*shift;
  glide = true; needsRender = true;
}
function applyCam() {
  const s = Math.sin(cur.phi);
  camera.position.set(cur.tx + cur.r * s * Math.sin(cur.theta), cur.ty + cur.r * Math.cos(cur.phi), cur.tz + cur.r * s * Math.cos(cur.theta));
  camera.up.set(0,1,0);
  camera.lookAt(cur.tx, cur.ty, cur.tz);
  camera.rotateZ(cur.roll || 0);
  camera.updateMatrixWorld(true);
}
function stepCam(dt) {
  const k = 1 - Math.exp(-dt * (glide ? 5 : 18));
  let d = 0;
  for (const p of ['phi', 'r', 'tx', 'ty', 'tz']) { const dv = goal[p] - cur[p]; cur[p] += dv * k; d += Math.abs(dv); }
  let dth = goal.theta - cur.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); cur.theta += dth * k; d += Math.abs(dth);
  const dr=wrapAngle((goal.roll||0)-(cur.roll||0));cur.roll=wrapAngle((cur.roll||0)+dr*k);d+=Math.abs(dr);
  applyCam();
  if (d < 2e-4) { glide = false; return false; }
  return true;
}
// While the Body panel is open the picture slides over, so the body stays centred in the free space.
let curInset = 0, goalInset = 0;
function applyInset() { const w = stage.clientWidth || 800, h = stage.clientHeight || 600; if (curInset > 0.5) camera.setViewOffset(w, h, curInset / 2, 0, w, h); else camera.clearViewOffset(); }
function updateInset() { const p = $('#bodyPop'), w = stage.clientWidth || 800; document.body.classList.toggle('panel-open', !p.hidden); goalInset = !p.hidden && w - p.offsetWidth > 300 ? p.offsetWidth + 16 : 0; needsRender = true; }
function resize() {
  const w = stage.clientWidth || 800, h = stage.clientHeight || 600;
  renderer.setSize(w, h, false);
  canvas.style.width = '100%'; canvas.style.height = '100%';
  camera.aspect = w / h; camera.updateProjectionMatrix(); updateInset(); applyInset(); needsRender = true;
  if(selectedId)requestAnimationFrame(()=>{const t=sel();if(t)focusTattoo(t);});
}
new ResizeObserver(resize).observe(stage); resize();
cur.r = fullBodyR() * 1.25; fullBody(0);

/* ---------- raycast helpers ---------- */
const ray = new THREE.Raycaster();
function ndc(x, y) { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); }
function hitBody(x, y) {
  ray.setFromCamera(ndc(x, y), camera);
  if (!poseView.active) { const h = ray.intersectObject(body, false)[0]; return h || null; }
  // In a pose the finger touches the posed body; everything else works on the rest
  // body, so report the same skin there (same triangle, same barycentric weights).
  const h = poseView.withPosed(() => ray.intersectObject(body, false)[0]);
  if (!h || !h.face || !h.barycoord) return null;
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array, ids = [h.face.a, h.face.b, h.face.c], w = [h.barycoord.x, h.barycoord.y, h.barycoord.z];
  const point = new V3(), normal = new V3();
  for (let k = 0; k < 3; k++) { point.x += P[ids[k] * 3] * w[k]; point.y += P[ids[k] * 3 + 1] * w[k]; point.z += P[ids[k] * 3 + 2] * w[k]; normal.x += N[ids[k] * 3] * w[k]; normal.y += N[ids[k] * 3 + 1] * w[k]; normal.z += N[ids[k] * 3 + 2] * w[k]; }
  return { point, normal: normal.normalize(), face: h.face, faceIndex: h.faceIndex, barycoord: h.barycoord, distance: h.distance, posedPoint: h.point };
}
// Where a tattoo is on screen right now: its rest spot, or the same skin in the pose.
const spotCache = new Map();
function viewSpot(t) {
  if (!poseView.active) return { pos: t.pos, normal: t.normal };
  const k = t.pos.join(',') + '|' + t.normal.join(',') + '|' + shapeKey;
  let c = spotCache.get(t.id);
  if (!c || c.k !== k) {
    const tri = startTriangle(t), I = bodyGeo.index.array, P = bodyGeo.attributes.position.array;
    const [a, b, d] = [0, 1, 2].map((j) => new V3().fromArray(P, I[tri * 3 + j] * 3));
    const w = new V3(); THREE.Triangle.getBarycoord(new THREE.Triangle(a, b, d).closestPointToPoint(new V3(...t.pos), new V3()), a, b, d, w);
    c = { k, tri, w: [w.x, w.y, w.z] }; spotCache.set(t.id, c);
  }
  return poseView.pointOn(c.tri, c.w);
}
function surfaceAt(origin, dir) { ray.set(origin, dir.clone().normalize()); const h = ray.intersectObject(body, false)[0]; return h ? { pos: h.point.toArray(), normal: h.normal.clone().normalize().toArray() } : null; }
function frameOf(t) {
  const n = new V3(...t.normal).normalize();
  const ref = Math.abs(n.y) > 0.93 ? new V3(0, 0, -1) : new V3(0, 1, 0);
  const x = new V3().crossVectors(ref, n).normalize();
  const y = new V3().crossVectors(n, x).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), t.rot || 0));
  return { q, n, right: new V3(1, 0, 0).applyQuaternion(q), up: new V3(0, 1, 0).applyQuaternion(q) };
}
function insideTattoo(point, t, pad = 1.12) {
  const f = frameOf(t); const d = point.clone().sub(new V3(...t.pos));
  const hw = Math.max(t.width / 2 * pad, 0.028), hh = Math.max(t.width / t.aspect / 2 * pad, 0.028);
  return Math.abs(d.dot(f.right)) <= hw && Math.abs(d.dot(f.up)) <= hh && Math.abs(d.dot(f.n)) < 0.09;
}
const inkPixels=new WeakMap();
function inkIdsAt(x,y,bodyHit=hitBody(x,y)) {
 if(!bodyHit)return [];
 ray.setFromCamera(ndc(x,y),camera);
 const entries=state.tattoos.map((t,order)=>({t,order,d:decals[t.id]})).filter(e=>!e.t.hidden&&e.d?.mesh.visible&&e.d.tex);
 const hits=[];for(const e of entries)for(const h of poseView.withPosed(()=>ray.intersectObject(e.d.mesh,false),[e.d.mesh]))if(h.uv)hits.push({id:e.t.id,order:e.order,distance:h.distance,uv:h.uv,tex:e.d.tex});
 return rankedInkHits(hits,bodyHit.distance,h=>{try{let pixels=inkPixels.get(h.tex);if(!pixels){pixels=h.tex.image.getContext('2d',{willReadFrequently:true}).getImageData(0,0,h.tex.image.width,h.tex.image.height);inkPixels.set(h.tex,pixels);}return visibleInkAt(pixels,h.uv.x,h.uv.y,h.tex.flipY);}catch{return false;}});
}
let lastInkTap=null;

function nearestIndex(p) { const P = bodyGeo.attributes.position.array, end = vertEnd(); let best = 0, bd = Infinity; for (let i = 0; i < end; i += 3) { const d = (P[i] - p[0]) ** 2 + (P[i + 1] - p[1]) ** 2 + (P[i + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i / 3; } } return best; }
function anchorsNow() {
  return state.tattoos.map((t) => {
    const n = new V3(...t.normal).normalize(); ray.set(new V3(...t.pos).addScaledVector(n, 0.06), n.clone().negate()); ray.far = 0.25;
    const h = ray.intersectObject(body, false)[0]; ray.far = Infinity;
    if (h && h.face && h.barycoord) return { v: [h.face.a, h.face.b, h.face.c], w: [h.barycoord.x, h.barycoord.y, h.barycoord.z] };
    const i = nearestIndex(t.pos); return { v: [i, i, i], w: [1, 0, 0] };
  });
}
function applyAnchors(an) {
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array;
  state.tattoos.forEach((t, i) => { const A = an[i]; if (!A) return; const p = [0, 0, 0], n = [0, 0, 0];
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { p[j] += P[A.v[k] * 3 + j] * A.w[k]; n[j] += N[A.v[k] * 3 + j] * A.w[k]; }
    const l = Math.hypot(n[0], n[1], n[2]) || 1; t.pos = p; t.normal = [n[0] / l, n[1] / l, n[2] / l]; });
}
function reshape(fn) { const an = anchorsNow(); fn(); applyShape(); applyAnchors(an); }
/* ---------- decals ---------- */
function loadImg(keyName) {
  if(typeof images[keyName]!=='string'||!images[keyName].startsWith('data:image/'))return Promise.resolve(null);
  if (imgEls[keyName]) return Promise.resolve(imgEls[keyName]);
  return new Promise((res) => { const im = new Image(); im.onload = () => { imgEls[keyName] = im; res(im); }; im.onerror = () => res(null); im.src = images[keyName]; });
}
function inkTexture(t) {
  const im = imgEls[t.img]; const c = document.createElement('canvas');
  const W = Math.min(1024, Math.max(64, im ? im.naturalWidth : 256)); c.width = W; c.height = Math.max(8, Math.round(W / t.aspect));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  if (im) { g.save(); g.globalAlpha = t.opacity ?? 0.92; if (t.flip) { g.translate(c.width, 0); g.scale(-1, 1); } const mx = UV_MARGIN * c.width, my = UV_MARGIN * c.height; g.drawImage(im, mx, my, c.width - 2 * mx, c.height - 2 * my); g.restore(); }
  const tex = new THREE.CanvasTexture(c); tex.flipY = !t.imageTopDown; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function outlineTexture(aspect) {
  const c = document.createElement('canvas'); c.width = 384; c.height = Math.max(24, Math.round(384 / aspect));
  const g = c.getContext('2d'); g.strokeStyle = STENCIL; g.lineWidth = 5; g.setLineDash([14, 10]);
  const mx = UV_MARGIN * c.width + 3, my = UV_MARGIN * c.height + 3;
  g.strokeRect(mx, my, c.width - 2 * mx, c.height - 2 * my);
  g.setLineDash([]); g.fillStyle = STENCIL;
  for (const [x, y] of [[mx, my], [c.width - mx, my], [mx, c.height - my], [c.width - mx, c.height - my]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
// Adjacency is rebuilt only when the index buffer changes (genitals shown/hidden).
let adjCache = { key: '', adj: null };
function bodyAdjacency() { const key = bodyGeo.index === idxAll ? 'all' : 'body'; if (adjCache.key !== key) adjCache = { key, adj: buildAdjacency(bodyGeo.index.array) }; return adjCache.adj; }
function startTriangle(t) {
  const n = new V3(...t.normal).normalize(); ray.set(new V3(...t.pos).addScaledVector(n, 0.06), n.clone().negate()); ray.far = 0.3;
  const h = ray.intersectObject(body, false)[0]; ray.far = Infinity;
  if (h && h.faceIndex != null) return h.faceIndex;
  const I = bodyGeo.index.array, P = bodyGeo.attributes.position.array; let best = 0, bd = Infinity;
  for (let tri = 0; tri < I.length / 3; tri++) { const a = I[tri * 3] * 3, b = I[tri * 3 + 1] * 3, c = I[tri * 3 + 2] * 3; const cx = (P[a] + P[b] + P[c]) / 3 - t.pos[0], cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - t.pos[1], cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - t.pos[2]; const d = cx * cx + cy * cy + cz * cz; if (d < bd) { bd = d; best = tri; } }
  return best;
}
function decalGeometry(t) {
  const { positions, uvs, supports, tris } = buildDecal(bodyGeo, bodyAdjacency(), t, frameOf(t), startTriangle(t));
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.userData.supports = supports; out.userData.tris = tris;
  return out;
}
function texKeyOf(t) { return [t.img, t.imageTopDown ? 1 : 0, t.flip ? 1 : 0, (t.opacity ?? 0.92).toFixed(2), t.aspect.toFixed(3)].join('|'); }
function syncDecals() {
  const ids = new Set(state.tattoos.map((t) => t.id));
  for (const id of Object.keys(decals)) if (!ids.has(id)) { const d = decals[id]; decalGroup.remove(d.mesh, d.outline); d.mesh.geometry.dispose(); d.tex.dispose(); d.outline.material.map.dispose(); delete decals[id]; }
  state.tattoos.forEach((t, i) => {
    let d = decals[t.id];
    if (!d) {
      const mat = new THREE.MeshBasicMaterial({ blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false });
      const omat = new THREE.MeshBasicMaterial({ map: outlineTexture(t.aspect), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, toneMapped: false });
      d = decals[t.id] = { mesh: new THREE.Mesh(new THREE.BufferGeometry(), mat), outline: new THREE.Mesh(new THREE.BufferGeometry(), omat), tex: null, texKey: '', geoKey: '' };
      decalGroup.add(d.mesh, d.outline);
    }
    const tk = texKeyOf(t);
    if (d.texKey !== tk && imgEls[t.img]) { if (d.tex) d.tex.dispose(); d.tex = inkTexture(t); d.mesh.material.map = d.tex; d.mesh.material.needsUpdate = true; d.texKey = tk; }
    const gk = [t.pos, t.normal, t.width, t.rot, t.aspect, t.wrap || 0, t.bend || 0, t.taper || 0, shapeKey].join('|');
    if (d.geoKey !== gk) { d.mesh.geometry.dispose(); const g = decalGeometry(t); d.mesh.geometry = g; d.outline.geometry = g; d.geoKey = gk; }
    d.mesh.renderOrder = 10 + i; d.outline.renderOrder = 500;
    d.mesh.visible = !t.hidden && !!d.tex && (!soloIds || soloIds.has(t.id)); d.outline.visible = t.id === selectedId && d.mesh.visible && !exporting;
  });
  needsRender = true;
}
let exporting = false;

/* ---------- persistence ---------- */
// store.js does the writing. Here: when to save, telling the truth about whether it
// worked, and keeping copies to go back to.
let store = null, saveTimer = 0, saving = false, saveAgain = false, dirty = false, warnedSave = false, askedPersist = false, lastAuto = Date.now();
function usedImages() { const o = {}; for (const k of imageKeysFor(state)) if (images[k]) o[k] = images[k]; return o; }
function setSaved(text, bad) { const n = $('#saved'); n.textContent = text; n.classList.toggle('bad', !!bad); }
function save() {
  dirty = true; clearTimeout(saveTimer);
  if (!store || !store.ok) { setSaved('Not saved: storage is off in this view', true); return; }
  setSaved('Saving'); saveTimer = setTimeout(flushSave, 350);
}
async function flushSave() {
  clearTimeout(saveTimer); saveTimer = 0;
  if (!store || !store.ok || !dirty) return;
  if (saving) { saveAgain = true; return; }
  saving = true; dirty = false;
  try {
    await store.save(state, usedImages());
    if (!dirty) setSaved('Saved on this device');
    warnedSave = false;
    if (!askedPersist) { askedPersist = true; store.persist(); }
    if (Date.now() - lastAuto > 5 * 60000) { lastAuto = Date.now(); keepRecovery('While you were working'); }
  } catch (err) {
    dirty = true;
    setSaved(err && err.name === 'QuotaExceededError' ? 'Not saved: this device is out of space' : 'Not saved: storage problem', true);
    if (!warnedSave) { warnedSave = true; toast('Your changes are not being saved on this device.', 'Back up now', backupNow); }
  } finally { saving = false; if (saveAgain) { saveAgain = false; flushSave(); } }
}
// iPadOS can drop a web page the moment it leaves the screen, so write straight away when that happens.
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
window.addEventListener('pagehide', () => { flushSave(); });
function keepRecovery(reason) { return store && store.ok ? store.addRecovery(state, usedImages(), reason).catch(() => false) : Promise.resolve(false); }
// Replace the working project with a stored one: this device's save, a backup file or a
// recovery copy. Everything is checked first; if it is not usable this throws and the
// project on screen is left exactly as it was.
async function openProject(rawState, imgs) {
  imgs = imgs && typeof imgs === 'object' ? imgs : {};
  const c = cleanState(rawState, (k) => typeof imgs[k] === 'string' && imgs[k].startsWith('data:image'));
  for (const k of imageKeysFor(c.state)) if (!images[k] && typeof imgs[k]==='string' && imgs[k].startsWith('data:image/')) images[k] = imgs[k];
  await Promise.all(c.state.tattoos.map((t) => loadImg(t.img)));
  const usable = c.state.tattoos.filter((t) => imgEls[t.img]);
  const dropped = c.dropped + c.state.tattoos.length - usable.length;
  if (!usable.length && rawState.tattoos.length) throw new Error('No usable artwork'); // never swap a real project for an empty one
  c.state.tattoos = usable;
  for (const t of usable) if (!t.aspect) t.aspect = imgEls[t.img].naturalWidth / imgEls[t.img].naturalHeight || 1;
  state = c.state; selectedId = null; skinMat.color.set(skinColor()); adoptState();
  for (const id of c.replace) { const t = state.tattoos.find((x) => x.id === id); if (t) { const h = nextSlot(); t.pos = h.pos; t.normal = h.normal; } }
  return { dropped, replaced: c.replace.length };
}
function whenText(at) {
  const d = new Date(at), now = new Date(), time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = d.toDateString() === now.toDateString() ? 'Today' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}, ${time}`;
}

/* ---------- history ---------- */
function snapshot() { undoStack.push(JSON.stringify(state)); if (undoStack.length > 40) undoStack.shift(); redoStack.length = 0; refreshUndo(); }
function restore(json) { state = JSON.parse(json); if (!state.tattoos.find((t) => t.id === selectedId)) selectedId = null; skinMat.color.set(skinColor()); applyShape(); syncDecals(); renderUI(); save(); }
function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(state)); restore(undoStack.pop()); refreshUndo(); }
function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(state)); restore(redoStack.pop()); refreshUndo(); }
function refreshUndo() { $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length; }
function commit() { syncDecals(); renderUI(); if (!$('#clothesPop').hidden) renderClothes(); save(); }

/* ---------- tattoo ops ---------- */
const skinColor = () => state.skinHex || SKINS[state.skin] || SKINS[1];
const sel = () => state.tattoos.find((t) => t.id === selectedId) || null;
function select(id, focus) { if(selectedId!==id)$('#editorAdvanced').open=false;if(tapPlaceId!==id)tapPlaceId=null; selectedId = id; const t = sel(); syncDecals(); renderUI(); if (t && focus) focusTattoo(t); }
function sizeText(t) {
  const k = state.heightCm / 175; const w = t.width * 100 * k, h = w / t.aspect;
  return `≈ ${(w / 2.54).toFixed(1)} × ${(h / 2.54).toFixed(1)} in  ·  ${w.toFixed(0)} × ${h.toFixed(0)} cm`;
}
const SLOTS = [
  [[0.06, 1.36, 2], [0, 0, -1]], [[2, 1.04, 0.0], [-1, 0, 0]], [[-2, 1.22, 0.0], [1, 0, 0]], [[0, 1.32, -2], [0, 0, 1]],
  [[0.1, 0.72, 2], [0, 0, -1]], [[-0.1, 1.08, 2], [0, 0, -1]], [[-0.1, 0.36, -2], [0, 0, 1]], [[0.12, 1.1, -2], [0, 0, 1]],
];
let slotI = 0;
function nextSlot() { for (let i = 0; i < SLOTS.length; i++) { const s = SLOTS[(slotI++) % SLOTS.length]; const h = surfaceAt(new V3(...s[0]), new V3(...s[1])); if (h) return h; } return { pos: [0, 1.3, 0.12], normal: [0, 0, 1] }; }
async function addImage(dataUrl, name, place) {
  const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = dataUrl; });
  if (!im) {toast('That picture could not be opened.');return null;}
  const ratio=im.naturalWidth/im.naturalHeight;
  if(im.naturalWidth*im.naturalHeight>24000000 || !Number.isFinite(ratio) || ratio<.05 || ratio>20){toast('Use artwork under 24 megapixels with an aspect ratio between 1:20 and 20:1.');return null;}
  let src = dataUrl;
  const max = 1600;
  if (im.naturalWidth > max || im.naturalHeight > max || dataUrl.length > 900000) {
    const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    src = c.toDataURL('image/png'); // Preserve transparency and line detail.
  }
  const k = uid(); images[k] = src; await loadImg(k);
  const p = place || nextSlot();
  const t = { id: uid(), name: name || 'Tattoo', img: k, imageTopDown:true, aspect: im.naturalWidth / im.naturalHeight, pos: p.pos, normal: p.normal, width: p.width || 0.11, rot: p.rot || 0, opacity: p.opacity ?? 0.92, flip: false, locked: false, hidden: false };
  for (const k of ['wrap', 'bend', 'taper']) if (p[k]) t[k] = p[k];
  state.artworks ||= {}; t.artworkId = uid(); const sourceKey = src === dataUrl ? k : uid(); if (sourceKey !== k) images[sourceKey] = dataUrl; state.artworks[t.artworkId] = { source: sourceKey, output: k, name: t.name };
  state.tattoos.push(t); return t;
}
function viewCenterSpot() { const r = canvas.getBoundingClientRect(); const h = hitBody(r.left + r.width / 2, r.top + r.height * 0.42); return h ? { pos: h.point.toArray(), normal: h.normal.clone().normalize().toArray() } : null; }

/* ---------- sample art (original, drawn in code → src/sample-art.js) ---------- */
async function seedSamples() {
  const a = surfaceAt(new V3(0.075, 1.34, 2), new V3(0, 0, -1));
  if (a) await addImage(sampleSun(), 'Sunburst (sample)', { ...a, width: 0.115 });
  const b = surfaceAt(new V3(2, 1.02, 0.01), new V3(-1, 0, 0)) || surfaceAt(new V3(0.11, 0.7, 2), new V3(0, 0, -1));
  if (b) await addImage(sampleSprig(), 'Sprig (sample)', { ...b, width: 0.05 });
}

/* ---------- gestures ---------- */
let liveGuidePlan=null,guideSnapApplied=false;
function clearLiveGuides(){liveGuidePlan=null;guideSnapApplied=false;$('#alignmentGuides').setAttribute('hidden','');$('#alignmentGuides').replaceChildren();}
function drawLiveGuides(){const svg=$('#alignmentGuides');if(!liveGuidePlan){svg.setAttribute('hidden','');return;}svg.removeAttribute('hidden');const box=svg.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${box.width||innerWidth} ${box.height||innerHeight}`);svg.replaceChildren();const ns='http://www.w3.org/2000/svg';
 for(const guide of liveGuidePlan.lines){const a=screenOf(new V3(...guide.from)),b=screenOf(new V3(...guide.to)),line=document.createElementNS(ns,'line');for(const [k,v]of Object.entries({x1:a.x-box.left,y1:a.y-box.top,x2:b.x-box.left,y2:b.y-box.top,stroke:guideSnapApplied?'#8ae2c0':'#f3c776','stroke-width':1.5,'stroke-dasharray':guideSnapApplied?'none':'5 4'}))line.setAttribute(k,String(v));svg.append(line);const label=document.createElementNS(ns,'text');label.setAttribute('x',String(Math.max(6,Math.min(box.width-100,b.x-box.left+6))));label.setAttribute('y',String(Math.max(18,Math.min(box.height-10,b.y-box.top-6))));label.setAttribute('fill',guideSnapApplied?'#8ae2c0':'#f3c776');label.setAttribute('font-size','12');label.setAttribute('paint-order','stroke');label.setAttribute('stroke','#20232c');label.setAttribute('stroke-width','3');label.textContent=`${guideSnapApplied?'Snap: ':''}${guide.kind} · ${liveGuidePlan.referenceName}`;svg.append(label);}
}
function updateLiveGuides(t){clearLiveGuides();if(!$('#liveGuides').checked||poseView.active)return;const refs=state.tattoos.filter(r=>!soloIds||soloIds.has(r.id)),plan=findLiveAlignment(t,refs);if(!plan)return;const ref=state.tattoos.find(r=>r.id===plan.referenceId);
 // A close normal match alone is not sufficient across adjacent body parts.
 const connected=projectGroupSurface(ref.pos,ref.normal,t);if(!connected||Math.hypot(...connected.pos.map((v,i)=>v-ref.pos[i]))>.012)return;
 liveGuidePlan=plan;if($('#snapGuides').checked){const hit=projectGroupSurface(plan.candidate,t.normal,t);if(hit&&Math.hypot(...hit.pos.map((v,i)=>v-plan.candidate[i]))<.012&&new V3(...hit.normal).dot(new V3(...t.normal))>.85){t.pos=hit.pos;t.normal=hit.normal;guideSnapApplied=true;}}
 drawLiveGuides();
}
const pts = new Map();
let gest = null; let lastTap = { t: 0, x: 0, y: 0, empty: false };
function screenOf(v) { const p = v.clone().project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; }
function onSelectedInk(x, y) {
  const t = sel(); if (tapPlaceId || !t || t.locked || t.status === 'existing' || t.hidden) return false;
  const h = hitBody(x, y); return !!(h && h.normal.dot(new V3(...t.normal)) > 0 && insideTattoo(h.point, t));
}
function two() { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; }
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  clearLiveGuides();
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 1) {
    const t = sel();
    const onInk = onSelectedInk(e.clientX, e.clientY);
    const sc = t ? screenOf(new V3(...viewSpot(t).pos)) : { x: 0, y: 0 };
    if (onInk && poseView.motion.playing) poseView.pause(); // hold the pose still while the ink moves
    gest = { mode: onInk ? 'ink' : 'cam', sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, t0: performance.now(), moved: false, snap: false, ox: e.clientX - sc.x, oy: e.clientY - sc.y, type: e.pointerType };
  } else if (pts.size === 2 && gest) {
    const s = two();
    // Fingers that land together arrive in no fixed order, so "two fingers starting on it"
    // must not depend on which one the browser reports first: if the first finger has not
    // moved yet and the second one lands on the selected tattoo, it is a resize/turn of it.
    if (gest.mode === 'cam' && !gest.moved && performance.now() - gest.t0 < 350 && onSelectedInk(e.clientX, e.clientY)) gest.mode = 'ink';
    gest.moved = true; gest.pd = s.d; gest.pa = s.ang; gest.pcx = s.cx; gest.pcy = s.cy;
    const t = sel(); if (gest.mode === 'ink' && t) { gest.w0 = t.width; gest.r0 = t.rot; gest.d0 = s.d; gest.a0 = s.ang; if (!gest.snap) { snapshot(); gest.snap = true; } }
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId); if (!p || !gest) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pts.size === 1) {
    const dx = e.clientX - gest.px, dy = e.clientY - gest.py; gest.px = e.clientX; gest.py = e.clientY;
    if (!gest.moved && Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) < (gest.type === 'mouse' ? 4 : 9)) return;
    gest.moved = true;
    if (gest.mode === 'cam') {
      glide = false; goal.theta -= dx * 0.0085; goal.phi = THREE.MathUtils.clamp(goal.phi - dy * 0.0065, 0.2, Math.PI - 0.35); needsRender = true;
    } else {
      const t = sel(); if (!t) return;
      const h = hitBody(e.clientX - gest.ox, e.clientY - gest.oy);
      if (h) { if (!gest.snap) { snapshot(); gest.snap = true; } t.pos = h.point.toArray(); t.normal = h.normal.clone().normalize().toArray(); updateLiveGuides(t); inkDirty = true; }
    }
  } else if (pts.size === 2) {
    clearLiveGuides();
    const s = two();
    const delta=twoPointerDelta({distance:gest.pd,angle:gest.pa,cx:gest.pcx,cy:gest.pcy},{distance:s.d,angle:s.ang,cx:s.cx,cy:s.cy});
    if (gest.mode === 'ink' && sel()) {
      const t = sel(); t.width = THREE.MathUtils.clamp(gest.w0 * (s.d / gest.d0), 0.012, 0.9);
      let da = s.ang - gest.a0; da = Math.atan2(Math.sin(da), Math.cos(da)); t.rot = gest.r0 - da; inkDirty = true;
    } else {
      glide = false; goal.r = THREE.MathUtils.clamp(goal.r * delta.zoomRatio, 0.22, 7);
      goal.roll=wrapAngle((goal.roll||0)+delta.rollDelta);
      const k = (2 * cur.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / canvas.getBoundingClientRect().height;
      const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0), up = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
      const mx = -(s.cx - gest.pcx) * k, my = (s.cy - gest.pcy) * k;
      goal.tx = THREE.MathUtils.clamp(goal.tx + right.x * mx + up.x * my, -0.7, 0.7);
      goal.ty = THREE.MathUtils.clamp(goal.ty + right.y * mx + up.y * my, -0.1, 1.9);
      goal.tz = THREE.MathUtils.clamp(goal.tz + right.z * mx + up.z * my, -0.5, 0.5);
      needsRender = true;
    }
    gest.pd = s.d; gest.pa = s.ang; gest.pcx = s.cx; gest.pcy = s.cy;
  }
});
function cancelGesture() {
  clearLiveGuides();
  const g = gest; gest = null;
  const ids = [...pts.keys()]; pts.clear();
  for (const id of ids) { try { canvas.releasePointerCapture(id); } catch (_) { /* already released */ } }
  if (g?.snap) commit();
  if(tapPlaceId){tapPlaceId=null;renderSheet();}
}
function endPointer(e) {
  clearLiveGuides();
  if (e.type === 'pointercancel') { cancelGesture(); return; }
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size === 1 && gest) { const p = [...pts.values()][0]; gest.px = p.x; gest.py = p.y; const t = sel(); if (t) { const sc = screenOf(new V3(...viewSpot(t).pos)); gest.ox = p.x - sc.x; gest.oy = p.y - sc.y; } return; }
  if (pts.size > 0 || !gest) return;
  const g = gest; gest = null;
  if (g.snap) { commit(); }
  if (!g.moved && performance.now() - g.t0 < 450 && e.type === 'pointerup') tap(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', (e) => { if (pts.has(e.pointerId)) cancelGesture(); });
window.addEventListener('blur', cancelGesture);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGesture(); });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); glide = false; goal.r = THREE.MathUtils.clamp(goal.r * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), 0.22, 7); needsRender = true; }, { passive: false });
function tap(x, y) {
  if(tapPlaceId){const t=sel(),h=hitBody(x,y);if(!t||t.id!==tapPlaceId||t.locked||t.hidden||t.status==='existing'){tapPlaceId=null;renderSheet();return;}if(!h){toast('Tap directly on the body, or cancel tap-to-place.');return;}try{const placed=planTapPlacement(t,{pos:h.point.toArray(),normal:h.normal.toArray()});snapshot();Object.assign(t,placed);tapPlaceId=null;commit();toast('Tattoo placed.', 'Undo', undo);}catch(e){toast(e.message);}return;}
  const h = hitBody(x, y),ids=inkIdsAt(x,y,h),now=performance.now();const id=cycleInkHit(ids,lastInkTap,{x,y,time:now});
  if(id){lastInkTap={ids,id,x,y,time:now};select(id,ids.length===1);lastTap={t:0,x,y,empty:false};return;}
  lastInkTap=null;
  const dbl = lastTap.empty && now - lastTap.t < 380 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40;
  lastTap = { t: now, x, y, empty: true };
  if (dbl) { fullBody(); lastTap.t = 0; }
  if (selectedId) select(null);
}
let inkDirty = false;

/* ---------- UI ---------- */
function el(tag, props = {}, ...kids) { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); } for (const c of kids) if (c) n.append(c); return n; }
function renderTray() {
  const tray = $('#trayItems'); tray.replaceChildren();
  for (const t of state.tattoos) {
    const b = el('button', { class: 'chip' + (t.id === selectedId ? ' on' : '') + (t.hidden ? ' off' : ''), type: 'button', 'aria-label': 'Select ' + t.name, 'aria-pressed': t.id === selectedId ? 'true' : 'false', onclick: () => select(t.id, true) },
      el('img', { src: images[t.img], alt: '' }), el('span', { text: t.name }));
    if (t.status === 'existing') b.append(el('i', { class: 'lock', text: 'On me' })); else if (t.locked) b.append(el('i', { class: 'lock', text: 'Locked' }));
    tray.append(b);
  }
  $('#count').textContent = state.tattoos.length ? `${state.tattoos.length} on the body` : 'Nothing placed yet';
}
function renderSheet() {
  const t = sel(); const sh = $('#sheet'); sh.hidden = !t; $('#hint').hidden = !!t || state.tattoos.length === 0;
  $('#empty').hidden = state.tattoos.length > 0;
  if(tapPlaceId&&(!t||t.id!==tapPlaceId||t.locked||t.hidden||t.status==='existing'))tapPlaceId=null;
  $('#tapPlaceBar').hidden=!tapPlaceId;$('#bTapPlace').setAttribute('aria-pressed',String(!!tapPlaceId));$('#bTapPlace').textContent=tapPlaceId?'Cancel tap to place':'Tap to place';$('#bTapPlace').disabled=!t||t.locked||t.hidden||t.status==='existing';canvas.style.cursor=tapPlaceId?'crosshair':'';
  if (!t) return;
  if (document.activeElement !== $('#name')) $('#name').value = t.name;
  $('#size').textContent = sizeText(t);
  const linkedCount=t.artworkId?state.tattoos.filter(x=>x.artworkId===t.artworkId).length:1;
  $('#bCleanupLinked').hidden=linkedCount<2; $('#bCleanupLinked').disabled=!!t.locked; $('#bCleanupLinked').textContent=`Clean up ${linkedCount} linked copies`;
  $('#exactWidth').value = (t.width * state.heightCm / 175 * 100 / 2.54).toFixed(2);
  for (const id of ['rSize','rTurn','rFade','rWrap','rBend','rTaper','bFlip','bFlipVertical','bDraft','bCleanup','bDel','exactWidth','resetTransform']) $('#'+id).toggleAttribute('disabled', !!t.locked);
  document.querySelectorAll('[data-inch],[data-nudge]').forEach(b => b.disabled = !!t.locked);
  $('#rSize').value = Math.round(Math.log(t.width / 0.012) / Math.log(0.9 / 0.012) * 1000);
  $('#rTurn').value = Math.round(((((t.rot * 180 / Math.PI) + 180) % 360 + 360) % 360) - 180);
  $('#rFade').value = Math.round((t.opacity ?? 0.92) * 100);
  $('#rWrap').value = Math.round((t.wrap || 0) * 100); $('#rBend').value = Math.round((t.bend || 0) * 100); $('#rTaper').value = Math.round((t.taper || 0) * 100);
  const shaped = (t.wrap || 0) || (t.bend || 0) || (t.taper || 0); $('#wrapMark').textContent = shaped ? 'on' : ''; if (!shaped && !$('#wrapBox').open) { /* leave closed */ }
  $('#bLock').textContent = t.locked ? 'Unlock' : 'Lock in place'; $('#bLock').setAttribute('aria-pressed', t.locked ? 'true' : 'false');
  $('#bHide').textContent = t.hidden ? 'Show' : 'Hide';
  $('#bStatus').textContent = t.status === 'existing' ? 'Already on me' : 'Planned'; $('#bStatus').setAttribute('aria-pressed', t.status === 'existing' ? 'true' : 'false');
  $('#bFlip').setAttribute('aria-pressed', t.flip ? 'true' : 'false');
  $('#moveTip').textContent = tapPlaceId?'Tap a spot on the body to place this tattoo. Drag or pinch to adjust the view first.':t.status==='existing'?'Existing ink stays in place. Change to Planned before moving it.':t.locked?'Locked. Unlock to move it.':'Drag the tattoo to move it. Two fingers on it resize and turn it.';
}
function renderBody() {
  const sw = $('#skins'); sw.replaceChildren();
  SKINS.forEach((c, i) => sw.append(el('button', { class: 'sw' + (i === state.skin && !state.skinHex ? ' on' : ''), type: 'button', style: `background:${c}`, 'aria-label': 'Skin tone ' + (i + 1), onclick: () => { snapshot(); state.skin = i; state.skinHex = null; skinMat.color.set(c); needsRender = true; renderBody(); save(); } })));
  document.querySelectorAll('[data-fig]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fig === state.figure ? 'true' : 'false'));
  $('#rMuscle').value = Math.round((state.muscle ?? 0.5) * 100); $('#rWeight').value = Math.round((state.weight ?? 0.5) * 100);
  syncFitUI();
  $('#rHeight').value = state.heightCm; const inch = state.heightCm / 2.54; $('#hText').textContent = `${Math.floor(inch / 12)} ft ${Math.round(inch % 12)} in  ·  ${state.heightCm} cm`;
}
function renderUI() { $('#cV47Source').hidden=!state.v47Source; $('#openUnplaced').hidden=!(state.unplacedTattoos||[]).length; renderTray(); renderSheet(); renderBody(); refreshUndo(); }
function toast(msg, action, fn) {
  const t = $('#toast'); t.replaceChildren(el('span', { text: msg })); if (action) t.append(el('button', { type: 'button', text: action, onclick: () => { fn(); t.hidden = true; } }));
  t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 5200);
}
let slideSnap = false;
function slider(id, fn) { const r = $(id); r.addEventListener('input', () => { const t = sel(); if (!t || t.locked) return; if (!slideSnap) { snapshot(); slideSnap = true; } fn(t, +r.value); syncDecals(); $('#size').textContent = sizeText(t); }); r.addEventListener('change', () => { slideSnap = false; commit(); }); }
slider('#rSize', (t, v) => { t.width = 0.012 * Math.pow(0.9 / 0.012, v / 1000); });
slider('#rTurn', (t, v) => { t.rot = v * Math.PI / 180; });
slider('#rFade', (t, v) => { t.opacity = v / 100; });
slider('#rWrap', (t, v) => { t.wrap = v / 100; });
slider('#rBend', (t, v) => { t.bend = v / 100; });
slider('#rTaper', (t, v) => { t.taper = v / 100; });
$('#name').addEventListener('change', () => { const t = sel(); if (!t) return; snapshot(); t.name = $('#name').value.trim() || 'Tattoo'; commit(); });
$('#bFlip').addEventListener('click', () => { const t = sel(); if (!t) return; if (t.locked) { toast('Unlock this tattoo first.'); return; } snapshot(); t.flip = !t.flip; commit(); });
$('#bLock').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.locked = !t.locked; commit(); });
$('#bStatus').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.status = t.status === 'existing' ? 'planned' : 'existing'; t.locked = t.status === 'existing'; commit(); });
$('#bHide').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.hidden = !t.hidden; commit(); });
$('#bFlipVertical').addEventListener('click',()=>{const t=sel();if(!t||t.locked)return;snapshot();t.imageTopDown=!t.imageTopDown;commit();});
$('#bDup').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); const f = frameOf(t); const p = new V3(...t.pos).addScaledVector(f.right, t.width * 0.6).addScaledVector(f.n, 0.2); const h = surfaceAt(p, f.n.clone().negate()); const c = { ...t, id: uid(), name: t.name + ' copy', locked: false, pos: h ? h.pos : t.pos, normal: h ? h.normal : t.normal }; state.tattoos.push(c); selectedId = c.id; commit(); });
$('#bDel').addEventListener('click', () => { const t = sel(); if (!t) return; if (t.locked) { toast('Unlock this tattoo first.'); return; } snapshot(); state.tattoos = state.tattoos.filter((x) => x.id !== t.id); selectedId = null; commit(); toast(`Removed ${t.name}`, 'Undo', undo); });
function setWidthInches(value) {
 const t = sel(); if (!t || t.locked || !Number.isFinite(value) || value <= 0) return;
 snapshot(); t.width = Math.max(.012, Math.min(.9, value * 2.54 / 100 * 175 / state.heightCm)); commit();
}
$('#exactWidth').addEventListener('change', () => setWidthInches(+$('#exactWidth').value));
document.querySelectorAll('[data-inch]').forEach(b => b.addEventListener('click',()=>setWidthInches(+b.dataset.inch)));
document.querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click',()=>{
 const t=sel(); if(!t || t.locked) return; const [x,y]=b.dataset.nudge.split(',').map(Number), f=frameOf(t);
 const p=new V3(...t.pos).addScaledVector(f.right,x*.002*175/state.heightCm).addScaledVector(f.up,y*.002*175/state.heightCm).addScaledVector(f.n,.03);
 const h=surfaceAt(p,f.n.clone().negate()); if(!h) return; snapshot();t.pos=h.pos;t.normal=h.normal;commit();
}));
$('#resetTransform').addEventListener('click',()=>{const t=sel();if(!t || t.locked)return;snapshot();t.rot=0;t.wrap=0;t.bend=0;t.taper=0;commit();});
async function cleanupSelected(linked=false) {
  const t = sel(); if (!t) return;
  if (t.locked) { toast('Unlock this tattoo before editing its artwork.'); return; }
  cancelGesture();
  const id = t.id, prior = t.img;
  const art = state.artworks?.[t.artworkId];
  const source = art?.source || prior;
  const result = await editArtwork(images[source] || images[prior], images[prior], art?.cleanupSession);
  if (!result) return;
  const current = state.tattoos.find(x => x.id === id);
  if (!current || current.img !== prior || current.locked) { toast('The artwork changed while cleanup was open. Nothing was replaced.'); return; }
  const key = uid(); images[key] = result.dataUrl;
  if(!await loadImg(key)){delete images[key];toast('The cleaned image could not be opened. Nothing changed.');return;}
  snapshot();
  const revision=applyArtworkRevision(state,id,key,result.aspect,{linked,session:result.session,settings:result.settings});
  state=revision.nextState;
  if(revision.artworkId)state.artworks[revision.artworkId].cleanup=result.settings || {};
  commit(); toast(`${revision.changedIds.length} artwork updated. Original kept.${revision.skippedIds.length?' Locked copies unchanged.':''}`, 'Undo', undo);
}
$('#bCleanup').addEventListener('click',()=>cleanupSelected(false).catch(e=>toast('Could not clean up artwork: '+e.message)));
$('#bCleanupLinked').addEventListener('click',()=>cleanupSelected(true).catch(e=>toast('Could not clean up artwork: '+e.message)));
for(const detail of document.querySelectorAll('#sheet details'))detail.addEventListener('toggle',()=>{requestAnimationFrame(()=>{const t=sel();if(t&&!gest)focusTattoo(t);});});
$('#liveGuides').addEventListener('change',()=>{$('#snapGuides').disabled=!$('#liveGuides').checked;if(!$('#liveGuides').checked)$('#snapGuides').checked=false;clearLiveGuides();});
$('#snapGuides').addEventListener('change',clearLiveGuides);
$('#bTapPlace').addEventListener('click',()=>{if(tapPlaceId){tapPlaceId=null;renderSheet();return;}cancelGesture();const t=sel();if(!t||t.locked||t.hidden||t.status==='existing')return;tapPlaceId=t.id;renderSheet();toast('Tap the body to place it. Drag to adjust the view first.');});
$('#cancelTapPlace').addEventListener('click',()=>{tapPlaceId=null;renderSheet();});
$('#bDone').addEventListener('click', () => select(null));
$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$('#full').addEventListener('click', () => { cancelGesture(); toggle('#bodyPop', false); select(null); fullBody(); });
// Before / after: left of the line shows only ink already on the body, right shows the plans too.
const beforeAfter = createBeforeAfter({ after: $('#stage'), onChange: () => { needsRender = true; $('#baBtn').setAttribute('aria-pressed', String(beforeAfter.on)); } });
function plannedShown() { return state.tattoos.filter((t) => t.status !== 'existing' && decals[t.id] && decals[t.id].mesh.visible); }
function hidePlanned() {
  const off = [];
  for (const t of state.tattoos) { const d = decals[t.id]; if (!d || t.status === 'existing') continue; off.push([d.mesh, d.mesh.visible], [d.outline, d.outline.visible]); d.mesh.visible = false; d.outline.visible = false; }
  return () => { for (const [m, v] of off) m.visible = v; };
}
function posedInk() { return poseView.active ? Object.values(decals).flatMap((d) => [d.mesh, d.outline]) : []; }
function drawFrame() { clothes.sync(shapeKey, poseView.version); poseView.withPosed(() => { if (beforeAfter.on) beforeAfter.render(renderer, scene, camera, hidePlanned); else renderer.render(scene, camera); }, posedInk()); }
/* ---------- poses ---------- */
// The body poses in the main view; ink follows and can still be placed. Nothing is saved.
{
  const list = $('#poseList');
  for (const group of POSE_GROUPS) {
    const keys = Object.keys(POSE_CATALOG).filter((k) => POSE_CATALOG[k].group === group); if (!keys.length) continue;
    if (group !== 'Standing') { const h = document.createElement('h4'); h.textContent = group; list.append(h); }
    const grid = document.createElement('div'); grid.className = 'posegrid'; list.append(grid);
    for (const k of keys) { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.dataset.pose = k; b.textContent = POSE_CATALOG[k].label; grid.append(b); }
  }
  for (const [k, m] of Object.entries(MOTION_CATALOG)) { const o = document.createElement('option'); o.value = k; o.textContent = m.label; $('#motionKind').append(o); }
}
function poseLabel() { const k = poseView.key; return k === 'motion' ? MOTION_CATALOG[poseView.motion.kind].label : k === 'custom' ? 'Custom' : POSE_CATALOG[k] ? POSE_CATALOG[k].label : 'Standing'; }
function renderPose() {
  const k = poseView.key, m = poseView.motion;
  $('#poseBtn').textContent = poseView.active || m.playing ? 'Pose: ' + poseLabel() : 'Pose';
  $('#poseBtn').setAttribute('aria-expanded', String(!$('#posePop').hidden));
  document.querySelectorAll('#poseList [data-pose]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pose === k)));
  $('#motionKind').value = m.kind; $('#motionPlay').textContent = m.playing ? 'Pause' : 'Play'; $('#motionPlay').setAttribute('aria-pressed', String(m.playing));
  document.querySelectorAll('#posePop [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === m.speed)));
  if (!scrubbing) $('#motionScrub').value = k === 'motion' ? Math.round(m.phase * 100) : 0;
}
let scrubbing = false;
function afterPoseChange() { spotCache.clear(); const t = sel(); if (t && !gest) requestAnimationFrame(() => { if (sel() === t && poseView.settled()) focusTattoo(t); }); }
$('#poseBtn').addEventListener('click', () => { cancelGesture(); toggle('#bodyPop', false); toggle('#clothesPop', false); toggle('#posePop'); renderPose(); });
$('#poseList').addEventListener('click', (e) => { const b = e.target.closest('[data-pose]'); if (!b) return; cancelGesture(); poseView.choose(b.dataset.pose); renderPose(); setTimeout(afterPoseChange, 320); });
$('#motionKind').addEventListener('change', () => { poseView.scrub(0, $('#motionKind').value); if ($('#motionPlay').getAttribute('aria-pressed') === 'true') poseView.play(); renderPose(); });
$('#motionPlay').addEventListener('click', () => { if (poseView.motion.playing) poseView.pause(); else poseView.play($('#motionKind').value); renderPose(); });
document.querySelectorAll('#posePop [data-speed]').forEach((b) => b.addEventListener('click', () => { poseView.speed = +b.dataset.speed; renderPose(); }));
$('#motionScrub').addEventListener('input', () => { scrubbing = true; poseView.scrub($('#motionScrub').value / 100, $('#motionKind').value); scrubbing = false; renderPose(); });
$('#motionScrub').addEventListener('change', afterPoseChange);
renderPose();
/* ---------- clothes ---------- */
// Everyday clothes drawn over the body, to see which tattoos show. Only for looking: not saved.
{
  const fill = (host, list, part) => { for (const [k, label] of Object.entries(list)) { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.dataset[part] = k; b.textContent = label; $(host).append(b); } };
  fill('#clothesTop', TOPS, 'top'); fill('#clothesBottom', BOTTOMS, 'bottom'); fill('#clothesHair', HAIR, 'hair');
}
function clothesLabel() { const c = clothes.choice, parts = []; if (c.top !== 'none') parts.push(TOPS[c.top]); if (c.bottom !== 'none') parts.push(BOTTOMS[c.bottom]); if (c.hair !== 'none') parts.push('hair'); return parts.join(' + '); }
// Which visible tattoos the clothes hide, partly hide or leave showing.
function clothesReport() {
  const c = clothes.choice; if (c.top === 'none' && c.bottom === 'none' && c.hair === 'none') return null;
  const out = { covered: [], partly: [], showing: [] };
  for (const t of state.tattoos) {
    if (t.hidden) continue; const d = decals[t.id]; const sup = d && d.mesh.geometry.userData.supports;
    const share = clothes.coveredShare(sup); (share >= 0.9 ? out.covered : share > 0.1 ? out.partly : out.showing).push(t.name || 'Untitled');
  }
  return out;
}
function renderClothes() {
  const c = clothes.choice, label = clothesLabel();
  $('#clothesBtn').textContent = label ? 'Clothes: ' + label : 'Clothes';
  $('#clothesBtn').setAttribute('aria-expanded', String(!$('#clothesPop').hidden));
  document.querySelectorAll('#clothesTop [data-top]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.top === c.top)));
  document.querySelectorAll('#clothesBottom [data-bottom]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bottom === c.bottom)));
  document.querySelectorAll('#clothesHair [data-hair]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hair === c.hair)));
  const r = clothesReport(), list = (a) => a.join(', ');
  $('#clothesShow').textContent = !r ? '' : !state.tattoos.some((t) => !t.hidden) ? 'Add a tattoo to see whether it shows.' :
    [r.covered.length ? 'Covered: ' + list(r.covered) + '.' : 'Nothing fully covered.', r.partly.length ? 'Partly showing: ' + list(r.partly) + '.' : '', r.showing.length ? 'Showing: ' + list(r.showing) + '.' : ''].filter(Boolean).join(' ');
}
function setClothes(next) { clothes.set(next); clothes.sync(shapeKey, poseView.version); needsRender = true; renderClothes(); }
$('#clothesBtn').addEventListener('click', () => { cancelGesture(); toggle('#posePop', false); toggle('#bodyPop', false); toggle('#clothesPop'); renderClothes(); });
$('#clothesTop').addEventListener('click', (e) => { const b = e.target.closest('[data-top]'); if (b) setClothes({ top: b.dataset.top }); });
$('#clothesBottom').addEventListener('click', (e) => { const b = e.target.closest('[data-bottom]'); if (b) setClothes({ bottom: b.dataset.bottom }); });
$('#clothesHair').addEventListener('click', (e) => { const b = e.target.closest('[data-hair]'); if (b) setClothes({ hair: b.dataset.hair }); });
renderClothes();
$('#baBtn').addEventListener('click', () => {
  if (beforeAfter.on) { beforeAfter.set(false); return; }
  if (!plannedShown().length) { toast('Nothing planned to compare yet. Mark a tattoo as Planned to see it here.'); return; }
  beforeAfter.set(true); toast('Left: your skin now. Right: with your planned tattoos. Drag the line to compare.');
});
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => fullBody(+b.dataset.view * Math.PI / 2)));
$('#add').addEventListener('click', () => $('#file').click());
$('#emptyAdd').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async (e) => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
  snapshot(); let last = null; let first = true;
  for (const f of files) {
    if (/\.(usdz|zip)$/i.test(f.name) || /usdz|zip/.test(f.type)) { await importPainted(f, false); continue; }
    if (/json$/i.test(f.name) || f.type === 'application/json') { if (f.size > 300e6) { toast('That file is too large to open here.'); continue; } await importBackup(await f.text()); continue; }
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {toast('Choose a PNG, JPEG or WebP picture.');continue;}
    if (f.size > 10*1024*1024) { toast('Use a picture smaller than 10 MiB.'); continue; }
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); });
    if (typeof url !== 'string') continue;
    const t = await addImage(url, f.name.replace(/\.[^.]+$/, '').slice(0, 100), first ? viewCenterSpot() : null); if (t) {first = false;last = t;}
  }
  if (last) { selectedId = last.id; commit(); focusTattoo(last); } else commit();
});
function toggle(id, show) { const n = $(id); n.hidden = show == null ? !n.hidden : !show; if (id === '#bodyPop') updateInset(); if (id === '#posePop') renderPose(); if (id === '#clothesPop' && typeof renderClothes === 'function') renderClothes(); }
$('#bodyBtn').addEventListener('click', () => { toggle('#bodyPop'); });
$('#rHeight').addEventListener('input', () => { state.heightCm = +$('#rHeight').value; renderBody(); renderSheet(); save(); });
document.querySelectorAll('[data-fig]').forEach((b) => b.addEventListener('click', () => { if (state.figure === b.dataset.fig) return; snapshot(); reshape(() => { state.figure = b.dataset.fig; }); commit(); }));
/* ---------- body shape sliders ---------- */
// Every shape slider works the same way: pin the ink to its triangles when the drag
// starts, reshape live, and record one undo step when the finger lifts.
let shapeSlide = null;
function bindShape(r, set) {
  r.addEventListener('input', () => { if (!shapeSlide) { snapshot(); shapeSlide = anchorsNow(); } set(+r.value / 100); applyShape(); applyAnchors(shapeSlide); syncDecals(); });
  r.addEventListener('change', () => { shapeSlide = null; commit(); });
}
bindShape($('#rMuscle'), (v) => { state.muscle = v; });
bindShape($('#rWeight'), (v) => { state.weight = v; });
const fitEls = {}; const fitGroupEls = [];
(function buildFitUI() {
  const host = $('#fitGroups');
  for (const g of FIT_GROUPS) {
    const grp = el('div', { class: 'grp' }), mark = el('i'); let tog = null;
    if (g.toggle) { tog = el('button', { class: 'btn', type: 'button', text: 'Show on the body', onclick: () => { snapshot(); reshape(() => { state[g.toggle] = state[g.toggle] === false; }); commit(); } }); grp.append(tog); }
    for (const it of g.items) {
      const s = el('ink-slider', { min: -100, max: 100, 'aria-label': it.label });
      const row = el('div', { class: 'lbl' }, it.label, s);
      bindShape(s, (v) => { state.fit = state.fit || {}; if (v) state.fit[it.key] = v; else delete state.fit[it.key]; });
      grp.append(row); fitEls[it.key] = { s, row, when: it.when };
    }
    const d = el('details', {}, el('summary', {}, el('span', { text: g.title }), mark), grp);
    fitGroupEls.push({ g, d, mark, tog }); host.append(d);
  }
})();
function syncFitUI() {
  const fit = state.fit || {};
  for (const G of fitGroupEls) {
    let changed = 0, shown = 0;
    for (const it of G.g.items) {
      const e = fitEls[it.key], vis = fitVisible(it.when, state.figure);
      e.row.hidden = !vis; e.s.value = Math.round((fit[it.key] || 0) * 100);
      if (vis) { shown++; if (fit[it.key]) changed++; }
    }
    G.d.hidden = !shown || !fitVisible(G.g.when, state.figure);
    G.mark.textContent = changed ? `${changed} changed` : '';
    if (G.tog) G.tog.setAttribute('aria-pressed', state[G.g.toggle] !== false ? 'true' : 'false');
  }
}
$('#fitReset').addEventListener('click', () => { snapshot(); reshape(() => { state.fit = {}; state.muscle = 0.5; state.weight = 0.5; }); commit(); toast('Body shape back to standard', 'Undo', undo); });
// Keep browser/page zoom separate from the 3D camera. Single-finger panel
// scrolling is allowed; pinching panels must not zoom the entire app off-screen.
// A one-finger (or Pencil) touch that starts on a button is left alone, so the jitter of
// a tap never turns into a cancelled click; the page itself cannot scroll anyway.
document.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && controlAt(e.target)) return;
  if (e.touches.length > 1 || !(e.target instanceof Element) || !e.target.closest('.pop,.modal,#trayItems,#sheet,[aria-modal=true]')) e.preventDefault();
}, { passive: false });
installPenTap();
for (const name of ['gesturestart', 'gesturechange']) document.addEventListener(name, (e) => e.preventDefault(), { passive: false });
// iOS can still change its visual viewport (keyboard, accessibility/page zoom,
// browser chrome). Fit the whole studio to that visible rectangle rather than
// assuming fixed controls at layout-viewport corners are still reachable.
if (window.visualViewport) {
  const vv = window.visualViewport, viewport = $('#viewport');
  const onVV = () => {
    const scale = vv.scale || 1;
    viewport.style.width = `${vv.width * scale}px`;
    viewport.style.height = `${vv.height * scale}px`;
    viewport.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px) scale(${1 / scale})`;
    document.documentElement.style.setProperty('--kb', '0px');
  };
  vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV); onVV();
}
// An installed copy picks up a new build as soon as its service worker takes over.
// A new version arrives in the background (service worker autoUpdate). Never reload
// under Jake's hands: before he has touched anything it reloads straight away, after
// that it waits until the app leaves the screen or he taps Reload, and it always
// finishes writing the save first.
let touchedSinceBoot = false, updateReady = false;
window.addEventListener('pointerdown', () => { touchedSinceBoot = true; }, { capture: true, passive: true });
async function reloadForUpdate() {
  for (let i = 0; i < 100 && (saving || dirty); i++) { if (!saving) await flushSave(); else await new Promise((r) => setTimeout(r, 50)); }
  if (dirty || saving) return; // the save is failing: keep the page (and the work) rather than reload
  location.reload();
}
function onUpdateReady() {
  if (updateReady) return; updateReady = true;
  if (document.hidden || (!touchedSinceBoot && !gest)) { reloadForUpdate(); return; }
  toast('A new version of Ink Atlas is ready.', 'Reload', reloadForUpdate);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && updateReady) reloadForUpdate(); });
if ('serviceWorker' in navigator) { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) onUpdateReady(); }); }
$('#projectsBtn').addEventListener('click', () => {cancelGesture();toggle('#planMenu',true);});
$('#openPose').addEventListener('click',()=>{cancelGesture();toggle('#planMenu',false);toggle('#posePop',true);renderPose();});
function previewInput() {return {THREE,state:JSON.parse(JSON.stringify(state)),bodyGeometry:bodyGeo,bodyMaterial:skinMat,decals:state.tattoos.filter(t=>!t.hidden).map(t=>decals[t.id]).filter(d=>d && d.tex).map(d=>({geometry:d.mesh.geometry,material:d.mesh.material}))};}
$('#openBodyTools').addEventListener('click',async()=>{
  cancelGesture();toggle('#planMenu',false);let originalNotes=JSON.stringify({notes:state.notes,drawings:state.drawings});
  try {const {openBodyTools}=await import('./body-tools.js');await openBodyTools({...previewInput(),onSaveState:({notes,drawings})=>{
    if(JSON.stringify({notes:state.notes,drawings:state.drawings})!==originalNotes)throw new Error('Notes changed while this window was open. Close and reopen to keep both versions safe.');
    snapshot();state.notes=notes;state.drawings=drawings;commit();originalNotes=JSON.stringify({notes:state.notes,drawings:state.drawings});
  }});}catch(e){toast('Could not open body tools: '+e.message);}
});
$('#openPhotoFit').addEventListener('click',async()=>{
 cancelGesture();toggle('#planMenu',false);const before=JSON.stringify(state);
 try{const {openPhotoFit}=await import('./photo-fit.js');await openPhotoFit({THREE,state:JSON.parse(before),bodyMaterial:skinMat,onApplyCopy:async params=>{
  if(JSON.stringify(state)!==before)throw new Error('The project changed. Reopen the fitting preview.');
  const proposed=cleanState({...state,figure:params.figure,muscle:params.muscle,weight:params.weight,heightCm:params.heightCm,fit:params.fit},k=>!!images[k]).state;
  const shelf=await openProjectShelf();try{await shelf.create((state.projectName||'My tattoos')+' · before fitting',{state,images:usedImages()});}finally{shelf.close();}
  if(JSON.stringify(state)!==before)throw new Error('The project changed. Its earlier copy is safely kept, but fitting was not applied.');
  snapshot();reshape(()=>{for(const k of ['figure','muscle','weight','heightCm','fit'])state[k]=proposed[k];});state.projectName=(state.projectName||'My tattoos')+' · fitted copy';commit();fullBody();toast('Fitted copy opened. The original is kept in Projects.');
 }});}catch(e){toast('Could not open photo fitting: '+e.message);}
});
$('#openClothing').addEventListener('click',()=>{
  cancelGesture();toggle('#planMenu',false);toggle('#posePop',false);toggle('#clothesPop',true);
});
$('#openNotes').addEventListener('click',async()=>{
  toggle('#planMenu',false);
  try {const {openBodyNotes}=await import('./body-notes.js');await openBodyNotes({getState:()=>state,change:fn=>{snapshot();fn(state);commit();}});}
  catch(e){toast('Could not open notes: '+e.message);}
});
function projectGroupSurface(position,normal,tattoo) {
  const n=new V3(...normal).normalize();ray.set(new V3(...position).addScaledVector(n,.12),n.clone().negate());ray.far=.24;
  const hit=ray.intersectObject(body,false)[0];ray.far=Infinity;if(!hit || hit.faceIndex==null)return null;
  const start=startTriangle(tattoo),target=hit.faceIndex,I=bodyGeo.index.array,P=bodyGeo.attributes.position.array,A=bodyAdjacency();
  const centre=tri=>{const p=[0,0,0];for(let k=0;k<3;k++)for(let j=0;j<3;j++)p[j]+=P[I[tri*3+k]*3+j]/3;return p;};
  const limit=Math.min(.3,Math.hypot(...position.map((v,i)=>v-tattoo.pos[i]))*3+.045);
  const best=new Float64Array(I.length/3);best.fill(Infinity);best[start]=0;const queue=[[start,0]];let found=false,guard=0;
  while(queue.length && guard++<8000){queue.sort((a,b)=>b[1]-a[1]);const [tri,cost]=queue.pop();if(cost!==best[tri])continue;if(tri===target){found=true;break;}const c=centre(tri);
    for(let k=0;k<3;k++){const next=A[tri*3+k];if(next<0)continue;const d=centre(next),value=cost+Math.hypot(...d.map((v,i)=>v-c[i]));if(value<=limit&&value<best[next]){best[next]=value;queue.push([next,value]);}}
  }
  return found?{pos:hit.point.toArray(),normal:hit.normal.clone().normalize().toArray()}:null;
}
async function transformSelection(options) {
  const {planGroupTransform}=await import('./group-transform.js');
  const result=planGroupTransform(state.tattoos,options.ids,options,projectGroupSurface);
  if(!result.updates.length)return {message:'No unlocked planned pieces selected.'};
  snapshot();for(const update of result.updates){const t=state.tattoos.find(x=>x.id===update.id);if(t)Object.assign(t,update);}
  commit();return {message:`${result.updates.length} pieces transformed.${result.skippedIds.length?' Locked/existing pieces unchanged.':''}`};
}
function placementProjection(position,normal,tattoo,{operation}={}) {
 if(operation!=='bodySymmetry')return projectGroupSurface(position,normal,tattoo);
 const n=new V3(...normal).normalize();ray.set(new V3(...position).addScaledVector(n,.04),n.clone().negate());ray.far=.08;
 try{const hit=ray.intersectObject(body,false)[0];if(!hit||hit.faceIndex==null)return null;return {pos:hit.point.toArray(),normal:hit.normal.clone().normalize().toArray()};}finally{ray.far=Infinity;}
}
function previewPlacement(plan){
 if(!plan)return null;
 const oldCur={...cur},oldGoal={...goal},oldGlide=glide,visibility=[],temporary=[];
 try{
  for(const t of plan.updates){const d=decals[t.id];if(d){visibility.push([d.mesh,d.mesh.visible],[d.outline,d.outline.visible]);d.mesh.visible=false;d.outline.visible=false;}}
  for(const t of [...plan.updates,...plan.additions]){
   const tex=inkTexture(t),geo=decalGeometry(t),mat=new THREE.MeshBasicMaterial({map:tex,blending:THREE.MultiplyBlending,premultipliedAlpha:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,toneMapped:false});
   const mesh=new THREE.Mesh(geo,mat);mesh.renderOrder=200;scene.add(mesh);temporary.push({mesh,geo,mat,tex});
  }
  const target=[...plan.updates,...plan.additions][0];fullBody(Math.atan2(target.normal[0],target.normal[2]));Object.assign(cur,goal);applyCam();renderer.render(scene,camera);return {dataUrl:canvas.toDataURL('image/png')};
 }finally{for(const x of temporary){scene.remove(x.mesh);x.geo.dispose();x.mat.dispose();x.tex.dispose();}for(const [mesh,visible]of visibility)mesh.visible=visible;Object.assign(cur,oldCur);Object.assign(goal,oldGoal);glide=oldGlide;applyCam();needsRender=true;}
}
$('#openArtworkLibrary').addEventListener('click',async()=>{
 toggle('#planMenu',false);cancelGesture();
 try{const {openArtworkLibrary}=await import('./artwork-library.js');await openArtworkLibrary({getState:()=>state,getImages:()=>images,onBoardsChange:async nextBoards=>{
  const {validateArtworkBoards}=await import('./artwork-boards.js');const boards=validateArtworkBoards(nextBoards),baseline=JSON.stringify(state);
  await flushSave();while(saving)await new Promise(r=>setTimeout(r,20));
  if(JSON.stringify(state)!==baseline)throw new Error('Project changed while saving the board. Try again.');
  if(!store?.ok)throw new Error('Project storage unavailable. Boards were not changed.');
  const next=structuredClone(state);next.artworkBoards=boards;const assets={};for(const k of imageKeysFor(next))if(images[k])assets[k]=images[k];
  await store.save(next,assets);snapshot();state=next;commit();
 },onPlace:async plan=>{
  if(!await loadImg(plan.outputKey))throw new Error('Artwork image unavailable. Nothing placed.');
  if(state.tattoos.some(t=>t.id===plan.tattoo.id))throw new Error('Placement identity already exists.');
  const place=viewCenterSpot()||nextSlot();snapshot();state.artworks||={};if(plan.artwork)state.artworks[plan.artworkId]=plan.artwork;
  const tattoo={...plan.tattoo,pos:place.pos,normal:place.normal};state.tattoos.push(tattoo);selectedId=tattoo.id;commit();focusTattoo(tattoo);toast('Artwork placed as a new planned tattoo.','Undo',undo);
 }});}catch(e){toast('Artwork library: '+e.message);}
});
async function openDraftEditor(){
 toggle('#planMenu',false);cancelGesture();
 try{await flushSave();while(saving)await new Promise(r=>setTimeout(r,20));const {openPlacementDraft}=await import('./placement-draft.js');await openPlacementDraft({getState:()=>state,selectedId,preview:previewPlacement,onApply:async next=>{
  if(!store?.ok)throw new Error('Project storage is unavailable. Draft retained; placement was not committed.');
  await flushSave();while(saving)await new Promise(r=>setTimeout(r,20));await store.save(next,usedImages());snapshot();state=next;commit();
 }});}catch(e){toast('Placement draft: '+e.message);}
}
$('#openDraft').addEventListener('click',openDraftEditor);
$('#bDraft').addEventListener('click',openDraftEditor);
$('#openPlacement').addEventListener('click',async()=>{
 toggle('#planMenu',false);cancelGesture();const baseline=JSON.stringify(state);
 try{const {openPlacementTools}=await import('./placement-tools.js');await openPlacementTools({getState:()=>state,selectedId,projectToSurface:placementProjection,onPreview:previewPlacement,onApply:plan=>{
  if(JSON.stringify(state)!==baseline)throw new Error('Project changed while tools were open. Reopen tools.');
  for(const t of plan.updates){const old=state.tattoos.find(x=>x.id===t.id);if(!old||old.locked||old.status==='existing')throw new Error('Selected piece is no longer editable.');}
  if(plan.additions.some(t=>state.tattoos.some(x=>x.id===t.id)))throw new Error('Duplicate placement identity.');
  snapshot();for(const t of plan.updates)Object.assign(state.tattoos.find(x=>x.id===t.id),t);state.tattoos.push(...plan.additions);commit();toast('Placement applied.','Undo',undo);
 }});}catch(e){toast('Placement tools: '+e.message);}
});
$('#openLayers').addEventListener('click',()=>{toggle('#planMenu',false);openLayers({getState:()=>state,onTransform:transformSelection,getImages:()=>images,onSolo:ids=>{soloIds=ids?new Set(ids):null;syncDecals();},select:id=>select(id,true),change:fn=>{snapshot();fn(state);commit();}});});
$('#openUnplaced').addEventListener('click',()=>{
 toggle('#planMenu',false);const host=el('section',{class:'scrim',role:'dialog','aria-modal':'true','aria-label':'Saved artwork to place'});host.style.zIndex=10000;const panel=el('div',{class:'modal glass'},el('h2',{text:'Saved artwork to place'}),el('p',{text:'These pieces had no body position in the imported project. Place one deliberately, then adjust it on the body.'}));
 for(const record of state.unplacedTattoos||[])panel.append(el('button',{class:'card',text:'Place '+record.name+' on body',onclick:async()=>{
  const image=await loadImg(record.img);if(!image){toast('That saved image could not be opened.');return;}const spot=viewCenterSpot()||nextSlot();snapshot();state.unplacedTattoos=state.unplacedTattoos.filter(t=>t.id!==record.id);const t={...record,pos:spot.pos,normal:spot.normal,locked:false};state.tattoos.push(t);selectedId=t.id;commit();focusTattoo(t);host.remove();toast('Adjust the placement, then lock it when ready.');
 }}));panel.append(el('button',{class:'btn',text:'Close',onclick:()=>host.remove()}));host.append(panel);$('#viewport').append(host);host.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape')host.remove();};
});
async function compareSavedLayouts({a,b}){
 const {openLayoutCompare,compareBodyIdentity}=await import('./layout-compare.js');
 const baseline=JSON.stringify(state),identity=compareBodyIdentity(state),owned=[];
 try{
  const bundles=[];
  for(const record of [a,b]){
   const checked=cleanState(record.state,k=>typeof images[k]==='string');
   if(checked.dropped||checked.replace.length)throw new Error('This saved plan has missing artwork or invalid placements. Restore its backup before comparing.');
   const saved=checked.state;
   if(compareBodyIdentity(saved)!==identity)throw new Error('Live comparison currently needs both saved plans and the open project to use the same body, fit and skin. Saved-picture comparison remains available.');
   const entries=[];
   for(const t of saved.tattoos.filter(t=>!t.hidden)){
    if(!await loadImg(t.img))throw new Error('A saved artwork image could not be loaded.');
    const texture=inkTexture(t);owned.push(texture);const geometry=decalGeometry(t);owned.push(geometry);
    const material=new THREE.MeshBasicMaterial({map:texture,blending:THREE.MultiplyBlending,premultipliedAlpha:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,toneMapped:false});owned.push(material);entries.push({geometry,material});
   }
   bundles.push({name:record.name||'Saved plan',state:saved,bodyGeometry:bodyGeo,bodyMaterial:skinMat,decals:entries});
  }
  if(JSON.stringify(state)!==baseline)throw new Error('Project changed while preparing comparison. Open it again.');
  await openLayoutCompare({THREE,a:bundles[0],b:bundles[1]});
 }finally{owned.forEach(x=>x.dispose());}
}
$('#openPlanning').addEventListener('click',async()=>{
 toggle('#planMenu',false);
 try { await openPlanning({getState:()=>state,getPreview:()=>planningPreview(),onCompare3D:compareSavedLayouts,applyState:async next=>{snapshot();await openProject(next,images);commit();},getView:()=>({...goal}),setView:v=>{goal.roll=Number.isFinite(v.roll)?v.roll:0;for(const k of Object.keys(goal))if(Number.isFinite(v[k]))goal[k]=v[k];needsRender=true;}}); }
 catch(e){toast('Could not open planning: '+e.message);}
});
$('#openProjects').addEventListener('click', async () => {
 cancelGesture();toggle('#planMenu',false);
 try {
  const result = await openShelf({ current: () => ({state,images:usedImages()}), currentName:state.projectName || 'My tattoos' });
  if (!result) return;
  snapshot();
  if (result.action === 'new') { state = freshState(); state.projectName='New project'; selectedId=null; }
  else { await openProject(result.project.state,result.project.images); state.projectName=result.project.name; }
  commit();fullBody();toast('Project opened. Your previous work is saved in Projects.','Undo',undo);
 } catch(e) { toast('Could not open Projects: '+e.message); }
});
$('#shareBtn').addEventListener('click', () => toggle('#share', true));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { toggle('#' + b.dataset.close, false); }));
document.addEventListener('keydown', (e) => { if (document.querySelector('[aria-modal=true]')) return; if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (e.key === 'Escape') { cancelGesture(); toggle('#posePop', false); renderPose(); toggle('#clothesPop', false); toggle('#planMenu', false); toggle('#share', false); toggle('#preview', false); toggle('#recover', false); toggle('#bodyPop', false); } });

/* ---------- export (share sheet / download → src/share.js) ---------- */
function shot(hideInk) {
  const inset = curInset; curInset = 0; applyInset(); // exports are always centred, panel open or not
  exporting = true; decalGroup.visible = !hideInk; syncDecals(); poseView.withPosed(() => renderer.render(scene, camera), posedInk());
  const url = canvas.toDataURL('image/png');
  exporting = false; decalGroup.visible = true; syncDecals(); curInset = inset; applyInset(); needsRender = true; return url;
}
function artistPacket() {
  const oldCur = {...cur}, oldGoal = {...goal}, oldGlide = glide, oldSolo = soloIds;
  const views = [];
  try {
    soloIds = null;
    for (const [label, theta] of [['Front',0],['Right',Math.PI/2],['Back',Math.PI],['Left',-Math.PI/2]]) {
      fullBody(theta); Object.assign(cur, goal); applyCam();
      views.push({label,dataUrl:shot(false)});
    }
    return makeArtistPacket({name:state.projectName || 'My tattoo plan',heightCm:state.heightCm,views,tattoos:state.tattoos,images,artworks:state.artworks || {},notes:state.notes || '',drawings:state.drawings || [],bodySurface:{positions:bodyGeo.attributes.position.array,index:bodyGeo.index.array}});
  } finally {
    Object.assign(cur,oldCur); Object.assign(goal,oldGoal); glide=oldGlide; soloIds=oldSolo;
    applyCam(); syncDecals(); needsRender=true;
  }
}
function planningPreview() {
  shot(false);
  const preview=document.createElement('canvas'); const scale=Math.min(1,640/canvas.width,640/canvas.height);
  preview.width=Math.max(1,Math.round(canvas.width*scale));preview.height=Math.max(1,Math.round(canvas.height*scale));
  preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);
  return preview.toDataURL('image/jpeg',.8);
}
async function artistSheet() {
  const view = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = shot(false); });
  const c = document.createElement('canvas'); c.width = 1800; c.height = 1300; const g = c.getContext('2d');
  g.fillStyle = '#fbfaf8'; g.fillRect(0, 0, c.width, c.height);
  const bx = 50, by = 50, bw = 980, bh = 1200; const s = Math.max(bw / view.width, bh / view.height); const sw = bw / s, sh = bh / s;
  g.drawImage(view, (view.width - sw) / 2, (view.height - sh) / 2, sw, sh, bx, by, bw, bh);
  g.fillStyle = '#17181d'; g.font = '600 46px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText('Ink Atlas placement sheet', 1080, 104);
  g.font = '24px Figtree, system-ui, sans-serif'; g.fillStyle = '#5b6070';
  const inch = state.heightCm / 2.54; g.fillText(`${new Date().toLocaleDateString()}  ·  body height ${Math.floor(inch / 12)} ft ${Math.round(inch % 12)} in`, 1080, 146);
  let y = 200; const list = state.tattoos.filter((t) => !t.hidden).slice(0, 7);
  for (const t of list) {
    g.fillStyle = '#fff'; g.strokeStyle = '#dcd9d2'; g.lineWidth = 2; g.fillRect(1080, y, 130, 130); g.strokeRect(1080, y, 130, 130);
    const im = imgEls[t.img]; if (im) { const k = Math.min(114 / im.naturalWidth, 114 / im.naturalHeight); g.drawImage(im, 1145 - im.naturalWidth * k / 2, y + 65 - im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); }
    g.fillStyle = '#17181d'; g.font = '600 28px Figtree, system-ui, sans-serif'; g.fillText(t.name.slice(0, 30), 1236, y + 50);
    g.fillStyle = '#5b6070'; g.font = '23px Figtree, system-ui, sans-serif'; g.fillText(sizeText(t).replace(/\s+/g, ' '), 1236, y + 90);
    y += 152;
  }
  g.fillStyle = '#8a8f9c'; g.font = '20px Figtree, system-ui, sans-serif'; g.fillText('Sizes are approximate. Confirm scale on skin with your artist.', 1080, 1250);
  return c.toDataURL('image/png');
}
let previewFile = null;
function showPreview(url, filename, title) {
  previewFile = { url, filename }; $('#pvImg').src = url; $('#pvTitle').textContent = title;
  $('#pvSave').hidden = false;
  $('#pvNote').textContent = canShareFiles()
    ? 'Save opens the share sheet to send it or keep it in Files. You can also touch and hold the picture to copy or share it.'
    : 'Save downloads the picture. You can also touch and hold it to save, copy or share it.';
  toggle('#planMenu', false); toggle('#share', false); toggle('#preview', true);
}
async function saveFile(filename, data) {
  try {
    const r = await shareOrDownload(filename, data);
    if (r === 'shared') toast('Shared ' + filename);
    else if (r === 'downloaded') toast('Saved ' + filename + ' to your downloads');
  } catch (err) { toast('Could not save: ' + ((err && err.message) || 'something went wrong')); }
}
$('#pvSave').addEventListener('click', () => { if (previewFile) saveFile(previewFile.filename, dataUrlBlob(previewFile.url)); });
$('#cView').addEventListener('click', () => showPreview(shot(false), 'ink-atlas-view.png', 'Picture of this view'));
$('#cSheet').addEventListener('click', async () => showPreview(await artistSheet(), 'ink-atlas-artist-sheet.png', 'Artist sheet'));
$('#cPacket').addEventListener('click', () => { const html=artistPacket(); toggle('#share',false); saveFile('ink-atlas-artist-packet.html',new Blob([html],{type:'text/html'})); });
function bodySignature(){return JSON.stringify([state.figure,state.muscle,state.weight,Object.keys(state.fit||{}).sort().map(k=>[k,state.fit[k]]),state.genitals,state.heightCm]);}
async function sketchPatch() {
  cancelGesture();toggle('#share',false);
  let geometry;
  try {const {createPatchGuide,openPatchExchange}=await import('./procreate-patch.js');
    let pending=state.sketchPatch;
    if(!pending){const selected=sel();const choices=[{id:'view',name:'Current view',spot:viewCenterSpot(),width:.18}];
      if(selected)choices.unshift({id:'selected',name:'Selected tattoo area',spot:selected,width:selected.width,rot:selected.rot,wrap:selected.wrap});
      for(const [id,name,o,d,width] of [['chest','Front chest',[0,1.3,2],[0,0,-1],.22],['back','Upper back',[0,1.3,-2],[0,0,1],.22],['arm','Upper arm',[2,1.13,.04],[-1,0,0],.11],['forearm','Forearm',[2,.95,.04],[-1,0,0],.10],['thigh','Front thigh',[.1,.52,2],[0,0,-1],.16]])choices.push({id,name,spot:surfaceAt(new V3(...o),new V3(...d)),width});
      const {choosePatchArea}=await import('./procreate-patch.js');const id=await choosePatchArea(choices.map(c=>({id:c.id,name:c.name,disabled:!c.spot})));if(!id)return;const choice=choices.find(c=>c.id===id),spot=choice.spot;
      const patch={pos:[...spot.pos],normal:[...spot.normal],width:choice.width,aspect:1,rot:choice.rot || 0,wrap:choice.wrap || 0,bend:0,taper:0};
      const shape=bodySignature();
      geometry=decalGeometry(patch);
      const guide=await createPatchGuide({positions:geometry.attributes.position.array,uvs:Float32Array.from(geometry.attributes.uv.array,v=>(v-UV_MARGIN)/(1-2*UV_MARGIN)),label:choice.name,widthCm:patch.width*100*state.heightCm/175});
      const {makePatchReference}=await import('./patch-reference.js');const existingInk=makePatchReference(geometry,state.tattoos.filter(t=>t.status==='existing'&&!t.hidden).map(t=>decals[t.id]).filter(d=>d&&d.tex).map(d=>({geometry:d.mesh.geometry,texture:d.tex})),UV_MARGIN);
      pending={id:uid(),patch,shape,guide:guide.dataUrl,maskTriangles:guide.maskTriangles,existingInk};snapshot();state.sketchPatch=pending;commit();await flushSave();
    }
    const pendingId=pending.id;
    await openPatchExchange({guide:pending.guide,existingInk:pending.existingInk,maskTriangles:pending.maskTriangles,onDiscard:()=>{
      if(state.sketchPatch?.id!==pendingId)throw new Error('The pending patch changed. Reopen to review it.');snapshot();delete state.sketchPatch;commit();
    },onApply:async result=>{
      if(state.sketchPatch?.id!==pendingId)throw new Error('The pending patch changed. Reopen to review it.');
      if(bodySignature()!==pending.shape)throw new Error('The body changed. Restore its earlier shape, or discard this guide and create a fresh patch.');
      snapshot();const t=await addImage(result.dataUrl,'Procreate patch',pending.patch);if(!t)throw new Error('The returned artwork could not be added.');t.status='planned';selectedId=t.id;delete state.sketchPatch;commit();focusTattoo(t);toast('Returned artwork added as a new planned tattoo.');
    }});
  }catch(e){toast('Could not open sketch patch: '+e.message);}finally{geometry?.dispose();}
}
$('#cSketch').addEventListener('click',sketchPatch);
$('#cBlank').addEventListener('click', () => showPreview(shot(true), 'ink-atlas-blank-body.png', 'Blank body to sketch on'));
$('#cGlb').addEventListener('click',async()=>{
 toggle('#share',false);try{const {exportSceneGlb}=await import('./three-export.js');const result=await exportSceneGlb(previewInput());await saveFile('ink-atlas-neutral-model.glb',result.blob);}catch(e){toast('Could not export 3D model: '+e.message);}
});
$('#cObj').addEventListener('click',async()=>{toggle('#share',false);try{const {exportSceneObjPackage}=await import('./obj-export.js');const result=await exportSceneObjPackage(previewInput());await saveFile('ink-atlas-neutral-obj.zip',result.blob);}catch(e){toast('Could not export OBJ package: '+e.message);}});
// Tattoos painted into one skin texture on the body's own UVs (src/uv-bake.js).
async function exportPainted(kind) {
  toggle('#share', false);
  const visible = state.tattoos.filter((t) => !t.hidden && decals[t.id] && decals[t.id].tex);
  toast('Painting your tattoos onto the skin. This takes a few seconds.');
  try {
    syncDecals();
    const { exportPaintedModel } = await import('./uv-bake.js');
    const result = await exportPaintedModel({ THREE, renderer, bodyGeometry: bodyGeo, skinColor: skinMat.color, decals: visible.map((t) => ({ geometry: decals[t.id].mesh.geometry, material: decals[t.id].mesh.material })), state, kind });
    window.__lastPainted = { kind, bytes: result.blob.size, size: result.size, inked: result.inked };
    await saveFile(result.name, result.blob);
  } catch (e) { toast('Could not make the 3D model: ' + ((e && e.message) || 'something went wrong')); }
  finally { needsRender = true; }
}
// Back from Procreate: a painted model (USDZ, OBJ in a ZIP, or its skin picture) made
// from "3D model with your tattoos". New drawing on its skin becomes tattoos here.
const PAINT_SIZE = 2048;
async function importPainted(file, undoStep = true) {
  toggle('#share', false);
  if (file.size > 300e6) { toast('That file is too large to open here.'); return []; }
  toast('Looking for new drawing on the model. This takes a few seconds.');
  try {
    const P = await import('./procreate-import.js'), { bakeSkin, texturedBody } = await import('./uv-bake.js');
    const pic = await P.skinPictureOf(file), S = PAINT_SIZE;
    // The picture and the skin it is compared with are both shrunk the same way from the
    // picture's own size, so thin lines of the existing tattoos match exactly.
    const bmp = await createImageBitmap(pic), native = Math.max(256, Math.min(bmp.width, renderer.capabilities.maxTextureSize || 4096, 4096));
    const shrink = (src) => { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, S, S); return g.getImageData(0, 0, S, S).data; };
    const raw = shrink(bmp); bmp.close && bmp.close();
    const map = P.triangleMap(S), skin = P.skinColorOf(raw, null);
    syncDecals();
    const visible = state.tattoos.filter((t) => !t.hidden && decals[t.id] && decals[t.id].tex);
    const skinColor = new THREE.Color().setRGB(skin[0] / 255, skin[1] / 255, skin[2] / 255, THREE.SRGBColorSpace);
    const baked = bakeSkin({ THREE, renderer, bodyGeometry: bodyGeo, skinColor, decals: visible.map((t) => ({ geometry: decals[t.id].mesh.geometry, material: decals[t.id].mesh.material })), size: native });
    const full = document.createElement('canvas'); full.width = full.height = baked.size; full.getContext('2d').putImageData(new ImageData(baked.pixels, baked.size, baked.size), 0, 0);
    const baseline = shrink(full); full.width = full.height = 0;
    const pixels = P.uprightPixels(raw, baseline, map, S);
    const groups = P.findDrawings({ pixels, baseline, map, size: S, skin, positions: bodyGeo.attributes.position.array, normals: bodyGeo.attributes.normal.array, index: bodyGeo.index.array });
    if (!groups.length) { toast('No new drawing found on that model.'); return []; }
    const layer = document.createElement('canvas'); layer.width = layer.height = S; layer.getContext('2d').putImageData(P.paintLayer({ pixels, baseline, map, size: S, skin }), 0, 0);
    const paint = new THREE.CanvasTexture(layer); paint.colorSpace = THREE.SRGBColorSpace; paint.flipY = true;
    const geometry = texturedBody({ THREE, bodyGeometry: bodyGeo });
    const caster = new THREE.Raycaster(), restBody = new THREE.Mesh(bodyGeo), added = [];
    if (undoStep) snapshot();
    try {
      for (const grp of groups.slice(0, 12)) {
        const box = P.drawingBox(grp), n = new V3(...grp.normal);
        caster.set(new V3(...box.mid).addScaledVector(n, 0.05), n.clone().negate()); caster.far = 0.15;
        const hit = caster.intersectObject(restBody, false)[0], pos = hit ? hit.point.toArray() : grp.center;
        const shot = P.photographDrawing({ THREE, renderer, geometry, paint, center: pos, normal: grp.normal, box });
        const span = 1 - 2 * UV_MARGIN;
        const t = await addImage(shot.toDataURL('image/png'), 'From Procreate ' + (added.length + 1), { pos, normal: grp.normal, width: box.w / span, rot: 0, opacity: 1 });
        if (t) added.push(t);
      }
    } finally { paint.dispose(); geometry.dispose(); }
    if (!added.length) { commit(); return []; }
    selectedId = added[0].id; commit(); focusTattoo(added[0]);
    toast(added.length === 1 ? 'Added 1 new tattoo from the model.' : `Added ${added.length} new tattoos from the model.`);
    return added.map((t) => t.id);
  } catch (e) { toast('Could not read that model: ' + ((e && e.message) || 'something went wrong')); return []; }
  finally { needsRender = true; }
}
// Layered PSD for Procreate: this view with the body on one layer and each visible
// tattoo on its own layer above it (multiply, transparent around the ink), plus the
// flattened picture. Clothes, the floor shadow and the selection outline are left out.
// Each tattoo is drawn alone on white with the body hiding what is behind it, then white
// is turned into transparency, so the layers multiplied over the body give this view.
function inkToAlpha(px) {
  for (let o = 0; o < px.length; o += 4) {
    const r = px[o], g = px[o + 1], b = px[o + 2], a = 255 - Math.min(r, g, b);
    if (!a) { px[o] = px[o + 1] = px[o + 2] = px[o + 3] = 0; continue; }
    px[o] = 255 - Math.round((255 - r) * 255 / a); px[o + 1] = 255 - Math.round((255 - g) * 255 / a); px[o + 2] = 255 - Math.round((255 - b) * 255 / a); px[o + 3] = a;
  }
  return px;
}
async function exportLayers() {
  toggle('#share', false);
  const list = state.tattoos.filter((t) => !t.hidden && decals[t.id] && decals[t.id].tex && (!soloIds || soloIds.has(t.id))).slice(0, 60);
  const { writePsd, cropLayer } = await import('./psd.js');
  const inset = curInset, bg = scene.background, off = [];
  let layers, merged, W, H;
  try {
    curInset = 0; applyInset(); exporting = true; syncDecals();
    for (const m of [floorShadow]) if (m && m.visible) { m.visible = false; off.push(m); }
    W = canvas.width; H = canvas.height;
    const grab = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0); return g.getImageData(0, 0, W, H).data; };
    const render = (bodyColour = true) => clothes.bare(() => poseView.withPosed(() => { const m = body.material, cw = m.colorWrite; m.colorWrite = bodyColour; try { renderer.render(scene, camera); } finally { m.colorWrite = cw; } }, posedInk()));
    decalGroup.visible = true; render(); merged = grab();
    decalGroup.visible = false; render(); layers = [{ name: 'Body', rgba: grab() }];
    decalGroup.visible = true; scene.background = new THREE.Color(0xffffff);
    for (const t of list) {
      for (const [id, d] of Object.entries(decals)) { d.mesh.visible = id === t.id; d.outline.visible = false; }
      render(false);
      const { box, rgba } = cropLayer(inkToAlpha(grab()), W, H);
      if (box.bottom <= box.top) continue; // not seen from this side
      layers.push({ name: t.name || 'Tattoo', box, rgba, blend: 'mul ', opacity: 255 });
    }
  } catch (e) { toast('Could not make the layered file: ' + ((e && e.message) || 'something went wrong')); return null; }
  finally {
    scene.background = bg; for (const m of off) m.visible = true; decalGroup.visible = true;
    exporting = false; curInset = inset; applyInset(); syncDecals(); needsRender = true;
  }
  const blob = writePsd({ width: W, height: H, layers, merged });
  window.__lastPsd = { width: W, height: H, layers: layers.map((l) => l.name), bytes: blob.size };
  await saveFile('ink-atlas-layers.psd', blob);
  return blob;
}
// Print at real size: a PDF with each visible tattoo at its true size.
async function printRealSize() {
  toggle('#share', false);
  const list = state.tattoos.filter((t) => !t.hidden && imgEls[t.img]);
  if (!list.length) { toast('No visible tattoos to print.'); return; }
  try {
    const { pieceSize, layoutPrint, buildPrintPdf, sizeNote } = await import('./print-size.js');
    const pieces = [], art = {};
    for (const t of list) {
      const size = pieceSize(t, state.heightCm), im = imgEls[t.img];
      const name = t.name || 'Tattoo', note = sizeNote(size) + (t.status === 'existing' ? ', already on me' : '') + (t.flip ? ', mirrored as on the body' : '');
      // about 200 dots per inch, capped so a big back piece stays a sensible file
      const scale = Math.min(1, 3000 / Math.max(size.w, size.h) / (200 / 72)), cw = Math.max(1, Math.round(size.w / 72 * 200 * scale)), ch = Math.max(1, Math.round(size.h / 72 * 200 * scale));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
      if (t.flip) { g.translate(cw, 0); g.scale(-1, 1); }
      g.drawImage(im, 0, 0, cw, ch);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      art[t.id] = { name, note, jpeg: { width: cw, height: ch, data: new Uint8Array(await blob.arrayBuffer()) } };
      pieces.push({ id: t.id, w: size.w, h: size.h, labelW: (name.length + note.length + 2) * 4.6 });
    }
    const pdf = buildPrintPdf(layoutPrint(pieces), art, { title: (state.projectName || 'My tattoos') + ': real size' });
    window.__lastPrint = { bytes: pdf.length, pieces: pieces.map((p) => ({ id: p.id, w: p.w, h: p.h })) };
    await saveFile('ink-atlas-real-size.pdf', new Blob([pdf], { type: 'application/pdf' }));
  } catch (e) { toast('Could not make the print file: ' + ((e && e.message) || 'something went wrong')); }
}
$('#cPrint').addEventListener('click', printRealSize);
// Spin video: the whole body turning once, in the current pose, with visible ink.
let spinning = false;
async function spinVideo() {
  toggle('#share', false);
  if (spinning) return; spinning = true;
  toast('Making your spin video. Keep the app open for a few seconds.');
  let result = null;
  const oldCur = { ...cur }, oldGoal = { ...goal }, oldGlide = glide, inset = curInset;
  try {
    poseView.pause();
    const { makeSpinVideo } = await import('./spin-video.js');
    curInset = 0; applyInset(); exporting = true; syncDecals();
    const frames = 180;
    // Frame the body as it stands now (posed or not) so it fills the clip at every angle.
    if (poseView.active) poseView.ensure();
    const P = (poseView.active ? poseView.geometry : bodyGeo).attributes.position.array;
    let y0 = Infinity, y1 = -Infinity, reach = 0;
    for (let k = 0; k < P.length; k += 3) { y0 = Math.min(y0, P[k + 1]); y1 = Math.max(y1, P[k + 1]); reach = Math.max(reach, Math.hypot(P[k], P[k + 2] - 0.02)); }
    const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), span = Math.max((y1 - y0) * 1.1, reach * 2 * 1.1 / 0.75);
    result = await makeSpinVideo({ width: 720, height: 960, fps: 30, frames, draw: (i, g) => {
      Object.assign(goal, { theta: Math.PI * 2 * i / frames, phi: 1.5, roll: 0, tx: 0, ty: (y0 + y1) / 2, tz: 0.02, r: span / Math.min(1, canvas.width / (canvas.height * 0.75)) / (2 * tn) + reach });
      glide = false; Object.assign(cur, goal); applyCam();
      poseView.withPosed(() => renderer.render(scene, camera), posedInk());
      // the largest 3:4 window in the middle of the picture
      const cw = canvas.width, ch = canvas.height, w = Math.min(cw, ch * 0.75), h = w / 0.75;
      g.drawImage(canvas, (cw - w) / 2, (ch - h) / 2, w, h, 0, 0, 720, 960);
    } });
    window.__lastSpin = { bytes: result.blob.size, codec: result.codec, name: result.name };
  } catch (e) { toast('Could not make the video: ' + ((e && e.message) || 'something went wrong')); }
  finally {
    exporting = false; Object.assign(cur, oldCur); Object.assign(goal, oldGoal); glide = oldGlide; curInset = inset; applyInset(); applyCam(); syncDecals(); needsRender = true; spinning = false;
  }
  if (result) await saveFile(result.name, result.blob);
}
$('#cSpin').addEventListener('click', spinVideo);
$('#cUsdz').addEventListener('click', () => exportPainted('usdz'));
$('#cPsd').addEventListener('click', () => exportLayers());
$('#cPainted').addEventListener('click', () => { toggle('#share', false); $('#paintedFile').click(); });
$('#paintedFile').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await importPainted(f); });
$('#cObjBaked').addEventListener('click', () => exportPainted('obj'));
$('#cModelOpen').addEventListener('click',()=>$('#modelFile').click());
$('#modelFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;toggle('#share',false);try{if(file.size>25*1024*1024)throw new Error('Use a GLB under 25 MiB.');const {openModelPreview}=await import('./model-preview.js');await openModelPreview({THREE,buffer:await file.arrayBuffer(),name:file.name});}catch(e){toast('Could not preview model: '+e.message);}});
$('#cV47Source').addEventListener('click',()=>{const source=state.v47Source;if(source)saveFile('ink-atlas-original-import.ink.json',JSON.stringify({format:'ink-atlas-portable',project:source.project,assets:source.assets}));});
$('#cV47').addEventListener('click',async()=>{
 toggle('#share',false);try{const {exportV47Project}=await import('./v47-export.js');const bundle=exportV47Project({state,images:usedImages(),savedAt:new Date().toISOString()});
 const host=el('section',{class:'scrim',id:'v47Export',role:'dialog','aria-modal':'true','aria-label':'Original v47 compatibility export'});host.style.zIndex=10000;
 const panel=el('div',{class:'modal glass'},el('h2',{text:'Original v47 compatibility export'}),el('p',{text:'Not a lossless or visually identical round trip. Keep the full rebuild backup. The original app has not been runtime-tested with this export.'}));
 const details=el('details',{},el('summary',{text:'What carries across and what stays in the backup'}));const list=el('ul');for(const text of bundle.report.limitations||[])list.append(el('li',{text}));details.append(list);panel.append(details);
 panel.append(el('button',{class:'btn',text:'Save full rebuild backup',onclick:()=>saveFile('ink-atlas-full-rebuild-backup.json',JSON.stringify(bundle.rebuildBackup))}),el('button',{class:'btn',text:'Save v47 compatibility copy',onclick:()=>saveFile('ink-atlas-v47-compatibility.ink.json',JSON.stringify(bundle.portable))}),el('button',{class:'btn',text:'Close',onclick:()=>host.remove()}));host.append(panel);$('#viewport').append(host);host.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')host.remove();});
 }catch(e){toast('v47 export stopped safely: '+e.message);}
});
function backupNow() { const d = new Date(), p2 = (n) => String(n).padStart(2, '0'); saveFile(`ink-atlas-backup-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`, JSON.stringify({ app: 'ink-atlas-proto', v: 2, savedAt: d.toISOString(), state, images: usedImages() })); }
$('#cBackup').addEventListener('click', () => { toggle('#share', false); backupNow(); });
/* ---------- earlier saves ---------- */
function renderRecovery() {
  const host = $('#rcList'), list = store && store.ok ? store.listRecovery() : []; host.replaceChildren();
  if (!list.length) { host.append(el('p', { class: 'tip', text: store && store.ok ? 'No earlier saves yet. Copies are kept as you work.' : 'Storage is off in this view, so no copies are kept.' })); return; }
  for (const r of list) host.append(el('button', { class: 'card slim', type: 'button', onclick: () => restoreRecovery(r.id) }, el('b', { text: whenText(r.at) }), el('span', { text: `${r.tattoos} tattoo${r.tattoos === 1 ? '' : 's'} · ${r.reason}` })));
}
async function restoreRecovery(id) {
  toggle('#recover', false);
  let rec = null; try { rec = await store.loadRecovery(id); } catch (e) { rec = null; }
  if (!rec) { toast('That copy is no longer available.'); return; }
  snapshot(); const before = JSON.stringify(state);
  await keepRecovery('Before going back');
  try { await openProject(rec.state, rec.images); commit(); fullBody(); toast('Went back to the earlier save', 'Undo', undo); }
  catch (e) { undoStack.pop(); refreshUndo(); state = JSON.parse(before); skinMat.color.set(skinColor()); applyShape(); syncDecals(); renderUI(); toast('That copy could not be opened, so nothing was changed.'); }
}
$('#cRecover').addEventListener('click', () => { toggle('#share', false); renderRecovery(); toggle('#recover', true); });
$('#cRestore').addEventListener('click', () => { toggle('#share', false); $('#file').click(); });

/* ---------- backup import (this app's files and older Ink Atlas .ink.json) ---------- */
function nearestSurface(p) {
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array, end = vertEnd(); let best = -1, bd = Infinity;
  for (let i = 0; i < end; i += 3) { const d = (P[i] - p[0]) ** 2 + (P[i + 1] - p[1]) ** 2 + (P[i + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
  return { pos: [P[best], P[best + 1], P[best + 2]], normal: [N[best], N[best + 1], N[best + 2]], dist: Math.sqrt(bd) };
}
async function importBackup(text) {
  let data; try { data = JSON.parse(text); } catch (e) { toast('That file is not a project backup.'); return; }
  if (data && data.app === 'ink-atlas-proto' && data.state) {
    const before = JSON.stringify(state);
    await keepRecovery('Before opening a backup');
    try {
      const r = await openProject(data.state, data.images);
      commit(); fullBody();
      toast(r.dropped ? `Project opened. ${r.dropped} piece${r.dropped === 1 ? ' had no usable artwork and was' : 's had no usable artwork and were'} left out.` : 'Project opened', 'Undo', undo);
    } catch (e) { state = JSON.parse(before); skinMat.color.set(skinColor()); applyShape(); syncDecals(); renderUI(); toast('That backup is damaged, so nothing was changed.'); }
    return;
  }
  const proj = data && data.format === 'ink-atlas-portable' ? data.project : (data && data.version === 1 && Array.isArray(data.tattoos) ? data : null);
  if (proj && Array.isArray(proj.tattoos)) { await importInkJson(proj, Array.isArray(data.assets) ? data.assets : []); return; }
  const found = []; const seen = new Set();
  (function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 12) return;
    if (!Array.isArray(o)) { for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string' && v.startsWith('data:image') && !seen.has(v)) { seen.add(v); found.push({ src: v, o }); break; } } }
    for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v, depth + 1);
  })(data, 0);
  if (!found.length) { toast('No artwork found in that file.'); return; }
  let n = 0, placed = 0;
  for (const f of found.slice(0, 40)) {
    let place = null; const p = f.o.position;
    if (Array.isArray(p) && p.length === 3 && p.every((x) => typeof x === 'number')) { const s = nearestSurface(p); if (s.dist < 0.25) { place = { pos: s.pos, normal: s.normal }; placed++; } }
    if (place && typeof f.o.width === 'number' && f.o.width > 0.01 && f.o.width < 1) place.width = f.o.width;
    if (place && typeof f.o.opacity === 'number') place.opacity = f.o.opacity;
    const t = await addImage(f.src, (typeof f.o.name === 'string' && f.o.name.slice(0, 40)) || 'Imported tattoo', place); if (t) n++;
  }
  commit(); fullBody(); toast(`Imported ${n} piece${n === 1 ? '' : 's'}${placed < n ? '. Some need placing by hand.' : '. Check the placements.'}`);
}

const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const ok3 = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => fin(x) && Math.abs(x) < 10);
// Opening an older Ink Atlas backup replaces the project, so keep a copy first and put
// everything back if the file turns out to be unusable part way through.
async function importInkJson(proj, assets) {
  const before = JSON.stringify(state);
  await keepRecovery('Before opening a backup');
  try { await readInkJson(proj, assets); }
  catch (e) { state = JSON.parse(before); selectedId = null; skinMat.color.set(skinColor()); applyShape(); commit(); toast('Could not open v47 backup: '+e.message+'. Current project unchanged.'); }
}
async function readInkJson(proj, assets) {
 const {importV47Project}=await import('./v47-import.js');const result=importV47Project({project:proj,assets});
 await openProject(result.state,result.images);commit();fullBody();
 toast(`Opened ${state.projectName||'v47 project'}: ${state.tattoos.length} placed, ${result.report.unplaced||0} saved to place. Original source kept; some metadata is archive-only.`, 'Undo',undo);
}
// Bring a loaded project up to the current body model without moving any ink:
// rebuild the exact shape it was saved on, pin every tattoo to its triangle, then
// switch to today's shape. Saves from before body types sit on the base mesh; v1
// saves sit on the first prototype's muscle / weight blend.
function adoptState() {
  const old = !state.figure ? legacyPositions() : (state.v || 1) < 2 ? shapePositionsV1(state.figure, state.muscle, state.weight) : null;
  if (!old) { state.fit = state.fit || {}; applyShape(); return; }
  setBodyPositions(old, false); const an = anchorsNow();
  if (!state.figure) { state.figure = 'male'; state.muscle = 0.6; state.weight = 0.5; }
  else { state.muscle = 0.5 + 0.5 * THREE.MathUtils.clamp(state.muscle || 0, 0, 1); state.weight = 0.5 + 0.5 * THREE.MathUtils.clamp(state.weight || 0, -1, 1); }
  state.fit = {}; state.genitals = true; state.v = 2;
  applyShape(); applyAnchors(an);
}
/* ---------- loop ---------- */
let last = performance.now();
let camMoving = false, booted = false;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (inkDirty) { inkDirty = false; syncDecals(); const t = sel(); if (t) $('#size').textContent = sizeText(t); }
  if (Math.abs(goalInset - curInset) > 0.5) { curInset += (goalInset - curInset) * (1 - Math.exp(-dt * 12)); if (Math.abs(goalInset - curInset) <= 0.5) curInset = goalInset; applyInset(); needsRender = true; }
  const moving = stepCam(dt); camMoving = moving;
  if (moving || needsRender) { needsRender = false; drawFrame(); if(liveGuidePlan)drawLiveGuides(); }
  requestAnimationFrame(tick);
}

/* ---------- boot ---------- */
(async function boot() {
  store = await openStore();
  let opened = false, note = '';
  if (store.ok) {
    let loaded = null;
    try { loaded = await store.load(); } catch (e) { note = 'The save on this device could not be read, so a fresh project was started.'; }
    if (loaded) {
      try {
        const r = await openProject(loaded.state, loaded.images); opened = true;
        // The copy is of the save exactly as it was stored, before any upgrade or repair.
        await store.addRecovery(loaded.state, loaded.images, 'When you opened the app').catch(() => false);
        if (r.dropped || r.replaced) { await store.quarantine(loaded.raw, loaded.images); note = r.dropped ? `${r.dropped} piece${r.dropped === 1 ? '' : 's'} in your save had no usable artwork. The original save was kept on this device.` : 'Some ink had lost its place and was put back on the body. Check the placements.'; }
      } catch (e) {
        await store.quarantine(loaded.raw, loaded.images);
        for (const r of store.listRecovery()) {
          try { const rec = await store.loadRecovery(r.id); if (!rec) continue; await openProject(rec.state, rec.images); opened = true; note = `Your last save could not be opened, so this is the copy from ${whenText(r.at)}.`; break; } catch (_) { /* try the next copy */ }
        }
        if (!opened) note = 'Your last save could not be opened. It was kept on this device and a fresh project was started.';
      }
    }
  }
  if (!opened) { state = freshState(); selectedId = null; applyShape(); await seedSamples(); }
  skinMat.color.set(skinColor());
  syncDecals(); renderUI();
  if (store.ok) { save(); store.gc(Object.keys(usedImages())).catch(() => 0); } else setSaved('Not saved: storage is off in this view', true);
  if (note) toast(note);
  let seen = false; try { seen = localStorage.getItem('ia-coach') === '1'; } catch (e) { /* no storage */ }
  $('#coach').hidden = seen;
  $('#coachOk').addEventListener('click', () => { $('#coach').hidden = true; try { localStorage.setItem('ia-coach', '1'); } catch (e) { /* no storage */ } });
  booted = true;
  requestAnimationFrame(tick);
})();
// Test hooks for tools/tests. loadState runs the same upgrade path a saved project takes on open.
window.__ink = {
  state: () => state, ready: () => booted,
  beforeAfter: () => ({ on: beforeAfter.on, split: beforeAfter.split }),
  clothes: () => ({ ...clothes.choice, report: clothesReport(), meshes: clothes.meshes().map((m) => ({ visible: m.visible, tris: m.geometry.index ? m.geometry.index.count / 3 : 0 })) }), setClothes: (next) => setClothes(next), clothesBounds: () => { clothes.sync(shapeKey, poseView.version); const [top, bottom, hair] = clothes.meshes().map((m) => { const g = m.geometry; if (!g.index) return null; const P = g.attributes.position.array, I = g.index.array, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const v of I) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[v * 3 + k]); max[k] = Math.max(max[k], P[v * 3 + k]); } return { min, max }; }); return { top, bottom, hair }; },
  pose: () => ({ active: poseView.active, key: poseView.key, settled: poseView.settled(), ...poseView.motion }), setPose: (k) => { poseView.choose(k); renderPose(); }, setPoseRotations: (r) => { poseView.setCustom(r, { animate: false }); renderPose(); }, scrubMotion: (kind, phase) => { poseView.scrub(phase, kind); renderPose(); }, viewSpot: (id) => viewSpot(state.tattoos.find((t) => t.id === id)), hitBody: (x, y) => { const h = hitBody(x, y); return h && { point: h.point.toArray(), normal: h.normal.toArray(), faceIndex: h.faceIndex }; }, posedGeometry: () => poseView.geometry, setBeforeAfterSplit: (v) => beforeAfter.setSplit(v),
  pixelAt: (x, y) => { drawFrame(); const gl = renderer.getContext(), r = renderer.getPixelRatio(), out = new Uint8Array(4); gl.readPixels(Math.round(x * r), Math.round(canvas.height - y * r - 1), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out); return [...out]; }, updateReady: onUpdateReady, updatePending: () => updateReady, settled: () => booted && !camMoving && Math.abs(goalInset - curInset) <= 0.5, inkIdsAt, selected:()=>selectedId, cur, goal, importBackup, importPainted, tapPlace:()=>tapPlaceId, liveGuides:()=>liveGuidePlan?{...structuredClone(liveGuidePlan),snapped:guideSnapApplied}:null, cameraUp:()=>camera.up.toArray(), cameraQuaternion:()=>camera.quaternion.toArray(), projectPoint:p=>screenOf(new V3(...p)),
  setShape: (patch) => { reshape(() => { Object.assign(state, patch); }); commit(); },
  loadState: (s) => { state = s; selectedId = null; skinMat.color.set(skinColor()); adoptState(); commit(); },
  positions: () => bodyGeo.attributes.position.array, v1Positions: shapePositionsV1,
  store: () => store, flush: flushSave, undo, saved: () => ({ dirty, saving, text: $('#saved').textContent }),
  surfaceAt: (o, d) => surfaceAt(new V3(...o), new V3(...d)), addArt: (url, name, place) => addImage(url, name, place), commitTest: commit,
  decalReach: () => state.tattoos.map((t) => { const d = decals[t.id], g = d && d.mesh.geometry, P = g && g.attributes.position ? g.attributes.position.array : []; let max = 0; for (let i = 0; i < P.length; i += 3) { const dist = Math.hypot(P[i] - t.pos[0], P[i + 1] - t.pos[1], P[i + 2] - t.pos[2]); if (dist > max) max = dist; } return { name: t.name, tris: P.length / 9, max, w: t.width, h: t.width / t.aspect }; }),
};
