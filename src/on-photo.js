// On a photo of me: your tattoos drawn onto a photo of you, where they sit on your skin.
// Everything runs on this device: MediaPipe finds how you stand (photo-pose.js poses the 3D body
// the same way and puts the camera where it stood), a second small model finds which parts of
// the photo are bare skin, and the ink the 3D body shows from that camera is multiplied onto the
// photo there, so it takes the photo's own light. The photos are never stored or sent anywhere;
// they go when the panel closes. Nothing in the project changes.
import { loadPoseFinder } from './body-match.js';
import { fitPhoto, mirrorPoints, turnPoints, exifFocal35 } from './photo-pose.js';

const base = () => (import.meta.env && import.meta.env.BASE_URL) || '/';
const MAX = 2048; // the longest side a photo is worked at

let skinReady = null;
function loadSkinFinder() {
  if (!skinReady) {
    skinReady = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(new URL(base() + 'vision', location.href).href);
      return ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL(base() + 'vision/selfie_multiclass_256x256.tflite', location.href).href, delegate: 'CPU' },
        runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
      });
    })();
    skinReady.catch(() => { skinReady = null; });
  }
  return skinReady;
}
// a mask from MediaPipe at the size w x h (nearest sample is plenty: it is softened later)
function maskAt(m, w, h) {
  const src = m.getAsFloat32Array(), mw = m.width, mh = m.height;
  if (mw === w && mh === h) return new Float32Array(src);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { const sy = Math.min(mh - 1, Math.floor((y + 0.5) * mh / h)) * mw; for (let x = 0; x < w; x++) out[y * w + x] = src[sy + Math.min(mw - 1, Math.floor((x + 0.5) * mw / w))]; }
  return out;
}

// Read one photo: the person's points and where the bare skin is. source: an image or canvas.
// Returns { canvas (the photo at most MAX on its longest side), w, h, lm2, lmW, skin, person } with
// skin and person as 0..1 per pixel of a smaller grid { sw, sh }.
export async function readPhoto(source, focal35 = null) {
  const sw0 = source.naturalWidth || source.width, sh0 = source.naturalHeight || source.height;
  if (!sw0 || !sh0) throw new Error('That photo could not be opened.');
  const k = Math.min(1, MAX / Math.max(sw0, sh0)), w = Math.round(sw0 * k), h = Math.round(sh0 * k);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(source, 0, 0, w, h);
  const k2 = Math.min(1, 1024 / Math.max(w, h)), sw = Math.round(w * k2), sh = Math.round(h * k2);
  const small = document.createElement('canvas'); small.width = sw; small.height = sh;
  small.getContext('2d').drawImage(canvas, 0, 0, sw, sh);
  const finder = await loadPoseFinder();
  const res = finder.detect(small);
  const lm2 = res.landmarks && res.landmarks[0], lmW = res.worldLandmarks && res.worldLandmarks[0];
  const pm = res.segmentationMasks && res.segmentationMasks[0];
  if (!lm2 || !lmW) { if (pm) pm.close(); throw new Error('I could not find you in that photo. Try one where your shoulders and hips show.'); }
  let person = pm ? maskAt(pm, sw, sh) : null; if (pm) pm.close();
  let skin = null;
  try {
    const seg = await loadSkinFinder(), r = seg.segment(small), masks = r.confidenceMasks || [];
    if (masks.length >= 4) {
      const body = maskAt(masks[2], sw, sh), face = maskAt(masks[3], sw, sh), bg = maskAt(masks[0], sw, sh);
      skin = new Float32Array(sw * sh); for (let i = 0; i < skin.length; i++) skin[i] = Math.min(1, body[i] + face[i]);
      if (!person) { person = new Float32Array(sw * sh); for (let i = 0; i < person.length; i++) person[i] = 1 - bg[i]; }
    }
    for (const m of masks) m.close();
  } catch (_) { /* no skin model: the person's outline is used instead */ }
  return { canvas, w, h, lm2: Array.from(lm2), lmW: Array.from(lmW), skin, person, sw, sh, focal35 };
}

// The fit for a read photo, with the two ways it can be read wrong put right on request:
// mirror (a mirror selfie, where your left looks like a right) and turn (read back to front).
export function fitRead(read, rest, head, { mirror = false, turn = false } = {}) {
  let { lm2, lmW } = read;
  if (mirror) ({ lm2, lmW } = mirrorPoints(lm2, lmW));
  if (turn) ({ lm2, lmW } = turnPoints(lm2, lmW));
  return fitPhoto({ lm2, lmW, w: read.w, h: read.h, rest, head, focal35: read.focal35 });
}

// How much ink goes on at each pixel: bare skin fully, the rest of the person (clothes, hair) not
// at all unless overClothes, nothing off the person. Softened at the edges, at the photo's size.
export function inkWeight(read, overClothes) {
  const { sw, sh, w, h } = read, src = overClothes || !read.skin ? read.person : read.skin;
  const out = new Float32Array(w * h);
  if (!src) { out.fill(1); return out; }
  // a little blur on the small grid, then up to the photo's size
  const b = new Float32Array(sw * sh), r = 1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    let s = 0, n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue; s += src[yy * sw + xx]; n++; }
    b[y * sw + x] = s / n;
  }
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) * sh / h - 0.5)), y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) * sw / w - 0.5)), x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
      const v = (b[y0 * sw + x0] * (1 - tx) + b[y0 * sw + x1] * tx) * (1 - ty) + (b[y1 * sw + x0] * (1 - tx) + b[y1 * sw + x1] * tx) * ty;
      out[y * w + x] = Math.min(1, Math.max(0, (v - 0.25) / 0.5));
    }
  }
  return out;
}

// The layer multiplied onto the photo: white where nothing changes, the ink's colour where it
// lands on skin. ink: RGBA bytes at w x h (white where there is no ink), already moved by any
// nudge; weight: inkWeight's result. Written into out (RGBA bytes).
export function inkLayer(ink, weight, out) {
  for (let i = 0, p = 0; i < weight.length; i++, p += 4) {
    const a = weight[i];
    out[p] = 255 - (255 - ink[p]) * a; out[p + 1] = 255 - (255 - ink[p + 1]) * a; out[p + 2] = 255 - (255 - ink[p + 2]) * a; out[p + 3] = 255;
  }
  return out;
}

// How sure a fit is, in words, from its average error as a share of the photo's size.
export function fitWords(fit, w, h) {
  const e = fit.error / Math.hypot(w, h);
  if (e < 0.008) return 'good';
  if (e < 0.02) return 'rough';
  return 'poor';
}

// The panel. api: { renderInk(fit, w, h, which, mirror) -> { ink: RGBA bytes, body: alpha bytes }
// or null, rest() -> rest rig, head() -> { nose, earL, earR } or null, counts() -> { planned,
// existing }, save(name, blob), toast(text), tried(key), closeOthers() }.
export function createOnPhoto(api) {
  const $ = (s) => document.querySelector(s);
  const root = $('#onPhoto'), pic = $('#opPic'), over = $('#opInk'), fitC = $('#opFit');
  const S = { photos: [], at: 0, which: 'planned', overClothes: false, showFit: false, pts: new Map(), start: null, run: 0 };
  const cur = () => S.photos[S.at];

  function say(text) { $('#opText').textContent = text; }
  function layout() {
    const p = cur(); if (!p || !p.read) return;
    const box = root.getBoundingClientRect(), k = Math.min(box.width / p.read.w, box.height / p.read.h);
    const W = p.read.w * k, H = p.read.h * k, L = (box.width - W) / 2, T = (box.height - H) / 2;
    for (const c of [pic, over, fitC]) Object.assign(c.style, { width: W + 'px', height: H + 'px', left: L + 'px', top: T + 'px' });
    S.view = { k, L, T, W, H };
    nudgeStyle();
  }
  function nudgeStyle() {
    const p = cur(); if (!p || !p.read || !S.view) return;
    const n = p.nudge, k = S.view.k, t = `translate(${n.x * k}px, ${n.y * k}px) rotate(${n.r}rad) scale(${n.s})`;
    over.style.transform = S.live ? t : ''; fitC.style.transform = t;
  }
  function counts() {
    const c = api.counts();
    return S.which === 'planned' ? c.planned : S.which === 'existing' ? c.existing : c.planned + c.existing;
  }
  function describe() {
    const p = cur(); if (!p) return;
    if (p.error) { say(p.error); return; }
    if (!p.fit) { say('Reading the photo…'); return; }
    const n = counts(), many = n !== 1;
    const what = S.which === 'planned' ? (many ? 'planned tattoos' : 'planned tattoo') : S.which === 'existing' ? (many ? 'tattoos from your skin' : 'tattoo from your skin') : (many ? 'tattoos' : 'tattoo');
    const words = fitWords(p.fit, p.read.w, p.read.h);
    const lead = n ? `${n} ${what} on your photo.` : S.which === 'existing' ? 'No tattoos marked On my skin to show.' : S.which === 'planned' ? 'No planned tattoos to show.' : 'No tattoos to show.';
    const tail = words === 'good' ? ' Drag to nudge them if they sit a little off.' : words === 'rough' ? ' This photo was harder to read, so drag, pinch or turn them into place.' : ' I could not read how you stand very well here. Try Turn it round, or drag them into place.';
    say(lead + tail + (S.photos.length > 1 ? ` Photo ${S.at + 1} of ${S.photos.length}.` : ''));
  }
  function controls() {
    const p = cur();
    document.querySelectorAll('#opWhich [data-which]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.which === S.which)));
    $('#opShowFit').setAttribute('aria-pressed', String(S.showFit)); $('#opClothes').setAttribute('aria-pressed', String(S.overClothes));
    $('#opMirror').setAttribute('aria-pressed', String(!!(p && p.mirror))); $('#opTurn').setAttribute('aria-pressed', String(!!(p && p.turn)));
    $('#opPrev').hidden = $('#opNext').hidden = S.photos.length < 2;
    $('#opPrev').disabled = S.at <= 0; $('#opNext').disabled = S.at >= S.photos.length - 1;
    const n = p && p.nudge; $('#opReset').hidden = !(n && (n.x || n.y || n.r || n.s !== 1));
    $('#opSave').disabled = !(p && p.fit && p.inkPx);
    for (const id of ['#opShowFit', '#opClothes', '#opMirror', '#opTurn']) $(id).disabled = !(p && p.read);
    fitC.hidden = !S.showFit;
  }
  // the ink for the current photo, drawn from the 3D body
  function renderInk() {
    const p = cur(); if (!p || !p.fit) return;
    const r = api.renderInk(p.fit, p.read.w, p.read.h, S.which, !!p.mirror);
    p.inkPx = r ? r.ink : null; p.bodyPx = r ? r.body : null;
    drawFit(); compose();
  }
  // the ink layer: the rendered ink moved by the nudge, weighted by the bare skin under it
  function compose() {
    const p = cur(); if (!p || !p.read) return;
    const { w, h } = p.read;
    over.width = w; over.height = h;
    const g = over.getContext('2d');
    if (!p.inkPx) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); return; }
    if (!p.weight || p.weightFor !== S.overClothes) { p.weight = inkWeight(p.read, S.overClothes); p.weightFor = S.overClothes; }
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    src.getContext('2d').putImageData(new ImageData(p.inkPx, w, h), 0, 0);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    const n = p.nudge; g.save(); g.translate(w / 2 + n.x, h / 2 + n.y); g.rotate(n.r); g.scale(n.s, n.s); g.translate(-w / 2, -h / 2); g.drawImage(src, 0, 0); g.restore();
    const im = g.getImageData(0, 0, w, h); inkLayer(im.data, p.weight, im.data); g.putImageData(im, 0, 0);
  }
  // the body's outline over the photo, to see how well it lines up
  function drawFit() {
    const p = cur(); if (!p || !p.read) return;
    const { w, h } = p.read; fitC.width = w; fitC.height = h;
    const g = fitC.getContext('2d'); g.clearRect(0, 0, w, h);
    if (!p.bodyPx) return;
    const im = g.createImageData(w, h), a = p.bodyPx, d = im.data, t = Math.max(1, Math.round(Math.max(w, h) / 600));
    for (let y = t; y < h - t; y++) for (let x = t; x < w - t; x++) {
      const i = y * w + x, on = a[i] > 127; if (!on) continue;
      if (a[i - t] > 127 && a[i + t] > 127 && a[i - t * w] > 127 && a[i + t * w] > 127) { d[i * 4] = 120; d[i * 4 + 1] = 190; d[i * 4 + 2] = 255; d[i * 4 + 3] = 40; continue; }
      d[i * 4] = 120; d[i * 4 + 1] = 200; d[i * 4 + 2] = 255; d[i * 4 + 3] = 230;
    }
    g.putImageData(im, 0, 0);
  }
  function show() {
    const p = cur(); if (!p) return;
    pic.width = p.read ? p.read.w : 1; pic.height = p.read ? p.read.h : 1;
    if (p.read) pic.getContext('2d').drawImage(p.read.canvas, 0, 0);
    else for (const c of [over, fitC]) { c.width = 1; c.height = 1; } // nothing read: no photo to show
    layout();
    if (p.fit && !p.inkPx) renderInk(); else { drawFit(); compose(); }
    describe(); controls();
  }
  function refit() {
    const p = cur(); if (!p || !p.read) return;
    try { p.fit = fitRead(p.read, api.rest(), api.head(), { mirror: p.mirror, turn: p.turn }); p.error = null; }
    catch (e) { p.fit = null; p.error = e.message || 'I could not read how you stand in this photo.'; }
    p.inkPx = null; p.bodyPx = null;
    show();
  }

  async function addFiles(files) {
    const list = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name || ''));
    if (!list.length) return;
    const run = ++S.run, first = S.photos.length;
    for (const f of list) S.photos.push({ file: f, nudge: { x: 0, y: 0, r: 0, s: 1 }, mirror: false, turn: false });
    S.at = first; say(list.length > 1 ? `Reading ${list.length} photos…` : 'Reading the photo…'); controls();
    $('#opBusy').hidden = false;
    try {
      for (let i = first; i < S.photos.length; i++) {
        const p = S.photos[i]; if (run !== S.run || root.hidden) return;
        try {
          const buf = await p.file.arrayBuffer(), focal = exifFocal35(buf);
          const img = await openImage(p.file);
          p.read = await readPhoto(img, focal); if (img.close) img.close();
          p.fit = fitRead(p.read, api.rest(), api.head());
        } catch (e) { p.error = e.message || 'That photo could not be read.'; }
        p.file = null;
        if (i === S.at) show();
      }
    } finally { if (run === S.run) $('#opBusy').hidden = true; }
    if (cur() && cur().fit) api.tried('onPhoto');
  }
  async function openImage(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { /* fall back to an image element */ }
    const url = URL.createObjectURL(file);
    try { const im = new Image(); im.src = url; await im.decode(); return im; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  function start() {
    api.closeOthers();
    root.hidden = false; root.setAttribute('aria-modal', 'true'); S.photos = []; S.at = 0; say('Pick one or more photos of you. Your shoulders and hips need to show.'); controls();
    for (const c of [pic, over, fitC]) { c.width = 1; c.height = 1; }
  }
  function open() { start(); $('#opFile').click(); }
  // straight onto photos already picked (from Match photos of me)
  function openWith(files) { start(); return addFiles(files); }
  function close() {
    S.run++; root.hidden = true; root.removeAttribute('aria-modal'); S.photos = []; S.pts.clear(); S.live = false;
    for (const c of [pic, over, fitC]) { c.width = 1; c.height = 1; } // the photos go
    $('#opFile').value = '';
  }
  async function save() {
    const p = cur(); if (!p || !p.read) return;
    const { w, h } = p.read, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(p.read.canvas, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(over, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) { api.toast('The picture could not be made.'); return; }
    await api.save(`tattoos on my photo${S.photos.length > 1 ? ' ' + (S.at + 1) : ''}.jpg`, blob);
  }

  $('#opClose').addEventListener('click', close);
  $('#opAdd').addEventListener('click', () => $('#opFile').click());
  $('#opFile').addEventListener('change', (e) => { const f = e.target.files; if (f && f.length) addFiles(f); e.target.value = ''; });
  $('#opWhich').addEventListener('click', (e) => { const b = e.target.closest('[data-which]'); if (!b) return; S.which = b.dataset.which; for (const p of S.photos) p.inkPx = null; renderInk(); describe(); controls(); });
  $('#opShowFit').addEventListener('click', () => { S.showFit = !S.showFit; controls(); });
  $('#opClothes').addEventListener('click', () => { S.overClothes = !S.overClothes; compose(); controls(); });
  $('#opMirror').addEventListener('click', () => { const p = cur(); if (!p) return; p.mirror = !p.mirror; refit(); });
  $('#opTurn').addEventListener('click', () => { const p = cur(); if (!p) return; p.turn = !p.turn; refit(); });
  $('#opReset').addEventListener('click', () => { const p = cur(); if (!p) return; p.nudge = { x: 0, y: 0, r: 0, s: 1 }; nudgeStyle(); compose(); controls(); });
  $('#opPrev').addEventListener('click', () => { if (S.at > 0) { S.at--; show(); } });
  $('#opNext').addEventListener('click', () => { if (S.at < S.photos.length - 1) { S.at++; show(); } });
  $('#opSave').addEventListener('click', save);
  addEventListener('resize', () => { if (!root.hidden) layout(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });

  // one finger moves the ink, two size and turn it (shown live as a moved layer, drawn in on lift)
  const stage = $('#opStage');
  const pt = (e) => ({ x: e.clientX, y: e.clientY });
  const begin = () => { const p = cur(); if (!p) return; const q = [...S.pts.values()]; S.start = { n: { ...p.nudge }, a: { ...q[0] }, b: q[1] ? { ...q[1] } : null }; };
  stage.addEventListener('pointerdown', (e) => {
    const p = cur(); if (!p || !p.inkPx || S.pts.size >= 2) return;
    S.pts.set(e.pointerId, pt(e)); try { stage.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
    if (!S.live) { S.live = true; compose0(); }
    begin();
  });
  // while a finger moves, the ink layer is shown without the skin weight so it can move freely
  function compose0() {
    const p = cur(); if (!p) return; const { w, h } = p.read; over.width = w; over.height = h;
    const g = over.getContext('2d'); g.putImageData(new ImageData(p.inkPx, w, h), 0, 0); nudgeStyle();
  }
  stage.addEventListener('pointermove', (e) => {
    const p = cur(); if (!p || !S.pts.has(e.pointerId) || !S.start) return; S.pts.set(e.pointerId, pt(e));
    const q = [...S.pts.values()], k = S.view.k, s0 = S.start;
    if (q.length === 1 || !s0.b) { p.nudge = { ...s0.n, x: s0.n.x + (q[0].x - s0.a.x) / k, y: s0.n.y + (q[0].y - s0.a.y) / k }; }
    else {
      const d0 = Math.hypot(s0.b.x - s0.a.x, s0.b.y - s0.a.y) || 1, d1 = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) || 1;
      const a0 = Math.atan2(s0.b.y - s0.a.y, s0.b.x - s0.a.x), a1 = Math.atan2(q[1].y - q[0].y, q[1].x - q[0].x);
      const m0 = { x: (s0.a.x + s0.b.x) / 2, y: (s0.a.y + s0.b.y) / 2 }, m1 = { x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 };
      p.nudge = { x: s0.n.x + (m1.x - m0.x) / k, y: s0.n.y + (m1.y - m0.y) / k, r: s0.n.r + a1 - a0, s: Math.min(1.6, Math.max(0.6, s0.n.s * d1 / d0)) };
    }
    nudgeStyle();
  });
  const end = (e) => {
    if (!S.pts.delete(e.pointerId)) return;
    if (S.pts.size) { begin(); return; }
    S.start = null; S.live = false; nudgeStyle(); compose(); controls();
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

  return {
    open, openWith, close, addFiles,
    get isOpen() { return !root.hidden; },
    // for tests
    state: () => ({ photos: S.photos.map((p) => ({ fit: p.fit && { error: p.fit.error, view: p.fit.view, camera: p.fit.camera, rotations: p.fit.rotations }, error: p.error, mirror: p.mirror, turn: p.turn, nudge: p.nudge, w: p.read && p.read.w, h: p.read && p.read.h })), at: S.at, which: S.which, text: $('#opText').textContent }),
    layerPixels: () => { const p = cur(); if (!p || !p.read) return null; return over.getContext('2d').getImageData(0, 0, p.read.w, p.read.h); },
    refresh: () => { const p = cur(); if (p) { p.inkPx = null; show(); } },
  };
}
