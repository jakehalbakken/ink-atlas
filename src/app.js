import * as THREE from 'three';
import { INDEX, INDEX_ALL, COUNTS, shapePositions, shapePositionsV1, legacyPositions } from './mesh.js';
import { FIT_GROUPS, fitVisible, fitFromV47 } from './fit.js';
import { createSkin, updateSkin } from './skin.js';
import { buildAdjacency, buildDecal, UV_MARGIN } from './decal.js';
import './slider.js';
import { cleanState, imageKeysFor } from './project.js';
import { editArtwork } from './cleanup.js';
import { openStore } from './store.js';
import { sampleSun, sampleSprig } from './sample-art.js';
import { dataUrlBlob, shareOrDownload, canShareFiles } from './share.js';

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
  shapeKey++; needsRender = true;
}
function applyShape() { setBodyPositions(shapePositions(state), genitalsShown()); }
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
  const { positions, uvs } = buildDecal(bodyGeo, bodyAdjacency(), t, frameOf(t), startTriangle(t));
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
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
    d.mesh.visible = !t.hidden && !!d.tex; d.outline.visible = t.id === selectedId && !t.hidden && !exporting;
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
function cancelGesture() {
  const g = gest; gest = null;
  const ids = [...pts.keys()]; pts.clear();
  for (const id of ids) { try { canvas.releasePointerCapture(id); } catch (_) { /* already released */ } }
  if (g?.snap) commit();
}
function endPointer(e) {
  if (e.type === 'pointercancel') { cancelGesture(); return; }
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size === 1 && gest) { const p = [...pts.values()][0]; gest.px = p.x; gest.py = p.y; const t = sel(); if (t) { const sc = screenOf(new V3(...t.pos)); gest.ox = p.x - sc.x; gest.oy = p.y - sc.y; } return; }
  if (pts.size > 0 || !gest) return;
  const g = gest; gest = null;
  if (g.snap) { commit(); }
  if (!g.moved && performance.now() - g.t0 < 450 && e.type === 'pointerup') tap(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', e=>{if(pts.has(e.pointerId))cancelGesture();});
window.addEventListener('blur',cancelGesture);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
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
  $('#bCleanup').disabled=!!t.locked; $('#bFlipVertical').disabled=!!t.locked;
  $('#rSize').value = Math.round(Math.log(t.width / 0.012) / Math.log(0.9 / 0.012) * 1000);
  $('#rTurn').value = Math.round(((((t.rot * 180 / Math.PI) + 180) % 360 + 360) % 360) - 180);
  $('#rFade').value = Math.round((t.opacity ?? 0.92) * 100);
  $('#rWrap').value = Math.round((t.wrap || 0) * 100); $('#rBend').value = Math.round((t.bend || 0) * 100); $('#rTaper').value = Math.round((t.taper || 0) * 100);
  const shaped = (t.wrap || 0) || (t.bend || 0) || (t.taper || 0); $('#wrapMark').textContent = shaped ? 'on' : ''; if (!shaped && !$('#wrapBox').open) { /* leave closed */ }
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
  $('#rMuscle').value = Math.round((state.muscle ?? 0.5) * 100); $('#rWeight').value = Math.round((state.weight ?? 0.5) * 100);
  syncFitUI();
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
slider('#rWrap', (t, v) => { t.wrap = v / 100; });
slider('#rBend', (t, v) => { t.bend = v / 100; });
slider('#rTaper', (t, v) => { t.taper = v / 100; });
$('#name').addEventListener('change', () => { const t = sel(); if (!t) return; snapshot(); t.name = $('#name').value.trim() || 'Tattoo'; commit(); });
$('#bFlip').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.flip = !t.flip; commit(); });
$('#bLock').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.locked = !t.locked; commit(); });
$('#bStatus').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.status = t.status === 'existing' ? 'planned' : 'existing'; t.locked = t.status === 'existing'; commit(); });
$('#bHide').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.hidden = !t.hidden; commit(); });
$('#bDup').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); const f = frameOf(t); const p = new V3(...t.pos).addScaledVector(f.right, t.width * 0.6).addScaledVector(f.n, 0.2); const h = surfaceAt(p, f.n.clone().negate()); const c = { ...t, id: uid(), name: t.name + ' copy', locked: false, pos: h ? h.pos : t.pos, normal: h ? h.normal : t.normal }; state.tattoos.push(c); selectedId = c.id; commit(); });
$('#bDel').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); state.tattoos = state.tattoos.filter((x) => x.id !== t.id); selectedId = null; commit(); toast(`Removed ${t.name}`, 'Undo', undo); });
async function cleanupSelected() {
  const t=sel();if(!t)return;if(t.locked){toast('Unlock this tattoo before editing its artwork.');return;}
  cancelGesture();const id=t.id,prior=t.img,art=state.artworks?.[t.artworkId],source=art?.source||prior;
  try{
    const result=await editArtwork(images[source]||images[prior],images[prior]);if(!result)return;
    const current=state.tattoos.find(x=>x.id===id);
    if(!current||current.img!==prior||current.locked){toast('The artwork changed while cleanup was open. Nothing was replaced.');return;}
    const key=uid();images[key]=result.dataUrl;const decoded=await loadImg(key);if(!decoded){delete images[key];toast('The cleaned image could not be opened. Nothing changed.');return;}
    snapshot();state.artworks||={};const artworkId=uid();state.artworks[artworkId]={...(art||{}),source,output:key,name:current.name};
    current.artworkId=artworkId;current.img=key;current.aspect=result.aspect;commit();toast('Artwork updated. Original kept.','Undo',undo);
  }catch(e){toast('Could not clean up artwork: '+e.message);}
}
$('#bCleanup').addEventListener('click',cleanupSelected);
$('#bFlipVertical').addEventListener('click',()=>{const t=sel();if(!t||t.locked)return;snapshot();t.imageTopDown=!t.imageTopDown;commit();});
$('#bDone').addEventListener('click', () => select(null));
$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$('#full').addEventListener('click', () => { cancelGesture(); toggle('#bodyPop', false); select(null); fullBody(); });
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => fullBody(+b.dataset.view * Math.PI / 2)));
$('#add').addEventListener('click', () => $('#file').click());
$('#emptyAdd').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async (e) => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
  snapshot(); let last = null; let first = true;
  for (const f of files) {
    if (/json$/i.test(f.name) || f.type === 'application/json') { if (f.size > 300e6) { toast('That file is too large to open here.'); continue; } await importBackup(await f.text()); continue; }
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {toast('Choose a PNG, JPEG or WebP picture.');continue;}
    if (f.size > 10*1024*1024) { toast('Use a picture smaller than 10 MiB.'); continue; }
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); });
    if (typeof url !== 'string') continue;
    const t = await addImage(url, f.name.replace(/\.[^.]+$/, '').slice(0, 100), first ? viewCenterSpot() : null); if (t) {first = false;last = t;}
  }
  if (last) { selectedId = last.id; commit(); focusTattoo(last); } else commit();
});
function toggle(id, show) { const n = $(id); n.hidden = show == null ? !n.hidden : !show; if (id === '#bodyPop') updateInset(); }
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
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 || !(e.target instanceof Element) || !e.target.closest('.pop,.modal,#trayItems,#sheet,[aria-modal=true]')) e.preventDefault();
}, { passive: false });
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
if ('serviceWorker' in navigator) { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); }); }
$('#shareBtn').addEventListener('click', () => toggle('#share', true));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { toggle('#' + b.dataset.close, false); }));
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (e.key === 'Escape') { toggle('#share', false); toggle('#preview', false); toggle('#recover', false); toggle('#bodyPop', false); } });

/* ---------- export (share sheet / download → src/share.js) ---------- */
function shot(hideInk) {
  const inset = curInset; curInset = 0; applyInset(); // exports are always centred, panel open or not
  exporting = true; decalGroup.visible = !hideInk; syncDecals(); renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  exporting = false; decalGroup.visible = true; syncDecals(); curInset = inset; applyInset(); needsRender = true; return url;
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
  catch (e) { state = JSON.parse(before); selectedId = null; skinMat.color.set(skinColor()); applyShape(); commit(); toast('That backup is damaged, so nothing was changed.'); }
}
async function readInkJson(proj, assets) {
  const resolve = (v) => (typeof v === 'string' && v.startsWith('ink-atlas-image:') ? assets[+v.split(':')[1]] : v);
  const K = 1.75 / 1.8; // older Ink Atlas stores anchors on its original mesh at 1.8 units tall
  const lg = new THREE.BufferGeometry(); const LP = legacyPositions();
  lg.setAttribute('position', new THREE.BufferAttribute(LP, 3)); lg.setIndex(idxBody); lg.computeVertexNormals(); lg.computeBoundingBox(); lg.computeBoundingSphere();
  const lm = new THREE.Mesh(lg, skinMat); lm.updateMatrixWorld(true);
  state.tattoos = []; selectedId = null;
  state.figure = proj.figure === 'male' ? 'male' : 'neutral'; state.muscle = 0.5; state.weight = 0.5; state.v = 2;
  state.fit = fitFromV47(proj.studio && proj.studio.bodyFit); if (state.genitals == null) state.genitals = true;
  if (typeof proj.skin === 'string' && /^#[0-9a-f]{6}$/i.test(proj.skin)) state.skinHex = proj.skin;
  const hi = proj.measurements && proj.measurements.heightInches; if (typeof hi === 'number' && hi > 36 && hi < 96) state.heightCm = Math.round(THREE.MathUtils.clamp(hi * 2.54, 150, 205));
  skinMat.color.set(skinColor()); applyShape();
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array;
  let n = 0, unplaced = 0;
  for (const t of proj.tattoos.slice(0, 40)) {
    if (!t || typeof t !== 'object') continue;
    const src = resolve(t.image); if (typeof src !== 'string' || !src.startsWith('data:image')) continue;
    let place = null;
    if (ok3(t.position) && ok3(t.normal) && Math.hypot(t.normal[0], t.normal[1], t.normal[2]) > 0.5) {
      const p = new V3(...t.position).multiplyScalar(K), nn = new V3(...t.normal).normalize();
      ray.set(p.clone().addScaledVector(nn, 0.05), nn.clone().negate()); ray.far = 0.2; const h = ray.intersectObject(lm, false)[0]; ray.far = Infinity;
      let v, w;
      if (h && h.face && h.barycoord) { v = [h.face.a, h.face.b, h.face.c]; w = [h.barycoord.x, h.barycoord.y, h.barycoord.z]; }
      else { let best = 0, bd = Infinity; for (let i = 0; i < LP.length; i += 3) { const d = (LP[i] - p.x) ** 2 + (LP[i + 1] - p.y) ** 2 + (LP[i + 2] - p.z) ** 2; if (d < bd) { bd = d; best = i / 3; } } v = [best, best, best]; w = [1, 0, 0]; }
      const pp = [0, 0, 0], pn = [0, 0, 0];
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { pp[j] += P[v[k] * 3 + j] * w[k]; pn[j] += N[v[k] * 3 + j] * w[k]; }
      const l = Math.hypot(pn[0], pn[1], pn[2]) || 1;
      place = { pos: pp, normal: [pn[0] / l, pn[1] / l, pn[2] / l], width: THREE.MathUtils.clamp((fin(t.width) && t.width > 0 ? t.width : 0.14) * K, 0.012, 0.9), rot: (fin(t.rotation) ? t.rotation : 0) * Math.PI / 180, opacity: fin(t.opacity) ? THREE.MathUtils.clamp(t.opacity, 0.1, 1) : 0.92 };
    } else unplaced++;
    const nt = await addImage(src, typeof t.name === 'string' ? t.name.slice(0, 40) : 'Tattoo', place);
    if (nt) { n++; delete nt.imageTopDown; nt.flip = !!t.flipX; nt.hidden = !!t.hidden; nt.status = t.status === 'existing' ? 'existing' : 'planned'; nt.locked = typeof t.placementLocked === 'boolean' ? t.placementLocked : t.status === 'existing';
      if (fin(t.wrap) && t.wrap) nt.wrap = Math.max(0, Math.min(1, t.wrap)); if (fin(t.bend) && t.bend) nt.bend = Math.max(-1, Math.min(1, t.bend)); if (fin(t.taper) && t.taper) nt.taper = Math.max(-0.75, Math.min(0.75, t.taper)); }
  }
  lg.dispose();
  if (!n && proj.tattoos.length) throw new Error('No usable artwork in that backup');
  commit(); fullBody();
  toast(`Opened ${(proj.studio && proj.studio.name) || 'project'}: ${n} tattoo${n === 1 ? '' : 's'}${unplaced ? `, ${unplaced} not yet placed` : ''}`, 'Undo', undo);
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
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (inkDirty) { inkDirty = false; syncDecals(); const t = sel(); if (t) $('#size').textContent = sizeText(t); }
  if (Math.abs(goalInset - curInset) > 0.5) { curInset += (goalInset - curInset) * (1 - Math.exp(-dt * 12)); if (Math.abs(goalInset - curInset) <= 0.5) curInset = goalInset; applyInset(); needsRender = true; }
  const moving = stepCam(dt);
  if (moving || needsRender) { needsRender = false; renderer.render(scene, camera); }
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
  requestAnimationFrame(tick);
})();
// Test hooks for tools/tests. loadState runs the same upgrade path a saved project takes on open.
window.__ink = {
  state: () => state, cur, goal, importBackup,
  setShape: (patch) => { reshape(() => { Object.assign(state, patch); }); commit(); },
  loadState: (s) => { state = s; selectedId = null; skinMat.color.set(skinColor()); adoptState(); commit(); },
  positions: () => bodyGeo.attributes.position.array, v1Positions: shapePositionsV1,
  store: () => store, flush: flushSave, undo, saved: () => ({ dirty, saving, text: $('#saved').textContent }),
  surfaceAt: (o, d) => surfaceAt(new V3(...o), new V3(...d)), addArt: (url, name, place) => addImage(url, name, place), commitTest: commit,
  decalReach: () => state.tattoos.map((t) => { const d = decals[t.id], g = d && d.mesh.geometry, P = g && g.attributes.position ? g.attributes.position.array : []; let max = 0; for (let i = 0; i < P.length; i += 3) { const dist = Math.hypot(P[i] - t.pos[0], P[i + 1] - t.pos[1], P[i + 2] - t.pos[2]); if (dist > max) max = dist; } return { name: t.name, tris: P.length / 9, max, w: t.width, h: t.width / t.aspect }; }),
};
