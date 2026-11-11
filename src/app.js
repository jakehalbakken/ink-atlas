import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { INDEX, shapePositions } from './mesh.js';
import { sampleSun, sampleSprig } from './sample-art.js';
import { dataUrlBlob, shareOrDownload, canShareFiles } from './share.js';

const $ = (s) => document.querySelector(s);
const V3 = THREE.Vector3;
const SKINS = ['#f1d3bd', '#e0b394', '#c6916c', '#9a6644', '#6a422a'];
const FOV = 30;
const STENCIL = '#8474ff';

/* ---------- state ---------- */
let state = { app: 'ink-atlas-proto', v: 1, tattoos: [], skin: 1, heightCm: 175, figure: 'male', muscle: 0.2, weight: 0 };
let images = {}; // key -> dataURL
const imgEls = {}; // key -> HTMLImageElement
let selectedId = null;
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
bodyGeo.setAttribute('position', new THREE.BufferAttribute(shapePositions('legacy', 0, 0), 3));
bodyGeo.setIndex(new THREE.BufferAttribute(INDEX, 1));
bodyGeo.computeVertexNormals();
bodyGeo.computeBoundingBox(); bodyGeo.computeBoundingSphere();
let shapeKey = 'legacy';
function applyShape() {
  bodyGeo.attributes.position.array.set(shapePositions(state.figure, state.muscle, state.weight)); bodyGeo.attributes.position.needsUpdate = true;
  bodyGeo.computeVertexNormals(); bodyGeo.computeBoundingBox(); bodyGeo.computeBoundingSphere();
  shapeKey = [state.figure, state.muscle, state.weight].join(','); needsRender = true;
}
const skinMat = new THREE.MeshStandardMaterial({ color: SKINS[1], roughness: 0.6, metalness: 0 });
const body = new THREE.Mesh(bodyGeo, skinMat);
scene.add(body); body.updateMatrixWorld(true);

{ // soft floor shadow
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.001; scene.add(m);
}
const decalGroup = new THREE.Group(); scene.add(decalGroup);
const decals = {}; // id -> {mesh, outline, tex, texKey}

/* ---------- camera rig ---------- */
const cur = { theta: 0.35, phi: 1.45, r: 4.2, tx: 0, ty: 0.86, tz: 0 };
const goal = { ...cur };
let glide = true; let needsRender = true;
function fullBodyR() {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return Math.max(2.7 / (2 * t), 1.35 / (2 * t * camera.aspect));
}
function fullBody(theta) {
  if (theta != null) goal.theta = theta;
  goal.phi = 1.5; goal.r = fullBodyR(); goal.tx = 0; goal.ty = 0.73; goal.tz = 0.02; glide = true; needsRender = true;
}
function focusTattoo(t) {
  const n = new V3(...t.normal);
  goal.theta = Math.atan2(n.x, n.z);
  goal.phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)), 0.75, 2.0);
  goal.tx = t.pos[0]; goal.ty = t.pos[1]; goal.tz = t.pos[2];
  const ext = Math.max(t.width, t.width / t.aspect) * 3.0 + 0.24;
  const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  goal.r = THREE.MathUtils.clamp(ext / (2 * tn * Math.min(1, camera.aspect)), 0.45, 3.2);
  goal.ty = t.pos[1] - 2 * goal.r * tn * 0.13;
  glide = true; needsRender = true;
}
function applyCam() {
  const s = Math.sin(cur.phi);
  camera.position.set(cur.tx + cur.r * s * Math.sin(cur.theta), cur.ty + cur.r * Math.cos(cur.phi), cur.tz + cur.r * s * Math.cos(cur.theta));
  camera.lookAt(cur.tx, cur.ty, cur.tz);
  camera.updateMatrixWorld(true);
}
function stepCam(dt) {
  const k = 1 - Math.exp(-dt * (glide ? 5 : 18));
  let d = 0;
  for (const p of ['phi', 'r', 'tx', 'ty', 'tz']) { const dv = goal[p] - cur[p]; cur[p] += dv * k; d += Math.abs(dv); }
  let dth = goal.theta - cur.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); cur.theta += dth * k; d += Math.abs(dth);
  applyCam();
  if (d < 2e-4) { glide = false; return false; }
  return true;
}
function resize() {
  const w = stage.clientWidth || 800, h = stage.clientHeight || 600;
  renderer.setSize(w, h, false);
  canvas.style.width = '100%'; canvas.style.height = '100%';
  camera.aspect = w / h; camera.updateProjectionMatrix(); needsRender = true;
}
new ResizeObserver(resize).observe(stage); resize();
cur.r = fullBodyR() * 1.25; fullBody(0);

/* ---------- raycast helpers ---------- */
const ray = new THREE.Raycaster();
function ndc(x, y) { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); }
function hitBody(x, y) { ray.setFromCamera(ndc(x, y), camera); const h = ray.intersectObject(body, false)[0]; return h || null; }
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
function tattooAt(point, normal) {
  for (let i = state.tattoos.length - 1; i >= 0; i--) {
    const t = state.tattoos[i]; if (t.hidden) continue;
    if (new V3(...t.normal).dot(normal) < 0.1) continue;
    if (insideTattoo(point, t, 1.0)) return t;
  }
  return null;
}

function nearestIndex(p) { const P = bodyGeo.attributes.position.array; let best = 0, bd = Infinity; for (let i = 0; i < P.length; i += 3) { const d = (P[i] - p[0]) ** 2 + (P[i + 1] - p[1]) ** 2 + (P[i + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i / 3; } } return best; }
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
  if (imgEls[keyName]) return Promise.resolve(imgEls[keyName]);
  return new Promise((res) => { const im = new Image(); im.onload = () => { imgEls[keyName] = im; res(im); }; im.onerror = () => res(null); im.src = images[keyName]; });
}
function inkTexture(t) {
  const im = imgEls[t.img]; const c = document.createElement('canvas');
  const W = Math.min(1024, Math.max(64, im ? im.naturalWidth : 256)); c.width = W; c.height = Math.max(8, Math.round(W / t.aspect));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  if (im) { g.save(); g.globalAlpha = t.opacity ?? 0.92; if (t.flip) { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(im, 0, 0, c.width, c.height); g.restore(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function outlineTexture(aspect) {
  const c = document.createElement('canvas'); c.width = 384; c.height = Math.max(24, Math.round(384 / aspect));
  const g = c.getContext('2d'); g.strokeStyle = STENCIL; g.lineWidth = 5; g.setLineDash([14, 10]);
  g.strokeRect(5, 5, c.width - 10, c.height - 10);
  g.setLineDash([]); g.fillStyle = STENCIL;
  for (const [x, y] of [[5, 5], [c.width - 5, 5], [5, c.height - 5], [c.width - 5, c.height - 5]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function decalGeometry(t) {
  const f = frameOf(t); const w = t.width, h = t.width / t.aspect;
  const size = new V3(w, h, Math.max(0.07, Math.max(w, h) * 0.5));
  const g = new DecalGeometry(body, new V3(...t.pos), new THREE.Euler().setFromQuaternion(f.q), size);
  const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array;
  const p = [], u = [];
  for (let i = 0; i < P.length / 9; i++) {
    const a = i * 9;
    const nx = N[a] + N[a + 3] + N[a + 6], ny = N[a + 1] + N[a + 4] + N[a + 7], nz = N[a + 2] + N[a + 5] + N[a + 8];
    if ((nx * f.n.x + ny * f.n.y + nz * f.n.z) / 3 < 0.12) continue;
    for (let j = 0; j < 9; j++) p.push(P[a + j]);
    for (let j = 0; j < 6; j++) u.push(U[i * 6 + j]);
  }
  g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  return out;
}
function texKeyOf(t) { return [t.img, t.flip ? 1 : 0, (t.opacity ?? 0.92).toFixed(2), t.aspect.toFixed(3)].join('|'); }
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
    const gk = [t.pos, t.normal, t.width, t.rot, t.aspect, shapeKey].join('|');
    if (d.geoKey !== gk) { d.mesh.geometry.dispose(); const g = decalGeometry(t); d.mesh.geometry = g; d.outline.geometry = g; d.geoKey = gk; }
    d.mesh.renderOrder = 10 + i; d.outline.renderOrder = 500;
    d.mesh.visible = !t.hidden && !!d.tex; d.outline.visible = t.id === selectedId && !t.hidden && !exporting;
  });
  needsRender = true;
}
let exporting = false;

/* ---------- persistence ---------- */
let db = null;
function openDb() { return new Promise((res) => { try { const r = indexedDB.open('ink-atlas-proto', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }); }
function dbGet(k) { return new Promise((res) => { if (!db) return res(null); try { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); } catch (e) { res(null); } }); }
function dbPut(k, v) { if (!db) return; try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { /* storage unavailable */ } }
let saveTimer = 0;
function usedImages() { const o = {}; for (const t of state.tattoos) o[t.img] = images[t.img]; return o; }
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { dbPut('project', { state, images: usedImages() }); $('#saved').textContent = db ? 'Saved on this device' : 'Not saved: storage is off in this view'; }, 350);
}

/* ---------- history ---------- */
function snapshot() { undoStack.push(JSON.stringify(state)); if (undoStack.length > 40) undoStack.shift(); redoStack.length = 0; refreshUndo(); }
function restore(json) { state = JSON.parse(json); if (!state.tattoos.find((t) => t.id === selectedId)) selectedId = null; skinMat.color.set(skinColor()); applyShape(); syncDecals(); renderUI(); save(); }
function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(state)); restore(undoStack.pop()); refreshUndo(); }
function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(state)); restore(redoStack.pop()); refreshUndo(); }
function refreshUndo() { $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length; }
function commit() { syncDecals(); renderUI(); save(); }

/* ---------- tattoo ops ---------- */
const skinColor = () => state.skinHex || SKINS[state.skin] || SKINS[1];
const sel = () => state.tattoos.find((t) => t.id === selectedId) || null;
function select(id, focus) { selectedId = id; const t = sel(); syncDecals(); renderUI(); if (t && focus) focusTattoo(t); }
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
  if (!im) return null;
  let src = dataUrl;
  const max = 1024;
  if (im.naturalWidth > max || im.naturalHeight > max || dataUrl.length > 900000) {
    const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    src = c.toDataURL('image/png'); if (src.length > 1400000) { const c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height; const g = c2.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(c, 0, 0); src = c2.toDataURL('image/jpeg', 0.88); }
  }
  const k = uid(); images[k] = src; await loadImg(k);
  const p = place || nextSlot();
  const t = { id: uid(), name: name || 'Tattoo', img: k, aspect: im.naturalWidth / im.naturalHeight, pos: p.pos, normal: p.normal, width: p.width || 0.11, rot: p.rot || 0, opacity: p.opacity ?? 0.92, flip: false, locked: false, hidden: false };
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
const pts = new Map();
let gest = null; let lastTap = { t: 0, x: 0, y: 0, empty: false };
function screenOf(v) { const p = v.clone().project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; }
function two() { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; }
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 1) {
    const t = sel(); const h = hitBody(e.clientX, e.clientY);
    const onInk = !!(t && !t.locked && !t.hidden && h && h.normal.dot(new V3(...t.normal)) > 0 && insideTattoo(h.point, t));
    const sc = t ? screenOf(new V3(...t.pos)) : { x: 0, y: 0 };
    gest = { mode: onInk ? 'ink' : 'cam', sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, t0: performance.now(), moved: false, snap: false, ox: e.clientX - sc.x, oy: e.clientY - sc.y, type: e.pointerType };
  } else if (pts.size === 2 && gest) {
    const s = two(); gest.moved = true; gest.pd = s.d; gest.pa = s.ang; gest.pcx = s.cx; gest.pcy = s.cy;
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
      if (h) { if (!gest.snap) { snapshot(); gest.snap = true; } t.pos = h.point.toArray(); t.normal = h.normal.clone().normalize().toArray(); inkDirty = true; }
    }
  } else if (pts.size === 2) {
    const s = two();
    if (gest.mode === 'ink' && sel()) {
      const t = sel(); t.width = THREE.MathUtils.clamp(gest.w0 * (s.d / gest.d0), 0.012, 0.9);
      let da = s.ang - gest.a0; da = Math.atan2(Math.sin(da), Math.cos(da)); t.rot = gest.r0 - da; inkDirty = true;
    } else {
      glide = false; goal.r = THREE.MathUtils.clamp(goal.r * (gest.pd / s.d), 0.22, 7);
      const k = (2 * cur.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / canvas.getBoundingClientRect().height;
      const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0), up = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
      const mx = -(s.cx - gest.pcx) * k, my = (s.cy - gest.pcy) * k;
      goal.tx = THREE.MathUtils.clamp(goal.tx + right.x * mx + up.x * my, -0.7, 0.7);
      goal.ty = THREE.MathUtils.clamp(goal.ty + right.y * mx + up.y * my, -0.1, 1.9);
      goal.tz = THREE.MathUtils.clamp(goal.tz + right.z * mx + up.z * my, -0.5, 0.5);
      needsRender = true;
    }
    gest.pd = s.d; gest.pcx = s.cx; gest.pcy = s.cy;
  }
});
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size === 1 && gest) { const p = [...pts.values()][0]; gest.px = p.x; gest.py = p.y; const t = sel(); if (t) { const sc = screenOf(new V3(...t.pos)); gest.ox = p.x - sc.x; gest.oy = p.y - sc.y; } return; }
  if (pts.size > 0 || !gest) return;
  const g = gest; gest = null;
  if (g.snap) { commit(); }
  if (!g.moved && performance.now() - g.t0 < 450 && e.type === 'pointerup') tap(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); glide = false; goal.r = THREE.MathUtils.clamp(goal.r * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), 0.22, 7); needsRender = true; }, { passive: false });
function tap(x, y) {
  const h = hitBody(x, y); const t = h ? tattooAt(h.point, h.normal) : null; const now = performance.now();
  if (t) { select(t.id, true); lastTap = { t: 0, x, y, empty: false }; return; }
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
  if (!t) return;
  if (document.activeElement !== $('#name')) $('#name').value = t.name;
  $('#size').textContent = sizeText(t);
  $('#rSize').value = Math.round(Math.log(t.width / 0.012) / Math.log(0.9 / 0.012) * 1000);
  $('#rTurn').value = Math.round(((((t.rot * 180 / Math.PI) + 180) % 360 + 360) % 360) - 180);
  $('#rFade').value = Math.round((t.opacity ?? 0.92) * 100);
  $('#bLock').textContent = t.locked ? 'Unlock' : 'Lock in place'; $('#bLock').setAttribute('aria-pressed', t.locked ? 'true' : 'false');
  $('#bHide').textContent = t.hidden ? 'Show' : 'Hide';
  $('#bStatus').textContent = t.status === 'existing' ? 'Already on me' : 'Planned'; $('#bStatus').setAttribute('aria-pressed', t.status === 'existing' ? 'true' : 'false');
  $('#bFlip').setAttribute('aria-pressed', t.flip ? 'true' : 'false');
  $('#moveTip').textContent = t.locked ? 'Locked. Unlock to move it.' : 'Drag the tattoo to move it. Two fingers on it resize and turn. Drag anywhere else to look around.';
}
function renderBody() {
  const sw = $('#skins'); sw.replaceChildren();
  SKINS.forEach((c, i) => sw.append(el('button', { class: 'sw' + (i === state.skin && !state.skinHex ? ' on' : ''), type: 'button', style: `background:${c}`, 'aria-label': 'Skin tone ' + (i + 1), onclick: () => { snapshot(); state.skin = i; state.skinHex = null; skinMat.color.set(c); needsRender = true; renderBody(); save(); } })));
  document.querySelectorAll('[data-fig]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fig === state.figure ? 'true' : 'false'));
  $('#rMuscle').value = Math.round((state.muscle || 0) * 100); $('#rWeight').value = Math.round((state.weight || 0) * 100);
  $('#rHeight').value = state.heightCm; const inch = state.heightCm / 2.54; $('#hText').textContent = `${Math.floor(inch / 12)} ft ${Math.round(inch % 12)} in  ·  ${state.heightCm} cm`;
}
function renderUI() { renderTray(); renderSheet(); renderBody(); refreshUndo(); }
function toast(msg, action, fn) {
  const t = $('#toast'); t.replaceChildren(el('span', { text: msg })); if (action) t.append(el('button', { type: 'button', text: action, onclick: () => { fn(); t.hidden = true; } }));
  t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 5200);
}
let slideSnap = false;
function slider(id, fn) { const r = $(id); r.addEventListener('input', () => { const t = sel(); if (!t) return; if (!slideSnap) { snapshot(); slideSnap = true; } fn(t, +r.value); syncDecals(); $('#size').textContent = sizeText(t); }); r.addEventListener('change', () => { slideSnap = false; commit(); }); }
slider('#rSize', (t, v) => { t.width = 0.012 * Math.pow(0.9 / 0.012, v / 1000); });
slider('#rTurn', (t, v) => { t.rot = v * Math.PI / 180; });
slider('#rFade', (t, v) => { t.opacity = v / 100; });
$('#name').addEventListener('change', () => { const t = sel(); if (!t) return; snapshot(); t.name = $('#name').value.trim() || 'Tattoo'; commit(); });
$('#bFlip').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.flip = !t.flip; commit(); });
$('#bLock').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.locked = !t.locked; commit(); });
$('#bStatus').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.status = t.status === 'existing' ? 'planned' : 'existing'; t.locked = t.status === 'existing'; commit(); });
$('#bHide').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.hidden = !t.hidden; commit(); });
$('#bDup').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); const f = frameOf(t); const p = new V3(...t.pos).addScaledVector(f.right, t.width * 0.6).addScaledVector(f.n, 0.2); const h = surfaceAt(p, f.n.clone().negate()); const c = { ...t, id: uid(), name: t.name + ' copy', locked: false, pos: h ? h.pos : t.pos, normal: h ? h.normal : t.normal }; state.tattoos.push(c); selectedId = c.id; commit(); });
$('#bDel').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); state.tattoos = state.tattoos.filter((x) => x.id !== t.id); selectedId = null; commit(); toast(`Removed ${t.name}`, 'Undo', undo); });
$('#bDone').addEventListener('click', () => select(null));
$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$('#full').addEventListener('click', () => fullBody());
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => fullBody(+b.dataset.view * Math.PI / 2)));
$('#add').addEventListener('click', () => $('#file').click());
$('#emptyAdd').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async (e) => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
  snapshot(); let last = null; let first = true;
  for (const f of files) {
    if (/json$/i.test(f.name) || f.type === 'application/json') { await importBackup(await f.text()); continue; }
    if (!f.type.startsWith('image/')) continue;
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    const t = await addImage(url, f.name.replace(/\.[^.]+$/, '').slice(0, 40), first ? viewCenterSpot() : null); first = false; if (t) last = t;
  }
  if (last) { selectedId = last.id; commit(); focusTattoo(last); } else commit();
});
function toggle(id, show) { const n = $(id); n.hidden = show == null ? !n.hidden : !show; }
$('#bodyBtn').addEventListener('click', () => { toggle('#bodyPop'); });
$('#rHeight').addEventListener('input', () => { state.heightCm = +$('#rHeight').value; renderBody(); renderSheet(); save(); });
document.querySelectorAll('[data-fig]').forEach((b) => b.addEventListener('click', () => { if (state.figure === b.dataset.fig) return; snapshot(); reshape(() => { state.figure = b.dataset.fig; }); commit(); }));
let shapeSlide = null;
for (const [id, key] of [['#rMuscle', 'muscle'], ['#rWeight', 'weight']]) {
  $(id).addEventListener('input', () => { if (!shapeSlide) { snapshot(); shapeSlide = anchorsNow(); } state[key] = +$(id).value / 100; applyShape(); applyAnchors(shapeSlide); syncDecals(); });
  $(id).addEventListener('change', () => { shapeSlide = null; commit(); });
}
$('#shareBtn').addEventListener('click', () => toggle('#share', true));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { toggle('#' + b.dataset.close, false); }));
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (e.key === 'Escape') { toggle('#share', false); toggle('#preview', false); toggle('#bodyPop', false); } });

/* ---------- export (share sheet / download → src/share.js) ---------- */
function shot(hideInk) {
  exporting = true; decalGroup.visible = !hideInk; syncDecals(); renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  exporting = false; decalGroup.visible = true; syncDecals(); return url;
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
  toggle('#share', false); toggle('#preview', true);
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
$('#cBlank').addEventListener('click', () => showPreview(shot(true), 'ink-atlas-blank-body.png', 'Blank body to sketch on'));
$('#cBackup').addEventListener('click', () => { toggle('#share', false); saveFile('ink-atlas-project.json', JSON.stringify({ app: 'ink-atlas-proto', v: 1, state, images: usedImages() })); });
$('#cRestore').addEventListener('click', () => { toggle('#share', false); $('#file').click(); });

/* ---------- backup import (this app's files and older Ink Atlas .ink.json) ---------- */
function nearestSurface(p) {
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array; let best = -1, bd = Infinity;
  for (let i = 0; i < P.length; i += 3) { const d = (P[i] - p[0]) ** 2 + (P[i + 1] - p[1]) ** 2 + (P[i + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
  return { pos: [P[best], P[best + 1], P[best + 2]], normal: [N[best], N[best + 1], N[best + 2]], dist: Math.sqrt(bd) };
}
async function importBackup(text) {
  let data; try { data = JSON.parse(text); } catch (e) { toast('That file is not a project backup.'); return; }
  if (data && data.app === 'ink-atlas-proto' && data.state) {
    state = data.state; images = { ...images, ...data.images }; await Promise.all(Object.keys(data.images || {}).map(loadImg));
    selectedId = null; skinMat.color.set(skinColor()); adoptShape(); commit(); fullBody(); toast('Project restored'); return;
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

async function importInkJson(proj, assets) {
  const resolve = (v) => (typeof v === 'string' && v.startsWith('ink-atlas-image:') ? assets[+v.split(':')[1]] : v);
  const K = 1.75 / 1.8; // older Ink Atlas stores anchors on its original mesh at 1.8 units tall
  const lg = new THREE.BufferGeometry(); const LP = shapePositions('legacy', 0, 0);
  lg.setAttribute('position', new THREE.BufferAttribute(LP, 3)); lg.setIndex(bodyGeo.index); lg.computeVertexNormals(); lg.computeBoundingBox(); lg.computeBoundingSphere();
  const lm = new THREE.Mesh(lg, skinMat); lm.updateMatrixWorld(true);
  state.tattoos = []; selectedId = null;
  state.figure = proj.figure === 'male' ? 'male' : 'neutral'; state.muscle = 0; state.weight = 0;
  if (typeof proj.skin === 'string' && /^#[0-9a-f]{6}$/i.test(proj.skin)) state.skinHex = proj.skin;
  const hi = proj.measurements && proj.measurements.heightInches; if (typeof hi === 'number' && hi > 36 && hi < 96) state.heightCm = Math.round(THREE.MathUtils.clamp(hi * 2.54, 150, 205));
  skinMat.color.set(skinColor()); applyShape();
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array;
  let n = 0, unplaced = 0;
  for (const t of proj.tattoos.slice(0, 40)) {
    const src = resolve(t.image); if (typeof src !== 'string' || !src.startsWith('data:image')) continue;
    let place = null;
    if (Array.isArray(t.position) && Array.isArray(t.normal) && t.position.length === 3) {
      const p = new V3(...t.position).multiplyScalar(K), nn = new V3(...t.normal).normalize();
      ray.set(p.clone().addScaledVector(nn, 0.05), nn.clone().negate()); ray.far = 0.2; const h = ray.intersectObject(lm, false)[0]; ray.far = Infinity;
      let v, w;
      if (h && h.face && h.barycoord) { v = [h.face.a, h.face.b, h.face.c]; w = [h.barycoord.x, h.barycoord.y, h.barycoord.z]; }
      else { let best = 0, bd = Infinity; for (let i = 0; i < LP.length; i += 3) { const d = (LP[i] - p.x) ** 2 + (LP[i + 1] - p.y) ** 2 + (LP[i + 2] - p.z) ** 2; if (d < bd) { bd = d; best = i / 3; } } v = [best, best, best]; w = [1, 0, 0]; }
      const pp = [0, 0, 0], pn = [0, 0, 0];
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { pp[j] += P[v[k] * 3 + j] * w[k]; pn[j] += N[v[k] * 3 + j] * w[k]; }
      const l = Math.hypot(pn[0], pn[1], pn[2]) || 1;
      place = { pos: pp, normal: [pn[0] / l, pn[1] / l, pn[2] / l], width: THREE.MathUtils.clamp((t.width || 0.14) * K, 0.012, 0.9), rot: (t.rotation || 0) * Math.PI / 180, opacity: typeof t.opacity === 'number' ? t.opacity : 0.92 };
    } else unplaced++;
    const nt = await addImage(src, typeof t.name === 'string' ? t.name.slice(0, 40) : 'Tattoo', place);
    if (nt) { n++; nt.flip = !!t.flipX; nt.hidden = !!t.hidden; nt.status = t.status === 'existing' ? 'existing' : 'planned'; nt.locked = typeof t.placementLocked === 'boolean' ? t.placementLocked : t.status === 'existing'; }
  }
  lg.dispose();
  commit(); fullBody();
  toast(`Opened ${(proj.studio && proj.studio.name) || 'project'}: ${n} tattoo${n === 1 ? '' : 's'}${unplaced ? `, ${unplaced} not yet placed` : ''}`, 'Undo', undo);
}
function adoptShape() {
  if (!state.figure) { state.figure = 'legacy'; applyShape(); reshape(() => { state.figure = 'male'; state.muscle = 0.2; state.weight = 0; }); }
  else applyShape();
}
/* ---------- loop ---------- */
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (inkDirty) { inkDirty = false; syncDecals(); const t = sel(); if (t) $('#size').textContent = sizeText(t); }
  const moving = stepCam(dt);
  if (moving || needsRender) { needsRender = false; renderer.render(scene, camera); }
  requestAnimationFrame(tick);
}

/* ---------- boot ---------- */
(async function boot() {
  db = await openDb();
  const saved = await dbGet('project');
  if (saved && saved.state && Array.isArray(saved.state.tattoos)) { state = saved.state; images = saved.images || {}; await Promise.all(Object.keys(images).map(loadImg)); state.tattoos = state.tattoos.filter((t) => imgEls[t.img]); adoptShape(); }
  else { applyShape(); await seedSamples(); }
  skinMat.color.set(skinColor());
  syncDecals(); renderUI();
  $('#saved').textContent = db ? 'Saved on this device' : 'Not saved: storage is off in this view';
  let seen = false; try { seen = localStorage.getItem('ia-coach') === '1'; } catch (e) { /* no storage */ }
  $('#coach').hidden = seen;
  $('#coachOk').addEventListener('click', () => { $('#coach').hidden = true; try { localStorage.setItem('ia-coach', '1'); } catch (e) { /* no storage */ } });
  requestAnimationFrame(tick);
})();
window.__ink = { state: () => state, cur, goal, importBackup };
