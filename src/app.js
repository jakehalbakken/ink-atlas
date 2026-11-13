import { visibleInkAt, rankedInkHits, cycleInkHit } from './ink-picking.js';
import * as THREE from 'three';
import { INDEX, INDEX_ALL, COUNTS, shapePositions, shapePositionsV1, legacyPositions } from './mesh.js';
import { FIT_GROUPS, fitVisible, fitFromV47 } from './fit.js';
import { createSkin, updateSkin } from './skin.js';
import { buildAdjacency, buildDecal, UV_MARGIN } from './decal.js';
import './slider.js';
import {twoPointerDelta,twoFingerIntent,wrapAngle,planTapPlacement} from './view-gestures.js';
import {findLiveAlignment} from './live-alignment.js';
import { editArtwork } from './cleanup.js';
import { applyArtworkRevision } from './cleanup-links.js';
import { readPending, writePending, editFileName, artworkAsSeen, clipboardImage, normalisePicture } from './procreate-edit.js';
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
import { AGES, ageInk } from './aging.js';
import { skinSet, inkColours, swatchesFile } from './swatches.js';
import { GUIDE_SIZE, areaExtent, drawGuide, inkBox, clearShare } from './procreate-draw.js';
import { patchMaskTriangles } from './procreate-patch.js';
import { makePatchReference } from './patch-reference.js';
import { toneColour, nearestTone, sampleSkin, skinCheck } from './skin-tone.js';
import { LIGHTS, readLight, writeLight, applyLight } from './lighting.js';
import { NEW_FEATURES, readTried, writeTried, untriedCount, ordered } from './whats-new.js';
import { curvedArt, compose, pinch } from './try-on.js';
import { SPOTS, spotAim, turnAlong } from './spots.js';
import { POSE_BONES } from './pose.js';

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
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a4652, 1.15); scene.add(hemi);
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
  updateSkin(bodyGeo, skinU, (0.0155 + 0.006 * fem) * (1 + 0.35 * ((state.fit && state.fit.nippleSize) || 0)), state);
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
  const bounds=canvas.getBoundingClientRect(),{top,bottom,left,right}=freeArea();
  const available=THREE.MathUtils.clamp((bottom-top)/Math.max(1,bounds.height),.18,1),availableW=THREE.MathUtils.clamp((right-left)/Math.max(1,bounds.width),.18,1);
  goal.r = THREE.MathUtils.clamp(ext / (2 * tn * Math.min(available, camera.aspect * availableW)), 0.45, 3.2);
  const shiftFrac=THREE.MathUtils.clamp(.5-((top+bottom)/2-bounds.top)/Math.max(1,bounds.height),-.2,.4),shift=2*goal.r*tn*shiftFrac;
  const sideFrac=THREE.MathUtils.clamp(((left+right)/2-bounds.left)/Math.max(1,bounds.width)-.5,-.3,.3),side=2*goal.r*tn*camera.aspect*sideFrac;
  // Move the aim point in camera-screen up, including view roll, so the selected
  // artwork lands in the measured unobscured area rather than behind the dock.
  const st=Math.sin(goal.theta),ct=Math.cos(goal.theta),sp=Math.sin(goal.phi),cp=Math.cos(goal.phi),sr=Math.sin(goal.roll||0),cr=Math.cos(goal.roll||0);
  const up=new V3(-cp*st*cr-ct*sr,sp*cr,-cp*ct*cr+st*sr);
  const rt=new V3(ct*cr-cp*st*sr,sp*sr,-st*cr-cp*ct*sr);
  goal.tx=spot.pos[0]-up.x*shift-rt.x*side;goal.ty=spot.pos[1]-up.y*shift-rt.y*side;goal.tz=spot.pos[2]-up.z*shift-rt.z*side;
  glide = true; needsRender = true;
}
// The part of the screen that no panel covers: below the top bar, above (or left of) the dock.
function freeArea() {
  const b = canvas.getBoundingClientRect(), d = $('#dock').getBoundingClientRect();
  const top = Math.max(b.top, $('#top').getBoundingClientRect().bottom, $('#views').getBoundingClientRect().bottom) + 12;
  const side = d.height > b.height * 0.5 && d.left > b.left + b.width * 0.4; // the panel stands at the right in landscape
  const firstShown = [...$('#dock').children].map((n) => n.getBoundingClientRect()).filter((r) => r.height > 0);
  const dockTop = firstShown.length ? Math.min(...firstShown.map((r) => r.top)) : b.bottom;
  const bottom = side ? b.bottom - 12 : Math.max(top + 80, Math.min(b.bottom - 12, dockTop - 14));
  const right = side ? d.left + 4 : b.right - 12;
  // a panel open at the left (Try other spots) takes that side too
  const sp = $('#spotPop'), spr = sp.hidden ? null : sp.getBoundingClientRect();
  const left = spr && spr.right < right - 240 ? spr.right + 12 : b.left + 12;
  return { top, bottom, left, right };
}
// Already in sight: on screen above the bottom panels, below the top bar, and facing us.
function inSight(t) {
  const spot = viewSpot(t), b = canvas.getBoundingClientRect(), p = screenOf(new V3(...spot.pos));
  const toCam = camera.position.clone().sub(new V3(...spot.pos)).normalize();
  if (new V3(...spot.normal).dot(toCam) < 0.25) return false;
  const f = freeArea();
  return p.x > f.left && p.x < f.right && p.y > f.top && p.y < f.bottom;
}
// After a tap opens the edit panel over the very tattoo you tapped, slide the picture just far
// enough to clear the panel. Same zoom, same angle: only a small shift, and only when covered.
function keepClearOfPanels(t) {
  const spot = viewSpot(t), p = screenOf(new V3(...spot.pos)), f = freeArea(), m = 40;
  const toCam = camera.position.clone().sub(new V3(...spot.pos)).normalize();
  if (new V3(...spot.normal).dot(toCam) < 0.1) return;
  let dx = 0, dy = 0;
  if (p.y > f.bottom - m) dy = f.bottom - m - p.y; else if (p.y < f.top + m) dy = f.top + m - p.y;
  if (p.x > f.right - m) dx = f.right - m - p.x; else if (p.x < f.left + m) dx = f.left + m - p.x;
  if (!dx && !dy) return;
  const k = (2 * cur.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / canvas.getBoundingClientRect().height;
  const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0), up = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
  const mx = -dx * k, my = dy * k;
  goal.tx += right.x * mx + up.x * my; goal.ty += right.y * mx + up.y * my; goal.tz += right.z * mx + up.z * my;
  glide = true; needsRender = true;
}
// Tapping a tattoo keeps your view. Only when it is out of sight (picked from the tray or the
// layers list while looking elsewhere) does the camera go and find it.
function revealTattoo(t) { if (!inSight(t)) focusTattoo(t); }
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
  if (im && agingYears > 0) {
    // the ink as it would look after this many years (only for looking)
    const mm = t.width * 1000 * (state.heightCm || 175) / 175, d = g.getImageData(0, 0, c.width, c.height);
    ageInk(d.data, c.width, c.height, agingYears, (c.width * (1 - 2 * UV_MARGIN)) / Math.max(1, mm)); g.putImageData(d, 0, 0);
  }
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
let agingYears = 0; // view only: how the ink looks after this many years
function texKeyOf(t) { return [t.img, t.imageTopDown ? 1 : 0, t.flip ? 1 : 0, (t.opacity ?? 0.92).toFixed(2), t.aspect.toFixed(3), agingYears ? agingYears + ':' + (t.width * (state.heightCm || 175)).toFixed(2) : 0].join('|'); }
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
let tried = readTried(); // features from New to try that were tried on this device
let skinOwnOpen = false, skinSlide = false; // the own-tone sliders: open, and mid-drag
const sel = () => state.tattoos.find((t) => t.id === selectedId) || null;
function select(id, focus) { if(selectedId!==id)$('#editorAdvanced').open=false;if(tapPlaceId!==id)tapPlaceId=null; selectedId = id; const t = sel(); syncDecals(); renderUI(); if (t && focus) requestAnimationFrame(() => { if (sel() === t && !gest) revealTattoo(t); }); }
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
// While a finger is moving the body or a tattoo, the panels and buttons fade almost away so
// they never hide what you are looking at, and come back when the finger lifts.
let handsOnTimer = 0;
function handsOn(on) { clearTimeout(handsOnTimer); if (on) document.body.classList.add('hands-on'); else handsOnTimer = setTimeout(() => { document.body.classList.remove("hands-on"); needsRender = true; }, 120); }
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
  clearLiveGuides(); if (!$('#lookMenu').hidden) showLook(false);
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 1) {
    const t = sel();
    const onInk = onSelectedInk(e.clientX, e.clientY);
    const sc = t ? screenOf(new V3(...viewSpot(t).pos)) : { x: 0, y: 0 };
    if (onInk && poseView.motion.playing) poseView.pause(); // hold the pose still while the ink moves
    if (paint && hitBody(e.clientX, e.clientY)) { gest = { mode: 'paint', sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, t0: performance.now(), moved: true, snap: false, type: e.pointerType, dab: new Set() }; paintAt(e.clientX, e.clientY, gest.dab); return; }
    gest = { mode: onInk ? 'ink' : 'cam', sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, t0: performance.now(), moved: false, snap: false, ox: e.clientX - sc.x, oy: e.clientY - sc.y, type: e.pointerType };
  } else if (pts.size === 2 && gest) {
    const s = two();
    // two fingers that land together are a pan or zoom, not paint: take back the first finger's dab
    if (gest.mode === 'paint') { if (paint && gest.dab && !gest.stroked && performance.now() - gest.t0 < 400) { for (const t of gest.dab) paint.tris.delete(t); showPaint(); } gest.mode = 'cam'; }
    // Fingers that land together arrive in no fixed order, so "two fingers starting on it"
    // must not depend on which one the browser reports first: if the first finger has not
    // moved yet and the second one lands on the selected tattoo, it is a resize/turn of it.
    if (gest.mode === 'cam' && !gest.moved && performance.now() - gest.t0 < 350 && onSelectedInk(e.clientX, e.clientY)) gest.mode = 'ink';
    gest.moved = true; gest.hadTwo = true; handsOn(true); gest.intent = null; gest.pd = s.d; gest.pa = s.ang; gest.pcx = s.cx; gest.pcy = s.cy;
    const t = sel(); if (gest.mode === 'ink' && t) { gest.w0 = t.width; gest.r0 = t.rot; gest.d0 = s.d; gest.a0 = s.ang; if (!gest.snap) { snapshot(); gest.snap = true; } }
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId); if (!p || !gest) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pts.size === 1) {
    const dx = e.clientX - gest.px, dy = e.clientY - gest.py; gest.px = e.clientX; gest.py = e.clientY;
    if (gest.hadTwo) return; // the finger left behind after a pinch or pan must not jerk the view or the ink
    if (gest.mode === 'paint') { gest.stroked = gest.stroked || Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 12; paintAt(e.clientX, e.clientY, gest.stroked ? null : gest.dab); return; }
    if (!gest.moved && Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) < (gest.type === 'mouse' ? 4 : 9)) return;
    if (!gest.moved) handsOn(true);
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
    const raw=twoPointerDelta({distance:gest.pd,angle:gest.pa,cx:gest.pcx,cy:gest.pcy},{distance:s.d,angle:s.ang,cx:s.cx,cy:s.cy});
    const delta=(gest.intent||=twoFingerIntent()).step(raw);
    if (gest.mode === 'ink' && sel()) {
      const t = sel(); t.width = THREE.MathUtils.clamp(gest.w0 * (s.d / gest.d0), 0.012, 0.9);
      let da = s.ang - gest.a0; da = Math.atan2(Math.sin(da), Math.cos(da)); t.rot = gest.r0 - da; inkDirty = true;
    } else {
      glide = false; if (!tried.has('pan')) markTried('pan'); goal.r = THREE.MathUtils.clamp(goal.r * delta.zoomRatio, 0.22, 7);
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
  const g = gest; gest = null; handsOn(false);
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
  const g = gest; gest = null; handsOn(false);
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
  if(id){lastInkTap={ids,id,x,y,time:now};select(id,false);requestAnimationFrame(()=>{const t=sel();if(t&&t.id===id&&!gest)keepClearOfPanels(t);});lastTap={t:0,x,y,empty:false};return;}
  lastInkTap=null;
  const dbl = lastTap.empty && now - lastTap.t < 380 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40;
  lastTap = { t: now, x, y, empty: true };
  if (dbl) { fullBody(); lastTap.t = 0; }
  if (selectedId) select(null);
}
let inkDirty = false;
/* ---------- on-canvas handles ---------- */
// Two small handles on the selected tattoo, for one finger or the Apple Pencil: the corner
// one resizes, the round one above turns it. They sit on the tattoo's own corners, so they
// turn with it. Everything else keeps the usual gestures; the handles are just one more way.
const handleBox = $('#handles'), hSize = $('#hSize'), hTurn = $('#hTurn');
let handleDrag = null;
function handleSpots(t) {
  const spot = viewSpot(t), f = frameOf({ ...t, normal: spot.normal }), c = new V3(...spot.pos);
  const hw = t.width / 2, hh = t.width / t.aspect / 2;
  const toCam = camera.position.clone().sub(c).normalize();
  if (f.n.dot(toCam) < 0.15) return null; // facing away: nothing sensible to grab
  const cs = screenOf(c), corner = screenOf(c.clone().addScaledVector(f.right, hw).addScaledVector(f.up, -hh)), top = screenOf(c.clone().addScaledVector(f.up, hh));
  const ux = top.x - cs.x, uy = top.y - cs.y, ul = Math.hypot(ux, uy) || 1;
  // keep the corner handle clear of the middle on tiny tattoos, so a drag on the ink still moves it
  const cx = corner.x - cs.x, cy = corner.y - cs.y, cl = Math.hypot(cx, cy) || 1, cmin = 34;
  return { c: cs, size: cl < cmin ? { x: cs.x + cx / cl * cmin, y: cs.y + cy / cl * cmin } : corner, turn: { x: top.x + ux / ul * 34, y: top.y + uy / ul * 34 } };
}
function placeHandles() {
  const t = sel();
  const show = !!t && !t.locked && !t.hidden && t.status !== 'existing' && !tapPlaceId && !beforeAfter.on && !(gest && gest.mode === 'cam' && gest.moved);
  const s = show ? handleSpots(t) : null;
  if (!s) { if (!handleDrag) handleBox.hidden = true; return; }
  const r = canvas.getBoundingClientRect(), inView = (p) => p.x > r.left + 8 && p.x < r.right - 8 && p.y > r.top + 8 && p.y < r.bottom - 8;
  handleBox.hidden = false;
  for (const [b, p] of [[hSize, s.size], [hTurn, s.turn]]) { b.style.left = p.x + 'px'; b.style.top = p.y + 'px'; b.hidden = !inView(p); }
}
for (const [b, kind] of [[hSize, 'size'], [hTurn, 'turn']]) {
  b.addEventListener('pointerdown', (e) => {
    const t = sel(); if (!t || t.locked || handleDrag) return;
    e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const s = handleSpots(t); if (!s) return; markTried('handles');
    if (poseView.motion.playing) poseView.pause();
    handleDrag = { id: e.pointerId, kind, c: s.c, d0: Math.hypot(e.clientX - s.c.x, e.clientY - s.c.y) || 1, a0: Math.atan2(e.clientY - s.c.y, e.clientX - s.c.x), w0: t.width, r0: t.rot || 0, snap: false };
    b.classList.add('on');
  });
  b.addEventListener('pointermove', (e) => {
    const g = handleDrag, t = sel(); if (!g || g.id !== e.pointerId || !t) return;
    if (!g.snap) { snapshot(); g.snap = true; }
    if (g.kind === 'size') t.width = THREE.MathUtils.clamp(g.w0 * Math.hypot(e.clientX - g.c.x, e.clientY - g.c.y) / g.d0, 0.012, 0.9);
    else {
      let da = Math.atan2(e.clientY - g.c.y, e.clientX - g.c.x) - g.a0; da = Math.atan2(Math.sin(da), Math.cos(da));
      let r = wrapAngle(g.r0 - da); const q = Math.round(r / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(r - q) < 0.05) r = wrapAngle(q); // settle on straight
      t.rot = r; $('#rTurn').value = Math.round(r * 180 / Math.PI);
    }
    inkDirty = true; needsRender = true;
  });
  const end = (e) => { const g = handleDrag; if (!g || g.id !== e.pointerId) return; handleDrag = null; b.classList.remove('on'); if (g.snap) commit(); needsRender = true; };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('lostpointercapture', end);
}

/* ---------- UI ---------- */
function el(tag, props = {}, ...kids) { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); } for (const c of kids) if (c) n.append(c); return n; }
function renderTray() {
  const tray = $('#trayItems'); tray.replaceChildren();
  for (const t of state.tattoos) {
    const b = el('button', { class: 'chip' + (t.id === selectedId ? ' on' : '') + (t.hidden ? ' off' : ''), type: 'button', 'aria-label': 'Select ' + t.name, 'aria-pressed': t.id === selectedId ? 'true' : 'false', onclick: () => { if (t.id === selectedId) focusTattoo(t); else select(t.id, true); } },
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
  for (const id of ['rSize','rTurn','rFade','rWrap','rBend','rTaper','bFlip','bFlipVertical','bDraft','bCleanup','bProcreate','bDel','exactWidth','resetTransform']) $('#'+id).toggleAttribute('disabled', !!t.locked);
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
  $('#moveTip').textContent = tapPlaceId?'Tap a spot on the body to place this tattoo. Drag or pinch to adjust the view first.':t.status==='existing'?'Existing ink stays in place. Change to Planned before moving it.':t.locked?'Locked. Unlock to move it.':'Drag the tattoo to move it. Drag the corner to resize, the dot above to turn. Two fingers on it do both.';
}
function renderBody() {
  const sw = $('#skins'); sw.replaceChildren();
  SKINS.forEach((c, i) => sw.append(el('button', { class: 'sw' + (i === state.skin && !state.skinHex ? ' on' : ''), type: 'button', style: `background:${c}`, 'aria-label': 'Skin tone ' + (i + 1), onclick: () => { snapshot(); state.skin = i; state.skinHex = null; skinOwnOpen = false; skinMat.color.set(c); needsRender = true; renderBody(); save(); refreshUndo(); } })));
  // your own tone: any shade in between, warmer or cooler, or matched from a photo
  const own = el('button', { id: 'skinOwnBtn', class: 'sw own' + (state.skinHex ? ' on set' : ''), type: 'button', text: '+', style: state.skinHex ? `background:${state.skinHex}` : '', 'aria-label': 'Your own skin tone', 'aria-expanded': String(skinOwnOpen), onclick: () => {
    if (!state.skinHex) { snapshot(); state.skinHex = skinColor(); save(); refreshUndo(); skinOwnOpen = true; } else skinOwnOpen = !skinOwnOpen;
    renderBody();
  } });
  sw.append(own);
  $('#skinOwn').hidden = !skinOwnOpen;
  if (state.skinHex && !skinSlide) { const n = nearestTone(state.skinHex); $('#rSkinDepth').value = Math.round(n.depth * 100); $('#rSkinWarm').value = Math.round(n.warmth * 100); }
  document.querySelectorAll('[data-fig]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fig === state.figure ? 'true' : 'false'));
  $('#rMuscle').value = Math.round((state.muscle ?? 0.5) * 100); $('#rWeight').value = Math.round((state.weight ?? 0.5) * 100);
  syncFitUI();
  $('#rHeight').value = state.heightCm; const inch = state.heightCm / 2.54; $('#hText').textContent = `${Math.floor(inch / 12)} ft ${Math.round(inch % 12)} in  ·  ${state.heightCm} cm`;
}
function renderUI() { needsRender = true; renderProcreateBar(); $('#cV47Source').hidden=!state.v47Source; $('#openUnplaced').hidden=!(state.unplacedTattoos||[]).length; renderTray(); renderSheet(); renderBody(); refreshUndo(); }
function toast(msg, action, fn) {
  const t = $('#toast'); t.replaceChildren(el('span', { text: msg })); if (action) t.append(el('button', { type: 'button', text: action, onclick: () => { fn(); t.hidden = true; } }));
  // below a bar that is showing at the top, never behind it
  const bar = ['#procreateBar', '#paintBar'].map((q) => $(q)).find((b) => b && !b.hidden);
  t.style.top = bar ? `${Math.round(bar.getBoundingClientRect().bottom + 8)}px` : '';
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
// Copy to other side: the same artwork, mirrored, at the matching spot on the other side of the
// body (the body is symmetric left to right). It shares the artwork, so cleaning one up offers
// to clean both.
function otherSide(t) {
  const p = new V3(-t.pos[0], t.pos[1], t.pos[2]), n = new V3(-t.normal[0], t.normal[1], t.normal[2]).normalize();
  const h = surfaceAt(p.clone().addScaledVector(n, 0.2), n.clone().negate());
  if (!h || Math.hypot(...h.pos.map((v, i) => v - p.getComponent(i))) > 0.03) return null;
  return { pos: h.pos, normal: h.normal, rot: wrapAngle(-(t.rot || 0)), flip: !t.flip };
}
$('#bOtherSide').addEventListener('click', () => {
  markTried('other-side');
  const t = sel(); if (!t) return;
  if (Math.abs(t.pos[0]) < Math.max(0.02, t.width * 0.3)) { toast('This tattoo sits in the middle of the body, so there is no other side.'); return; }
  const m = otherSide(t); if (!m) { toast('Could not find the matching spot on the other side.'); return; }
  snapshot();
  const base = t.name.replace(/ \((left|right)\)$/i, '');
  const sideName = (x) => (x > 0 ? 'left' : 'right'); // the body's own left is +x
  const c = { ...structuredClone(t), id: uid(), name: `${base} (${sideName(m.pos[0])})`.slice(0, 40), locked: false, ...m };
  if (!/\((left|right)\)$/i.test(t.name)) t.name = `${base} (${sideName(t.pos[0])})`.slice(0, 40);
  state.tattoos.push(c); selectedId = c.id; commit();
  toast('Copied to the other side.', 'Undo', undo);
});
// Real size on screen: the artwork at its true size, to hold the iPad against your skin. The
// screen's pixels per inch is a guess per device that a bank card can correct; it is kept on
// this device only, outside the project.
const PPI_KEY = 'ia-screen-ppi';
function guessPpi() {
  try { const v = +localStorage.getItem(PPI_KEY); if (v > 40 && v < 400) return v; } catch (_) { /* private mode */ }
  const ua = navigator.userAgent || '', touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad/.test(ua) || touchMac) return Math.min(screen.width, screen.height) <= 744 ? 163 : 132; // iPad mini is denser
  if (/iPhone/.test(ua)) return 160;
  return 96;
}
let rsPpi = 0, rsId = null;
function inchesOf(t) { const w = t.width * state.heightCm / 175 * 100 / 2.54; return { w, h: w / t.aspect }; }
function renderRealSize() {
  const t = state.tattoos.find((x) => x.id === rsId); if (!t) { $('#realSize').hidden = true; return; }
  const { w, h } = inchesOf(t), box = $('#rsArt'), img = $('#rsImg');
  box.style.width = w * rsPpi + 'px'; box.style.height = h * rsPpi + 'px';
  img.src = images[t.img]; img.style.transform = `scale(${t.flip ? -1 : 1},${t.imageTopDown ? 1 : -1})`;
  $('#realSize').style.setProperty('--rs-skin', skinColor());
  const big = w * rsPpi > innerWidth || h * rsPpi > innerHeight;
  $('#rsText').textContent = `${t.name}: ${w.toFixed(1)} × ${h.toFixed(1)} in (${(w * 2.54).toFixed(0)} × ${(h * 2.54).toFixed(0)} cm) at real size.` + (big ? ' Bigger than the screen, so the middle shows.' : ' Hold the screen against your skin.');
  const card = $('#rsCard'); card.style.width = 3.370 * rsPpi + 'px'; card.style.height = 2.125 * rsPpi + 'px';
}
function showRealSize(on) {
  $('#realSize').hidden = !on; if (!on) { $('#rsCal').hidden = true; $('#rsCard').hidden = true; $('#rsCheck').hidden = false; return; }
  markTried('real-size'); rsPpi = guessPpi(); rsId = selectedId; renderRealSize();
}
$('#bRealSize').addEventListener('click', () => showRealSize(true));
$('#rsClose').addEventListener('click', () => showRealSize(false));
$('#rsCheck').addEventListener('click', () => { $('#rsCal').hidden = false; $('#rsCard').hidden = false; $('#rsCheck').hidden = true; });
$('#rsSmaller').addEventListener('click', () => { rsPpi *= 0.99; renderRealSize(); });
$('#rsBigger').addEventListener('click', () => { rsPpi *= 1.01; renderRealSize(); });
$('#rsCalDone').addEventListener('click', () => { try { localStorage.setItem(PPI_KEY, String(Math.round(rsPpi * 10) / 10)); } catch (_) { /* kept until closed */ } $('#rsCal').hidden = true; $('#rsCard').hidden = true; $('#rsCheck').hidden = false; toast('Scale saved for this device.'); });
// Try it on with the camera: the selected artwork over a live camera view or a photo of your
// own skin. One finger moves it, two size and turn it, Curve wraps it round an arm or a leg,
// and Take photo freezes the picture to save or share. View only: the project never changes.
const tryOn = { id: null, stream: null, facing: 'environment', t: { x: 0, y: 0, s: 1, r: 0 }, baseW: 300, img: null, art: null, curve: 0, frozen: null, frozenMirror: false, pts: new Map(), start: null };
function toView() { return { w: innerWidth, h: innerHeight }; }
function toRenderArt() {
  const t = state.tattoos.find((x) => x.id === tryOn.id); if (!t || !tryOn.img) return;
  tryOn.art = curvedArt(tryOn.img, { flipX: !!t.flip, flipY: !t.imageTopDown, curve: tryOn.curve });
  const c = $('#toArt'); c.width = tryOn.art.width; c.height = tryOn.art.height; c.getContext('2d').drawImage(tryOn.art, 0, 0);
  c.style.opacity = String(t.opacity ?? 0.92); toPlace();
}
function toPlace() {
  const c = $('#toArt'), a = tryOn.art; if (!a) return;
  const w = tryOn.baseW * tryOn.t.s, h = w * a.height / a.width;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  c.style.transform = `translate(${tryOn.t.x - w / 2}px,${tryOn.t.y - h / 2}px) rotate(${tryOn.t.r}rad)`;
}
function toStopCamera() { if (tryOn.stream) { for (const tr of tryOn.stream.getTracks()) tr.stop(); tryOn.stream = null; } $('#toVideo').srcObject = null; }
async function toStartCamera() {
  toStopCamera(); const v = $('#toVideo');
  if (!navigator.mediaDevices?.getUserMedia) { toNoCamera(); return; }
  try {
    tryOn.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: tryOn.facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if ($('#tryOn').hidden) { toStopCamera(); return; }
    v.srcObject = tryOn.stream; v.classList.toggle('mirror', tryOn.facing === 'user'); v.hidden = false; await v.play().catch(() => {});
    $('#toText').textContent = toLabel();
  } catch (_) { toNoCamera(); }
}
function toNoCamera() { $('#toVideo').hidden = true; $('#toSnap').disabled = true; $('#toSwitch').disabled = true; $('#toText').textContent = 'The camera is not available here. Use a photo of your skin instead.'; }
function toLabel() { const t = state.tattoos.find((x) => x.id === tryOn.id); if (!t) return ''; const { w, h } = inchesOf(t); return `${t.name}: ${w.toFixed(1)} × ${h.toFixed(1)} in on the body. Move it with one finger, size and turn it with two.`; }
async function openTryOn() {
  const t = sel(); if (!t) return; markTried('try-on');
  tryOn.id = t.id; tryOn.img = await loadImg(t.img); if (!tryOn.img) { toast('This artwork could not be opened.'); return; }
  const v = toView(); tryOn.baseW = Math.min(v.w, v.h) * 0.42; tryOn.t = { x: v.w / 2, y: v.h * 0.45, s: 1, r: 0 };
  tryOn.curve = 0; $('#rToCurve').value = 0; tryOn.frozen = null; tryOn.pts.clear();
  $('#tryOn').hidden = false; $('#toPhoto').hidden = true; $('#toLive').hidden = false; $('#toDone').hidden = true; $('#toSnap').disabled = false; $('#toSwitch').disabled = false;
  $('#toText').textContent = toLabel(); toRenderArt(); toStartCamera();
}
function closeTryOn() { toStopCamera(); $('#tryOn').hidden = true; tryOn.pts.clear(); }
function toFreeze(src, w, h, mirror) {
  tryOn.frozen = { src, w, h }; tryOn.frozenMirror = mirror;
  toStopCamera(); $('#toVideo').hidden = true;
  const p = $('#toPhoto'); p.hidden = false; p.style.transform = mirror ? 'scaleX(-1)' : '';
  $('#toLive').hidden = true; $('#toDone').hidden = false;
  $('#toText').textContent = 'Adjust it on the photo, then save or share the picture.';
}
$('#bTryOn').addEventListener('click', openTryOn);
$('#toClose').addEventListener('click', closeTryOn);
$('#toSwitch').addEventListener('click', () => { tryOn.facing = tryOn.facing === 'user' ? 'environment' : 'user'; toStartCamera(); });
$('#toSnap').addEventListener('click', () => {
  const v = $('#toVideo'); if (!v.videoWidth) return;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  $('#toPhoto').src = c.toDataURL('image/jpeg', 0.92); toFreeze(c, c.width, c.height, tryOn.facing === 'user');
});
$('#toPhotoBtn').addEventListener('click', () => $('#toFile').click());
$('#toFile').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); });
  if (!url) { toast('That photo could not be opened.'); return; }
  const im = new Image(); im.onload = () => { $('#toPhoto').src = url; toFreeze(im, im.naturalWidth, im.naturalHeight, false); }; im.onerror = () => toast('That photo could not be opened.'); im.src = url;
});
$('#toRetake').addEventListener('click', () => { tryOn.frozen = null; $('#toPhoto').hidden = true; $('#toLive').hidden = false; $('#toDone').hidden = true; $('#toSnap').disabled = false; $('#toSwitch').disabled = false; $('#toText').textContent = toLabel(); toStartCamera(); });
$('#toShare').addEventListener('click', async () => {
  const f = tryOn.frozen, t = state.tattoos.find((x) => x.id === tryOn.id); if (!f || !tryOn.art || !t) return;
  const v = toView(), c = compose(f.src, f.w, f.h, { mirror: tryOn.frozenMirror, art: tryOn.art, t: tryOn.t, baseW: tryOn.baseW, alpha: t.opacity ?? 0.92, viewW: v.w, viewH: v.h });
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) { toast('The picture could not be made.'); return; }
  const r = await shareOrDownload(`${(t.name || 'tattoo').replace(/[^\w -]+/g, '').trim() || 'tattoo'} try-on.jpg`, blob);
  if (r === 'downloaded') toast('Picture saved.');
});
$('#rToCurve').addEventListener('input', () => { tryOn.curve = +$('#rToCurve').value / 100; toRenderArt(); });
{
  const surf = $('#tryOn'), pt = (e) => ({ x: e.clientX, y: e.clientY });
  const begin = () => { const p = [...tryOn.pts.values()]; tryOn.start = { t: { ...tryOn.t }, a: { ...p[0] }, b: p[1] ? { ...p[1] } : null }; };
  surf.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#toTop,#toBar') || tryOn.pts.size >= 2) return;
    tryOn.pts.set(e.pointerId, pt(e)); try { surf.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ } begin();
  });
  surf.addEventListener('pointermove', (e) => {
    if (!tryOn.pts.has(e.pointerId) || !tryOn.start) return; tryOn.pts.set(e.pointerId, pt(e));
    const p = [...tryOn.pts.values()], s = tryOn.start;
    if (p.length >= 2 && s.b) tryOn.t = pinch(s.t, s.a, s.b, p[0], p[1]);
    else tryOn.t = { ...s.t, x: s.t.x + p[0].x - s.a.x, y: s.t.y + p[0].y - s.a.y };
    tryOn.t.s = Math.max(0.15, Math.min(6, tryOn.t.s)); toPlace();
  });
  const end = (e) => { if (!tryOn.pts.delete(e.pointerId)) return; if (tryOn.pts.size) begin(); else tryOn.start = null; };
  surf.addEventListener('pointerup', end); surf.addEventListener('pointercancel', end);
}
addEventListener('resize', () => { if (!$('#tryOn').hidden) toPlace(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && tryOn.stream) toStopCamera(); else if (!document.hidden && !$('#tryOn').hidden && !tryOn.frozen) toStartCamera(); });
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
/* ---------- edit in Procreate and bring it back to the same tattoo ---------- */
function editInProcreate() {
  markTried('edit-procreate');
  const t = sel(); if (!t) return;
  if (t.locked) { toast('Unlock this tattoo before editing its artwork.'); return; }
  cancelGesture();
  const im = imgEls[t.img];
  if (!im) { loadImg(t.img); toast('Getting the artwork ready. Tap Edit in Procreate again.'); return; }
  // made right here in the tap, so the share sheet is allowed to open
  const url = artworkAsSeen(im, { mirror: !!t.flip, upsideDown: !t.imageTopDown });
  writePending({ tattooId: t.id, name: t.name || 'Tattoo', at: Date.now(), width: im.naturalWidth, height: im.naturalHeight });
  renderProcreateBar();
  shareOrDownload(editFileName(t.name), dataUrlBlob(url)).then((how) => {
    if (how === 'cancelled') { writePending(null); renderProcreateBar(); return; }
    toast(how === 'shared' ? 'Choose Procreate. When you finish, use Copy All in Procreate and tap Paste here.' : 'Picture saved. Open it in Procreate, then Copy All and tap Paste here.');
  }).catch((e) => toast('Could not send the picture: ' + e.message));
}
function procreatePending() { const p = readPending(); if (p?.kind === 'new') return { p, t: null }; const t = p && state.tattoos.find((x) => x.id === p.tattooId); return t ? { p, t } : null; }
function renderProcreateBar() {
  const bar = $('#procreateBar'); if (!bar) return; const now = procreatePending();
  bar.hidden = !now || !!paint; if (!now) return;
  const fresh = now.p.kind === 'new';
  $('#pcHead').textContent = fresh ? 'Draw your new tattoo in Procreate.' : `Bring back ${now.t.name || 'your tattoo'} from Procreate.`;
  $('#pcHow').textContent = fresh ? 'Draw on a new layer, hide the guide layer, then swipe down with three fingers, tap Copy All and tap Paste here.' : 'When you finish, swipe down with three fingers in Procreate and tap Copy All, then tap Paste here.';
  $('#pcSend').hidden = !fresh;
}
/* ---------- draw a new tattoo in Procreate on a painted area ---------- */
// One finger (or the Pencil) that starts on the body paints the area; one that starts off the
// body still turns the view, and two fingers still zoom and pan. Nothing is saved until the
// drawing comes back as a new tattoo.
let paint = null, drawGuideUrl = null;
const paintMat = new THREE.MeshBasicMaterial({ color: 0x8474ff, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
function startPaint() {
  markTried('draw-new');
  if (poseView.active) { toast('Turn off the pose first, then paint the area.'); return; }
  cancelGesture(); select(null); showLook(false); tapPlaceId = null;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', bodyGeo.attributes.position); geo.setIndex([]);
  const mesh = new THREE.Mesh(geo, paintMat); mesh.renderOrder = 3; mesh.frustumCulled = false; scene.add(mesh);
  paint = { tris: new Set(), mesh }; renderPaint(); renderProcreateBar();
}
function endPaint() { if (!paint) return; scene.remove(paint.mesh); paint.mesh.geometry.dispose(); paint = null; renderPaint(); renderProcreateBar(); needsRender = true; }
function renderPaint() {
  $('#paintBar').hidden = !paint; document.body.classList.toggle('painting', !!paint);
  if (!paint) return; $('#paintGo').disabled = !paint.tris.size; $('#paintClear').disabled = !paint.tris.size;
}
function triCentre(tri, I = bodyGeo.index.array, P = bodyGeo.attributes.position.array) { const c = [0, 0, 0]; for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) c[j] += P[I[tri * 3 + k] * 3 + j] / 3; return c; }
function paintAt(x, y, added = null) {
  const h = hitBody(x, y); if (!h || h.faceIndex == null || !paint) return;
  const k = (2 * cur.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / canvas.getBoundingClientRect().height, R = Math.max(0.006, 26 * k);
  const A = bodyAdjacency(), seen = new Set([h.faceIndex]), queue = [h.faceIndex], p = h.point;
  while (queue.length) {
    const t = queue.pop(), c = triCentre(t); if (Math.hypot(c[0] - p.x, c[1] - p.y, c[2] - p.z) > R && t !== h.faceIndex) continue;
    if (!paint.tris.has(t)) { paint.tris.add(t); added?.add(t); }
    for (let j = 0; j < 3; j++) { const nx = A[t * 3 + j]; if (nx >= 0 && !seen.has(nx)) { seen.add(nx); queue.push(nx); } }
  }
  showPaint();
}
function showPaint() {
  const I = bodyGeo.index.array, idx = new Uint32Array(paint.tris.size * 3); let i = 0;
  for (const t of paint.tris) { idx[i++] = I[t * 3]; idx[i++] = I[t * 3 + 1]; idx[i++] = I[t * 3 + 2]; }
  paint.mesh.geometry.setIndex(new THREE.BufferAttribute(idx, 1)); needsRender = true; renderPaint();
}
// The guide square that covers the painted area, and the picture that goes to Procreate.
function paintedPatch() {
  const I = bodyGeo.index.array, P = bodyGeo.attributes.position.array, pts = [], n = new V3();
  for (const t of paint.tris) {
    const c = triCentre(t, I, P); pts.push(c);
    const a = new V3().fromArray(P, I[t * 3] * 3), b = new V3().fromArray(P, I[t * 3 + 1] * 3), d = new V3().fromArray(P, I[t * 3 + 2] * 3);
    n.add(b.sub(a).cross(d.sub(a))); // area-weighted
  }
  const mid = pts.reduce((s, p) => s.map((v, j) => v + p[j] / pts.length), [0, 0, 0]);
  if (n.lengthSq() < 1e-12) n.set(0, 0, 1); n.normalize();
  const f = frameOf({ normal: n.toArray(), rot: 0 });
  const ext = areaExtent(pts, mid, { right: f.right.toArray(), up: f.up.toArray() });
  const centre = new V3(...mid).addScaledVector(f.right, ext.mx).addScaledVector(f.up, ext.my);
  const hit = surfaceAt(centre.clone().addScaledVector(n, 0.3), n.clone().negate()) || { pos: centre.toArray() };
  const width = THREE.MathUtils.clamp(Math.max(ext.w, ext.h) * 1.25 + 0.012, 0.03, 0.6);
  const patch = { pos: hit.pos, normal: n.toArray(), width, aspect: 1, rot: 0, wrap: 0, bend: 0, taper: 0 };
  // which way the picture's x and y run on the body, read off the patch itself
  const geo = decalGeometry(patch), PP = geo.attributes.position.array, UV = geo.attributes.uv.array, c0 = new V3(...patch.pos);
  let sx = 0, sy = 0; const q = new V3();
  for (let i = 0; i < UV.length / 2; i++) { q.fromArray(PP, i * 3).sub(c0); sx += (UV[i * 2] - 0.5) * q.dot(f.right); sy += (UV[i * 2 + 1] - 0.5) * q.dot(f.up); }
  patch.sx = sx >= 0 ? 1 : -1; patch.sy = sy >= 0 ? 1 : -1;
  return { patch, geo, frame: f };
}
function makeDrawGuide() {
  const { patch, geo, frame } = paintedPatch();
  try {
    const uvs = Float32Array.from(geo.attributes.uv.array, (v) => (v - UV_MARGIN) / (1 - 2 * UV_MARGIN));
    const mask = patchMaskTriangles(geo.attributes.position.array, uvs);
    // the painted area in the guide's own coordinates
    const I = bodyGeo.index.array, P = bodyGeo.attributes.position.array, c0 = new V3(...patch.pos), q = new V3(), hl = [];
    const toUv = (v) => { q.fromArray(P, v * 3).sub(c0); return [0.5 + patch.sx * q.dot(frame.right) / patch.width, 0.5 + patch.sy * q.dot(frame.up) / patch.width]; };
    for (const t of paint.tris) hl.push([...toUv(I[t * 3]), ...toUv(I[t * 3 + 1]), ...toUv(I[t * 3 + 2])]);
    const near = state.tattoos.filter((t) => !t.hidden).map((t) => decals[t.id]).filter((d) => d && d.tex).map((d) => ({ geometry: d.mesh.geometry, texture: d.tex }));
    const ink = makePatchReference(geo, near, UV_MARGIN, GUIDE_SIZE, true);
    // the patch's own picture runs u along sx·right and v along sy·up; show it upright
    const guide = drawGuide({ mask, highlight: hl, skin: skinColor(), ink, label: 'New tattoo', widthCm: patch.width * 100 * state.heightCm / 175, flipX: patch.sx < 0, flipY: patch.sy > 0 });
    return { patch, url: guide.toDataURL('image/png') };
  } finally { geo.dispose(); }
}
function sendDrawGuide() {
  if (!drawGuideUrl) { toast('The guide is gone after a reload. Paint the area again to get a new one.'); return; }
  shareOrDownload('New tattoo guide.png', dataUrlBlob(drawGuideUrl)).then((how) => {
    if (how === 'shared') toast('Choose Procreate. Draw on a new layer, hide the guide, Copy All, then tap Paste here.');
    else if (how === 'downloaded') toast('Guide saved. Open it in Procreate, draw on a new layer, hide the guide, Copy All, then tap Paste here.');
  }).catch((e) => toast('Could not send the guide: ' + e.message));
}
$('#drawNew').addEventListener('click', startPaint);
$('#paintCancel').addEventListener('click', endPaint);
$('#paintClear').addEventListener('click', () => { if (!paint) return; paint.tris.clear(); showPaint(); });
$('#paintGo').addEventListener('click', () => {
  if (!paint || !paint.tris.size) return;
  let made; try { made = makeDrawGuide(); } catch (e) { toast('Could not make the guide: ' + e.message); return; }
  drawGuideUrl = made.url;
  writePending({ kind: 'new', tattooId: '', name: 'New tattoo', at: Date.now(), patch: { pos: made.patch.pos, normal: made.patch.normal, width: made.patch.width, sx: made.patch.sx, sy: made.patch.sy } });
  endPaint(); sendDrawGuide(); // straight from the tap, so the share sheet may open
});
$('#pcSend').addEventListener('click', sendDrawGuide);
async function bringBackNewDrawing(blob, p) {
  const url = URL.createObjectURL(blob);
  let im; try { im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be opened.')); i.src = url; }); } finally { URL.revokeObjectURL(url); }
  const w = im.naturalWidth, h = im.naturalHeight;
  if (Math.abs(w - h) > Math.max(w, h) * 0.02) { toast('That picture is not the square guide. Copy All from the canvas the guide opened in.'); return; }
  const s = Math.min(1, 2048 / w), c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, c.width, c.height);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  if (clearShare(px) < 0.02) { toast('The guide came back too. In Procreate, hide the guide layer, then Copy All again and tap Paste.'); return; }
  const box = inkBox(px, c.width, c.height); if (!box) { toast('Nothing drawn came back. Show your drawing layer in Procreate and Copy All again.'); return; }
  const cut = document.createElement('canvas'); cut.width = box.px[2]; cut.height = box.px[3]; cut.getContext('2d').drawImage(c, box.px[0], box.px[1], box.px[2], box.px[3], 0, 0, box.px[2], box.px[3]);
  // The guide shows the body upright (x to the right, y down), like any picture you upload, so
  // the drawing goes on like an upload: its middle on the same plane, then onto the skin.
  const f = frameOf({ normal: p.normal, rot: 0 }), n = new V3(...p.normal).normalize();
  const ox = (box.x + box.w / 2 - 0.5) * p.width, oy = -(box.y + box.h / 2 - 0.5) * p.width;
  const at = new V3(...p.pos).addScaledVector(f.right, ox).addScaledVector(f.up, oy);
  const hit = surfaceAt(at.clone().addScaledVector(n, 0.3), n.clone().negate());
  cancelGesture(); snapshot();
  const t = await addImage(cut.toDataURL('image/png'), 'New tattoo', { pos: hit ? hit.pos : at.toArray(), normal: p.normal, width: p.width * box.w });
  if (!t) { toast('That drawing could not be added. Nothing changed.'); return; }
  t.status = 'planned'; writePending(null); drawGuideUrl = null; selectedId = t.id; commit();
  toast('Your drawing is on the body as a new tattoo, where you painted.', 'Undo', undo);
}
async function bringBackFromProcreate(blob) {
  const now = procreatePending();
  if (now?.p.kind === 'new') return bringBackNewDrawing(blob, now.p.patch);
  if (!now) { toast('That tattoo is no longer in this project.'); writePending(null); renderProcreateBar(); return; }
  if (now.t.locked) { toast('Unlock this tattoo first, then bring the picture back.'); return; }
  const pic = await normalisePicture(blob), key = uid(); images[key] = pic.dataUrl;
  if (!await loadImg(key)) { delete images[key]; toast('That picture could not be opened. Nothing changed.'); return; }
  const id = now.t.id; cancelGesture(); snapshot();
  const rev = applyArtworkRevision(state, id, key, pic.aspect, { linked: false });
  state = rev.nextState;
  const t = state.tattoos.find((x) => x.id === id);
  // the picture came back as it looks on the body, mirror and flip already in it
  t.flip = false; t.imageTopDown = true;
  if (rev.artworkId) { const r = state.artworks[rev.artworkId]; delete r.cleanup; r.editedIn = 'Procreate'; }
  writePending(null); selectedId = id; commit();
  toast(`${t.name || 'Tattoo'} updated from Procreate, same place and size. Your earlier artwork is kept.`, 'Undo', undo);
}
$('#bProcreate').addEventListener('click', editInProcreate);
$('#pcPaste').addEventListener('click', async () => {
  let blob = null;
  try { blob = await clipboardImage(); } catch (_) { /* refused or nothing there */ }
  if (!blob) { toast('No picture copied yet. In Procreate, swipe down with three fingers, tap Copy All, then come back and tap Paste.'); return; }
  bringBackFromProcreate(blob).catch((e) => toast(e.message));
});
$('#pcFile').addEventListener('click', () => $('#procreateFile').click());
$('#procreateFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) bringBackFromProcreate(f).catch((err) => toast(err.message)); });
$('#pcCancel').addEventListener('click', () => { writePending(null); renderProcreateBar(); });
// a keyboard paste works too while a tattoo is out in Procreate
document.addEventListener('paste', (e) => {
  if (!procreatePending() || e.target.closest?.('input,textarea,[contenteditable]')) return;
  const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); bringBackFromProcreate(f).catch((err) => toast(err.message)); }
});
$('#bCleanup').addEventListener('click',()=>cleanupSelected(false).catch(e=>toast('Could not clean up artwork: '+e.message)));
$('#bCleanupLinked').addEventListener('click',()=>cleanupSelected(true).catch(e=>toast('Could not clean up artwork: '+e.message)));
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
function afterPoseChange() { spotCache.clear(); const t = sel(); if (t && !gest) requestAnimationFrame(() => { if (sel() === t && poseView.settled()) revealTattoo(t); }); }
$('#poseBtn').addEventListener('click', () => { cancelGesture(); toggle('#bodyPop', false); toggle('#lightPop', false); toggle('#clothesPop', false); toggle('#agePop', false); toggle('#posePop'); renderPose(); });
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
$('#clothesBtn').addEventListener('click', () => { cancelGesture(); toggle('#posePop', false); toggle('#lightPop', false); toggle('#bodyPop', false); toggle('#agePop', false); toggle('#clothesPop'); renderClothes(); });
$('#clothesTop').addEventListener('click', (e) => { const b = e.target.closest('[data-top]'); if (b) setClothes({ top: b.dataset.top }); });
$('#clothesBottom').addEventListener('click', (e) => { const b = e.target.closest('[data-bottom]'); if (b) setClothes({ bottom: b.dataset.bottom }); });
$('#clothesHair').addEventListener('click', (e) => { const b = e.target.closest('[data-hair]'); if (b) setClothes({ hair: b.dataset.hair }); });
renderClothes();

/* ---------- aging: how the ink looks after some years (view only, not saved) ---------- */
function renderAging() {
  const a = AGES.find((x) => x.years === agingYears);
  $('#ageBtn').textContent = agingYears ? 'Aging: ' + a.label : 'Aging';
  $('#ageBtn').setAttribute('aria-expanded', String(!$('#agePop').hidden));
  document.querySelectorAll('#ageChoices [data-years]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.years === agingYears)));
}
function setAging(years) { agingYears = AGES.some((a) => a.years === years) ? years : 0; syncDecals(); renderAging(); }
$('#ageChoices').innerHTML = AGES.map((a) => `<button class="btn" type="button" data-years="${a.years}">${a.label}</button>`).join('');
$('#ageBtn').addEventListener('click', () => { cancelGesture(); toggle('#posePop', false); toggle('#lightPop', false); toggle('#bodyPop', false); toggle('#clothesPop', false); toggle('#agePop'); renderAging(); });
$('#ageChoices').addEventListener('click', (e) => { const b = e.target.closest('[data-years]'); if (b) setAging(+b.dataset.years); });
renderAging();
/* ---------- light: studio, daylight, warm room or midday sun (view only, kept on this device) ---------- */
let lightId = applyLight(readLight(), { hemi, key, rim, rim2 });
function renderLight() {
  const L = LIGHTS.find((l) => l.id === lightId);
  $('#lightBtn').textContent = lightId === 'studio' ? 'Light' : 'Light: ' + L.label;
  $('#lightBtn').setAttribute('aria-expanded', String(!$('#lightPop').hidden));
  document.querySelectorAll('#lightChoices [data-light]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.light === lightId)));
}
function setLight(id) { if (id !== 'studio') markTried('light'); lightId = applyLight(id, { hemi, key, rim, rim2 }); writeLight(lightId); needsRender = true; renderLight(); }
$('#lightChoices').innerHTML = LIGHTS.map((l) => `<button class="btn" type="button" data-light="${l.id}">${l.label}</button>`).join('');
$('#lightBtn').addEventListener('click', () => { cancelGesture(); toggle('#newPop', false); toggle('#posePop', false); toggle('#bodyPop', false); toggle('#clothesPop', false); toggle('#agePop', false); toggle('#lightPop'); renderLight(); });
$('#lightChoices').addEventListener('click', (e) => { const b = e.target.closest('[data-light]'); if (b) setLight(b.dataset.light); });
renderLight();
/* ---------- Quick spots: try the selected tattoo on the usual placements ---------- */
let spotSide = 'L', spotId = null;
function renderSpots() {
  const t = sel(); $('#spotTitle').textContent = t ? `Try ${t.name} on` : 'Try it on';
  document.querySelectorAll('#spotSide [data-side]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === spotSide)));
  document.querySelectorAll('#spotChoices [data-spot]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.spot === spotId)));
}
function spotPlace(id) {
  const t = sel(), spot = SPOTS.find((s) => s.id === id); if (!t || !spot) return false;
  if (t.locked) { toast('Unlock this tattoo first.'); return false; }
  if (poseView.active) { toast('Turn off the pose first, then try spots.'); return false; }
  const aim = spotAim(spot, spotSide, POSE_BONES, poseView.restRig().joints); if (!aim) return false;
  const p = new V3(...aim.point), d = new V3(...aim.dir), from = p.clone().addScaledVector(d, 1.5);
  ray.set(from, d.clone().negate());
  // the last skin the ray meets before the bone is this limb's own skin, not an arm in the way
  const hits = ray.intersectObject(body, false).filter((h) => h.distance < 1.5 + 1e-6);
  const h = hits[hits.length - 1]; if (!h) { toast('That spot could not be found on this body.'); return false; }
  const n = h.normal.clone().transformDirection(body.matrixWorld).normalize();
  snapshot();
  t.pos = h.point.toArray(); t.normal = n.toArray(); t.rot = 0;
  const up0 = frameOf(t).up.toArray(); t.rot = turnAlong(up0, aim.along, t.normal);
  spotId = id; markTried('spots'); commit(); focusTattoo(t); renderSpots();
  return true;
}
$('#spotChoices').innerHTML = SPOTS.map((s) => `<button class="btn" type="button" data-spot="${s.id}">${s.label}</button>`).join('');
$('#spotChoices').addEventListener('click', (e) => { const b = e.target.closest('[data-spot]'); if (b) spotPlace(b.dataset.spot); });
$('#spotSide').addEventListener('click', (e) => { const b = e.target.closest('[data-side]'); if (!b) return; spotSide = b.dataset.side; renderSpots(); const s = SPOTS.find((x) => x.id === spotId); if (s && !s.mid) spotPlace(spotId); });
$('#bSpots').addEventListener('click', () => { cancelGesture(); toggle('#newPop', false); toggle('#lightPop', false); toggle('#agePop', false); toggle('#posePop', false); toggle('#bodyPop', false); toggle('#clothesPop', false); const t = sel(); if (t) spotSide = t.pos[0] >= 0 ? 'L' : 'R'; spotId = null; toggle('#spotPop'); renderSpots(); });
/* ---------- New to try: the newest features, how to try them, and Show me ---------- */
function markTried(id) { if (tried.has(id)) return; tried.add(id); writeTried(tried); renderNew(); }
function renderNew() {
  const n = untriedCount(tried); $('#newBtn').hidden = n === 0; $('#newCount').textContent = String(n);
  $('#newBtn').setAttribute('aria-label', `New to try, ${n} not tried yet`); $('#newBtn').setAttribute('aria-expanded', String(!$('#newPop').hidden));
  if ($('#newPop').hidden) return;
  $('#newList').replaceChildren(...ordered(tried).map((f) => {
    const done = tried.has(f.id);
    const tick = el('button', { class: 'tick', type: 'button', role: 'checkbox', 'aria-checked': String(done), 'aria-label': (done ? 'Tried: ' : 'Not tried yet: ') + f.title, onclick: () => { if (tried.has(f.id)) tried.delete(f.id); else tried.add(f.id); writeTried(tried); renderNew(); } });
    const text = el('div', {}, el('b', { text: f.title }), el('small', { text: f.how }));
    return el('div', { class: 'newrow' + (done ? ' done' : ''), 'data-feature': f.id }, tick, text, el('button', { class: 'btn', type: 'button', text: 'Show me', onclick: () => showMe(f) }));
  }));
}
function openNew(on = true) { closePanels(); toggle('#planMenu', false); $('#newPop').hidden = !on; renderNew(); }
function closePanels() { cancelGesture(); showLook(false); for (const id of ['#posePop', '#clothesPop', '#agePop', '#lightPop', '#bodyPop', '#share', '#newPop']) toggle(id, false); }
function needTattoo() {
  const t = sel() || state.tattoos.find((x) => !x.hidden) || state.tattoos[0];
  if (!t) { toast('Add a tattoo first, then try this.'); return null; }
  if (sel() !== t) select(t.id, true); else revealTattoo(t);
  return t;
}
const SHOW = {
  definition: () => { toggle('#bodyPop', true); return ['#rMuscle', 'Slide Muscle up, or Weight down, to see more muscle definition.']; },
  skinTone: () => { toggle('#bodyPop', true); return ['#skinOwnBtn', 'Tap + to make your own skin tone, or match a photo of your skin.']; },
  light: () => { showLook(true); return ['#lightBtn', 'Tap Light, then pick the light you will see it in most.']; },
  drawNew: () => ['#drawNew', 'Tap Draw in Procreate, then paint the spot on the body.'],
  otherSide: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bOtherSide', 'Copy to other side puts a mirrored twin on the other side.']; },
  spots: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bSpots', 'Try other spots moves this tattoo to the forearm, calf, ribs and more, one tap each.']; },
  tryOn: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bTryOn', 'Try on with camera puts this tattoo over your camera. Point it at your skin.']; },
  realSize: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bRealSize', 'Real size on screen shows it at its true size. Hold the iPad to your skin.']; },
  handles: () => { if (!needTattoo()) return null; return ['#hSize', 'Drag this corner to resize. Drag the dot above the tattoo to turn it.']; },
  palette: () => { toggle('#share', true); paletteReady = buildPalette(); return ['#cSwatches', 'Saves your skin and ink colours as a palette Procreate opens.']; },
  editProcreate: () => { if (!needTattoo()) return null; return ['#bProcreate', 'Sends this tattoo to Procreate. Copy All there, then tap Paste here.']; },
  pan: () => [null, 'Put two fingers on the screen away from a tattoo and slide them to move the view. Twist clearly to turn it.'],
};
let coachTimer = 0, coachArmed = 0;
function showMe(f) {
  closePanels();
  const r = SHOW[f.show]?.(); if (!r) return;
  coach(r[0], r[1]);
}
function coach(target, text) {
  const ring = $('#pointRing'), tip = $('#pointTip'), t0 = performance.now();
  tip.textContent = text; tip.hidden = false; ring.hidden = !target; coachArmed = t0 + 350;
  cancelAnimationFrame(coachTimer);
  let scrolled = false;
  const place = () => {
    const now = performance.now(); if (now - t0 > 8000) return endCoach();
    const n = target && document.querySelector(target), vis = n && n.getClientRects().length && !n.hidden;
    if (vis && !scrolled) { n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); scrolled = true; }
    if (vis) {
      const b = n.getBoundingClientRect(), pad = 6; ring.hidden = false;
      Object.assign(ring.style, { left: b.left - pad + 'px', top: b.top - pad + 'px', width: b.width + pad * 2 + 'px', height: b.height + pad * 2 + 'px' });
      const tw = tip.offsetWidth, th = tip.offsetHeight, below = b.bottom + pad + 12 + th < innerHeight - 8;
      tip.style.left = Math.max(16, Math.min(innerWidth - tw - 16, b.left + b.width / 2 - tw / 2)) + 'px';
      tip.style.top = (below ? b.bottom + pad + 12 : Math.max(16, b.top - pad - 12 - th)) + 'px';
    } else {
      ring.hidden = true;
      tip.style.left = Math.max(16, innerWidth / 2 - tip.offsetWidth / 2) + 'px'; tip.style.top = Math.round(innerHeight * 0.42) + 'px';
    }
    coachTimer = requestAnimationFrame(place);
  };
  coachTimer = requestAnimationFrame(() => requestAnimationFrame(place));
}
function endCoach() { cancelAnimationFrame(coachTimer); $('#pointRing').hidden = true; $('#pointTip').hidden = true; }
document.addEventListener('pointerdown', () => { if (!$('#pointTip').hidden && performance.now() > coachArmed) endCoach(); }, true);
$('#newBtn').addEventListener('click', () => openNew($('#newPop').hidden));
$('#openNew').addEventListener('click', () => openNew(true));
renderNew();
$('#baBtn').addEventListener('click', () => {
  if (beforeAfter.on) { beforeAfter.set(false); return; }
  if (!plannedShown().length) { toast('Nothing planned to compare yet. Mark a tattoo as Planned to see it here.'); return; }
  beforeAfter.set(true); toast('Left: your skin now. Right: with your planned tattoos. Drag the line to compare.');
});
/* ---------- Preview menu: before/after, pose, clothes and aging behind one button ---------- */
function showLook(open) { const m = $('#lookMenu'); m.hidden = open == null ? !m.hidden : !open; $('#lookBtn').setAttribute('aria-expanded', String(!m.hidden)); }
function renderLook() {
  const on = [];
  if ($('#baBtn').getAttribute('aria-pressed') === 'true') on.push('Before / after');
  for (const id of ['#poseBtn', '#clothesBtn', '#ageBtn', '#lightBtn']) { const t = $(id).textContent, i = t.indexOf(': '); if (i > 0) on.push(t.slice(i + 2)); }
  $('#lookBtn').textContent = on.length ? 'Preview: ' + on.join(', ') : 'Preview';
  $('#lookBtn').classList.toggle('active', on.length > 0);
}
$('#lookBtn').addEventListener('click', () => { cancelGesture(); toggle('#newPop', false); toggle('#posePop', false); toggle('#clothesPop', false); toggle('#agePop', false); toggle('#lightPop', false); showLook(); });
// picking one of them closes the little menu: its own panel (or the wipe) takes over
for (const id of ['#baBtn', '#poseBtn', '#clothesBtn', '#ageBtn', '#lightBtn']) $(id).addEventListener('click', () => showLook(false));
new MutationObserver(renderLook).observe($('#lookMenu'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed'] });
renderLook();
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
function toggle(id, show) { const n = $(id); n.hidden = show == null ? !n.hidden : !show; if (id === '#agePop' && typeof renderAging === 'function') renderAging(); if (id === '#lightPop' && typeof renderLight === 'function') renderLight(); if (id === '#newPop' && typeof renderNew === 'function') renderNew(); if (id === '#bodyPop') updateInset(); if (id === '#posePop') renderPose(); if (id === '#clothesPop' && typeof renderClothes === 'function') renderClothes(); }
$('#bodyBtn').addEventListener('click', () => { showLook(false); toggle('#bodyPop'); });
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
bindShape($('#rMuscle'), (v) => { state.muscle = v; markTried('definition'); });
bindShape($('#rWeight'), (v) => { state.weight = v; });
/* ---------- your own skin tone ---------- */
function skinFromSliders() {
  markTried('skin-tone');
  if (!skinSlide) { snapshot(); skinSlide = true; }
  state.skinHex = toneColour(+$('#rSkinDepth').value / 100, +$('#rSkinWarm').value / 100);
  skinMat.color.set(state.skinHex); needsRender = true;
  const b = $('#skinOwnBtn'); if (b) { b.style.background = state.skinHex; b.classList.add('on', 'set'); }
  document.querySelectorAll('#skins .sw:not(.own)').forEach((x) => x.classList.remove('on'));
}
for (const id of ['#rSkinDepth', '#rSkinWarm']) {
  $(id).addEventListener('input', skinFromSliders);
  $(id).addEventListener('change', () => { skinSlide = false; save(); refreshUndo(); });
}
// Match a photo: open it full screen, tap the skin, keep the middle colour of a small disc.
let skinPhoto = null;
$('#skinPhotoBtn').addEventListener('click', () => $('#skinPhotoFile').click());
$('#skinPhotoFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const url = URL.createObjectURL(f);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That photo could not be opened.')); i.src = url; });
    const s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, c.width, c.height);
    skinPhoto = { url, w: c.width, h: c.height, px: g.getImageData(0, 0, c.width, c.height).data, hex: null };
    $('#spImg').src = url; $('#spRing').hidden = true; $('#spSwatch').style.background = 'transparent';
    $('#spMsg').textContent = 'No spot picked yet.'; $('#spUse').disabled = true; $('#skinPick').hidden = false;
  } catch (err) { URL.revokeObjectURL(url); toast(err.message); }
});
function closeSkinPick() { $('#skinPick').hidden = true; if (skinPhoto) URL.revokeObjectURL(skinPhoto.url); skinPhoto = null; $('#spImg').removeAttribute('src'); }
$('#skinPick').addEventListener('pointerdown', (e) => {
  if (!skinPhoto || e.target.closest('#spBar,#spTop')) return;
  const r = $('#spImg').getBoundingClientRect(), k = Math.min(r.width / skinPhoto.w, r.height / skinPhoto.h);
  const ox = r.left + (r.width - skinPhoto.w * k) / 2, oy = r.top + (r.height - skinPhoto.h * k) / 2;
  const x = (e.clientX - ox) / k, y = (e.clientY - oy) / k;
  if (x < 0 || y < 0 || x >= skinPhoto.w || y >= skinPhoto.h) return;
  const hex = sampleSkin(skinPhoto.px, skinPhoto.w, skinPhoto.h, x, y, Math.max(4, 0.012 * Math.max(skinPhoto.w, skinPhoto.h)));
  const ring = $('#spRing'); ring.hidden = false; ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
  const why = hex ? skinCheck(hex) : 'Tap on the photo.';
  skinPhoto.hex = why ? null : hex; ring.style.background = hex || 'transparent'; $('#spSwatch').style.background = hex || 'transparent';
  $('#spMsg').textContent = why || 'This is the tone you tapped. Tap another spot to try again.'; $('#spUse').disabled = !!why;
});
$('#spCancel').addEventListener('click', closeSkinPick);
$('#spUse').addEventListener('click', () => {
  if (!skinPhoto?.hex) return;
  markTried('skin-tone'); snapshot(); state.skinHex = skinPhoto.hex; skinOwnOpen = true; skinMat.color.set(state.skinHex); needsRender = true;
  closeSkinPick(); renderBody(); save(); refreshUndo();
  toast('Your skin tone now matches the photo.', 'Undo', undo);
});
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
$('#shareBtn').addEventListener('click', () => { toggle('#share', true); paletteReady = buildPalette(); });
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { toggle('#' + b.dataset.close, false); }));
document.addEventListener('keydown', (e) => { if (document.querySelector('[aria-modal=true]')) return; if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (e.key === 'Escape') { if (!$('#skinPick').hidden) closeSkinPick(); if (!$('#tryOn').hidden) closeTryOn(); showRealSize(false); cancelGesture(); showLook(false); toggle('#posePop', false); renderPose(); toggle('#clothesPop', false); toggle('#agePop', false); toggle('#lightPop', false); toggle('#spotPop', false); toggle('#newPop', false); endCoach(); toggle('#planMenu', false); toggle('#share', false); toggle('#preview', false); toggle('#recover', false); toggle('#bodyPop', false); } });

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
// Procreate colour palette: skin tone, its shade and highlight, then the project's ink colours.
// Built when the Share sheet opens, so the tap hands the file straight to the share sheet.
let paletteReady = null;
async function buildPalette() {
  const pics = [];
  for (const key of new Set(state.tattoos.filter((t) => !t.hidden).map((t) => t.img))) {
    const src = images[key]; if (!src) continue;
    try {
      const im = new Image(); im.src = src; await im.decode();
      const k = Math.min(1, 160 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, c.width, c.height); pics.push(g.getImageData(0, 0, c.width, c.height).data);
    } catch (_) { /* a picture that will not open adds no colours */ }
  }
  const colours = [...skinSet(skinColor()), ...inkColours(pics, { max: 12 })];
  const name = 'Ink Atlas ' + (state.projectName || 'My tattoos');
  return { name, colours, blob: swatchesFile(name, colours), file: (state.projectName || 'Ink Atlas').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) + ' colours.swatches' };
}
$('#cSwatches').addEventListener('click', async () => {
  markTried('palette');
  const p = await (paletteReady || (paletteReady = buildPalette()));
  toggle('#share', false); paletteReady = null;
  await saveFile(p.file, p.blob);
});
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
  if (moving || needsRender) { needsRender = false; drawFrame(); if(liveGuidePlan)drawLiveGuides(); placeHandles(); }
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
  aging: () => agingYears, setAging: (y) => setAging(y),
  clothes: () => ({ ...clothes.choice, report: clothesReport(), meshes: clothes.meshes().map((m) => ({ visible: m.visible, tris: m.geometry.index ? m.geometry.index.count / 3 : 0 })) }), setClothes: (next) => setClothes(next), clothesBounds: () => { clothes.sync(shapeKey, poseView.version); const [top, bottom, hair] = clothes.meshes().map((m) => { const g = m.geometry; if (!g.index) return null; const P = g.attributes.position.array, I = g.index.array, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const v of I) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[v * 3 + k]); max[k] = Math.max(max[k], P[v * 3 + k]); } return { min, max }; }); return { top, bottom, hair }; },
  pose: () => ({ active: poseView.active, key: poseView.key, settled: poseView.settled(), ...poseView.motion }), setPose: (k) => { poseView.choose(k); renderPose(); }, setPoseRotations: (r) => { poseView.setCustom(r, { animate: false }); renderPose(); }, scrubMotion: (kind, phase) => { poseView.scrub(phase, kind); renderPose(); }, viewSpot: (id) => viewSpot(state.tattoos.find((t) => t.id === id)), hitBody: (x, y) => { const h = hitBody(x, y); return h && { point: h.point.toArray(), normal: h.normal.toArray(), faceIndex: h.faceIndex }; }, posedGeometry: () => poseView.geometry, setBeforeAfterSplit: (v) => beforeAfter.setSplit(v),
  pixelAt: (x, y) => { drawFrame(); const gl = renderer.getContext(), r = renderer.getPixelRatio(), out = new Uint8Array(4); gl.readPixels(Math.round(x * r), Math.round(canvas.height - y * r - 1), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out); return [...out]; }, updateReady: onUpdateReady, updatePending: () => updateReady, settled: () => booted && !camMoving && Math.abs(goalInset - curInset) <= 0.5 && ['phi','r','tx','ty','tz'].every((k) => Math.abs(goal[k] - cur[k]) < 1e-3) && Math.abs(wrapAngle(goal.theta - cur.theta)) < 1e-3 && Math.abs(wrapAngle((goal.roll || 0) - (cur.roll || 0))) < 1e-3, inkIdsAt, selected:()=>selectedId, cur, goal, importBackup, importPainted, tapPlace:()=>tapPlaceId, liveGuides:()=>liveGuidePlan?{...structuredClone(liveGuidePlan),snapped:guideSnapApplied}:null, cameraUp:()=>camera.up.toArray(), cameraQuaternion:()=>camera.quaternion.toArray(), projectPoint:p=>screenOf(new V3(...p)),surfaceHit:(o,d)=>surfaceAt(new V3(...o),new V3(...d)),painting:()=>paint?paint.tris.size:0,
  setShape: (patch) => { reshape(() => { Object.assign(state, patch); }); commit(); },
  loadState: (s) => { state = s; selectedId = null; skinMat.color.set(skinColor()); adoptState(); commit(); },
  positions: () => bodyGeo.attributes.position.array, v1Positions: shapePositionsV1,
  store: () => store, flush: flushSave, undo, saved: () => ({ dirty, saving, text: $('#saved').textContent }),
  surfaceAt: (o, d) => surfaceAt(new V3(...o), new V3(...d)), addArt: (url, name, place) => addImage(url, name, place), commitTest: commit, imageOf: (k) => images[k],
  decalReach: () => state.tattoos.map((t) => { const d = decals[t.id], g = d && d.mesh.geometry, P = g && g.attributes.position ? g.attributes.position.array : []; let max = 0; for (let i = 0; i < P.length; i += 3) { const dist = Math.hypot(P[i] - t.pos[0], P[i + 1] - t.pos[1], P[i + 2] - t.pos[2]); if (dist > max) max = dist; } return { name: t.name, tris: P.length / 9, max, w: t.width, h: t.width / t.aspect }; }),
};
