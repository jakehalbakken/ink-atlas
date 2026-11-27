// On a photo of me: your tattoos drawn onto a photo of you, where they sit on your skin.
// Everything runs on this device: MediaPipe finds how you stand (photo-pose.js poses the 3D body
// the same way and puts the camera where it stood), a second small model finds which parts of
// the photo are bare skin, and the ink the 3D body shows from that camera is multiplied onto the
// photo there, so it takes the photo's own light. The photos are never stored or sent anywhere;
// they go when the panel closes. Nothing in the project changes.
import { loadPoseFinder, releasePoseFinder } from './body-match.js';
import { fitPhoto, mirrorPoints, turnPoints, exifFocal35 } from './photo-pose.js';
import { still, moved, layerMatrix, corners, pick, groupCentre, moveOne, moveAll, twoFinger, MIN_S, MAX_S } from './photo-layers.js';

const base = () => (import.meta.env && import.meta.env.BASE_URL) || '/';
const MAX = 2048; // the longest side a photo is worked at

let skinReady = null, skinDrop = 0;
function loadSkinFinder() {
  clearTimeout(skinDrop);
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
// given back a short while after the screen closes, like the pose model (body-match.js)
function releaseSkinFinder(after = 20000) {
  clearTimeout(skinDrop);
  skinDrop = setTimeout(() => { const r = skinReady; skinReady = null; if (r) r.then((m) => { try { m.close(); } catch (e) { /* already gone */ } }, () => {}); }, after);
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
// nudge; weight: inkWeight's result. Written into out (RGBA bytes). The screen does the same on
// the graphics chip with veilOf: white laid over the ink with the alpha 1 - weight.
export function inkLayer(ink, weight, out) {
  for (let i = 0, p = 0; i < weight.length; i++, p += 4) {
    const a = weight[i];
    out[p] = 255 - (255 - ink[p]) * a; out[p + 1] = 255 - (255 - ink[p + 1]) * a; out[p + 2] = 255 - (255 - ink[p + 2]) * a; out[p + 3] = 255;
  }
  return out;
}

// The skin weight as a white veil: alpha 1 - weight, so drawing it over the ink gives
// white - (white - ink) * weight, the same as inkLayer.
export function veilOf(weight, out) {
  for (let i = 0, p = 0; i < weight.length; i++, p += 4) { out[p] = 255; out[p + 1] = 255; out[p + 2] = 255; out[p + 3] = Math.round(255 * (1 - weight[i])); }
  return out;
}

// How sure a fit is, in words, from its average error as a share of the photo's size.
export function fitWords(fit, w, h) {
  const e = fit.error / Math.hypot(w, h);
  if (e < 0.008) return 'good';
  if (e < 0.02) return 'rough';
  return 'poor';
}

// The panel. api: { renderInk(fit, w, h, mirror) -> { layers: [{ id, name, status, x, y, w, h, px }],
// body: alpha bytes } or null, rest() -> rest rig, head() -> { nose, earL, earR } or null, counts()
// -> { planned, existing }, save(name, blob), toast(text), tried(key), closeOthers() }.
// Each tattoo is its own layer on the photo (photo-layers.js): tap one to pick it, drag, pinch and
// turn it on its own, hide it from the list; with none picked a drag moves them all together.
export function createOnPhoto(api) {
  const $ = (s) => document.querySelector(s);
  const root = $('#onPhoto'), pic = $('#opPic'), over = $('#opInk'), fitC = $('#opFit'), selC = $('#opSel'), list = $('#opLayers');
  const S = { photos: [], at: 0, which: 'planned', overClothes: false, showFit: false, pts: new Map(), g: null, run: 0, sel: null, fold: null, raf: 0 };
  const cur = () => S.photos[S.at];
  const kindOk = (L) => S.which === 'all' || L.status === S.which;
  const shown = (p) => (p && p.layers ? p.layers.filter((L) => kindOk(L) && !p.off.has(L.id)) : []);
  const inKind = (p) => (p && p.layers ? p.layers.filter(kindOk) : []);
  const selLayer = () => { const p = cur(); return p && S.sel ? shown(p).find((L) => L.id === S.sel) || null : null; };
  const inkAt = (L, x, y) => { const i = (y * L.w + x) * 4, d = L.px; return d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235; };

  function say(text) { $('#opText').textContent = text; }
  function layout() {
    const p = cur(); if (!p || !p.read) return;
    // the photo goes in the room the panels leave: beside the controls when they stand as a column
    // (an iPad on its side), above them when they sit along the bottom, and under the line at the
    // top. Picking a tattoo grows the controls, so the room is measured without the picked part,
    // and the photo stays put when one is picked.
    const box = root.getBoundingClientRect(), bar = $('#opBar').getBoundingClientRect(), pk = $('#opPicked');
    const extra = pk.hidden ? 0 : pk.offsetHeight + 8;
    let l = 0, t = 0, r = box.width, b = box.height;
    const column = bar.width && bar.right - box.left < box.width * 0.45 && bar.bottom - box.top - extra < box.height * 0.9 && bar.left - box.left < 40 && bar.width < box.width * 0.4;
    if (column) { l = bar.right - box.left + 12; t = 84; b = box.height - 16; }
    else if (bar.width) { const bt = bar.top - box.top + extra - 8; if (bt - 84 > box.height * 0.45) { t = 84; b = bt; } }
    const fw = Math.max(1, r - l), fh = Math.max(1, b - t), k = Math.min(fw / p.read.w, fh / p.read.h);
    const W = p.read.w * k, H = p.read.h * k, L = l + (fw - W) / 2, T = t + (fh - H) / 2;
    for (const c of [pic, over, fitC, selC]) Object.assign(c.style, { width: W + 'px', height: H + 'px', left: L + 'px', top: T + 'px' });
    S.view = { k, L, T, W, H, box };
  }
  function describe() {
    const p = cur(); if (!p) return;
    if (p.error) { say(p.error); return; }
    if (!p.fit) { say('Reading the photo…'); return; }
    const L = selLayer(), n = shown(p).length, many = n !== 1;
    const c = api.counts(), total = S.which === 'planned' ? c.planned : S.which === 'existing' ? c.existing : c.planned + c.existing, away = Math.max(0, total - inKind(p).length);
    const what = S.which === 'planned' ? (many ? 'planned tattoos' : 'planned tattoo') : S.which === 'existing' ? (many ? 'tattoos from your skin' : 'tattoo from your skin') : (many ? 'tattoos' : 'tattoo');
    const words = fitWords(p.fit, p.read.w, p.read.h);
    const lead = n ? `${n} ${what} on your photo.` : inKind(p).length ? 'Every tattoo here is hidden.' : S.which === 'existing' ? 'No tattoos marked On my skin to show.' : S.which === 'planned' ? 'No planned tattoos to show.' : 'No tattoos to show.';
    const out = away ? ` ${away === 1 ? '1 is' : away + ' are'} out of sight from this angle.` : '';
    // with one picked, the count still leads, so hiding one with its eye says how many are left
    const tail = L ? ` ${L.name} picked. Drag to move it, pinch to size and turn it. Tap the photo away from it to move them all.` : !n ? '' : words === 'good' ? ' Tap one to move it on its own, or drag to move them all.' : words === 'rough' ? ' This photo was harder to read, so tap each one and drag, pinch or turn it into place.' : ' I could not read how you stand very well here. Try Turn it round, or tap each one and drag it into place.';
    say(lead + out + tail + (S.photos.length > 1 ? ` Photo ${S.at + 1} of ${S.photos.length}.` : ''));
  }
  function controls() {
    const p = cur(), L = selLayer();
    document.querySelectorAll('#opWhich [data-which]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.which === S.which)));
    $('#opShowFit').setAttribute('aria-pressed', String(S.showFit)); $('#opClothes').setAttribute('aria-pressed', String(S.overClothes));
    $('#opMirror').setAttribute('aria-pressed', String(!!(p && p.mirror))); $('#opTurn').setAttribute('aria-pressed', String(!!(p && p.turn)));
    $('#opPrev').hidden = $('#opNext').hidden = S.photos.length < 2;
    $('#opPrev').disabled = S.at <= 0; $('#opNext').disabled = S.at >= S.photos.length - 1;
    $('#opReset').hidden = !(p && p.layers && p.layers.some((x) => moved(x.nudge)));
    $('#opSave').disabled = !(p && p.fit && p.layers);
    for (const id of ['#opShowFit', '#opClothes', '#opMirror', '#opTurn']) $(id).disabled = !(p && p.read);
    fitC.hidden = !S.showFit;
    $('#opPicked').hidden = !L;
    if (L) {
      $('#opPickedName').textContent = L.name;
      $('#opOne').hidden = !moved(L.nudge);
      const sz = $('#rOpSize'), tu = $('#rOpTurn');
      if (!S.g) { sz.value = Math.round(L.nudge.s * 100); tu.value = Math.round(((L.nudge.r * 180 / Math.PI) % 360 + 540) % 360 - 180); }
    }
    layersList();
    root.style.setProperty('--opbar', $('#opBar').offsetHeight + 'px');
  }
  // the list of layers: one line a tattoo, top of the list drawn on top, with an eye each
  function layersList() {
    const p = cur(), ls = inKind(p);
    list.hidden = !(p && p.layers && ls.length);
    if (list.hidden) return;
    if (S.fold == null) S.fold = innerWidth < 700;
    list.classList.toggle('folded', S.fold);
    $('#opLayersFold').setAttribute('aria-expanded', String(!S.fold));
    $('#opLayersCount').textContent = String(shown(p).length);
    const box = $('#opLayersList'), key = S.at + '|' + S.which + '|' + ls.map((L) => L.id + (p.off.has(L.id) ? '-' : '+')).join(',') + '|' + S.sel;
    if (box.dataset.key === key) return; box.dataset.key = key;
    box.textContent = '';
    const all = document.createElement('button'); all.type = 'button'; all.className = 'op-row op-all'; all.dataset.layer = '';
    all.setAttribute('aria-pressed', String(!S.sel)); all.innerHTML = '<span class="op-thumb op-allmark" aria-hidden="true"></span><span class="op-name">All together</span>';
    box.append(all);
    for (const L of [...ls].reverse()) {
      const line = document.createElement('div'); line.className = 'op-line' + (p.off.has(L.id) ? ' dim' : '');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'op-row'; b.dataset.layer = L.id; b.setAttribute('aria-pressed', String(S.sel === L.id));
      const th = document.createElement('canvas'); th.className = 'op-thumb'; th.width = 80; th.height = 80;
      const g = th.getContext('2d'), k = Math.min(72 / L.w, 72 / L.h); g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, 80, 80); g.drawImage(L.canvas, 40 - L.w * k / 2, 40 - L.h * k / 2, L.w * k, L.h * k);
      const nm = document.createElement('span'); nm.className = 'op-name'; nm.textContent = L.name;
      const kd = document.createElement('span'); kd.className = 'op-kind ' + L.status; kd.textContent = L.status === 'existing' ? 'On my skin' : 'Planned';
      const tx = document.createElement('span'); tx.className = 'op-txt'; tx.append(nm, kd);
      b.append(th, tx);
      const eye = document.createElement('button'); eye.type = 'button'; eye.className = 'op-eye' + (p.off.has(L.id) ? ' off' : ''); eye.dataset.eye = L.id;
      eye.setAttribute('aria-label', (p.off.has(L.id) ? 'Show ' : 'Hide ') + L.name); eye.setAttribute('aria-pressed', String(!p.off.has(L.id)));
      eye.innerHTML = p.off.has(L.id) ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.2 3.7M6.6 6.6A17 17 0 0 0 3 12s4 6 9 6a9 9 0 0 0 4.2-1"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="3"/></svg>';
      line.append(b, eye); box.append(line);
    }
  }
  // each layer as its own little canvas, made once per photo
  function takeLayers(p, r) {
    p.layers = r ? r.layers.map((L) => {
      const c = document.createElement('canvas'); c.width = L.w; c.height = L.h; c.getContext('2d').putImageData(new ImageData(L.px, L.w, L.h), 0, 0);
      return { ...L, canvas: c, nudge: still() };
    }) : null;
    p.bodyPx = r ? r.body : null; p.off = new Set();
  }
  function renderInk() {
    const p = cur(); if (!p || !p.fit) return;
    takeLayers(p, api.renderInk(p.fit, p.read.w, p.read.h, !!p.mirror));
    if (S.sel && !p.layers?.some((L) => L.id === S.sel)) S.sel = null;
    drawFit(); compose();
  }
  // every shown layer multiplied onto white where it now sits, then the skin veil over it, all on
  // the graphics chip, so it is cheap enough to do on every finger move
  function compose() {
    const p = cur(); if (!p || !p.read) return;
    const { w, h } = p.read;
    if (over.width !== w || over.height !== h) { over.width = w; over.height = h; }
    const g = over.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    if (p.layers) {
      g.globalCompositeOperation = 'multiply';
      for (const L of shown(p)) { g.setTransform(...layerMatrix(L)); g.drawImage(L.canvas, 0, 0); }
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over';
      if (!p.veil || p.veilFor !== S.overClothes) {
        const wt = inkWeight(p.read, S.overClothes), v = document.createElement('canvas'); v.width = w; v.height = h;
        v.getContext('2d').putImageData(new ImageData(veilOf(wt, new Uint8ClampedArray(w * h * 4)), w, h), 0, 0);
        p.veil = v; p.veilFor = S.overClothes;
      }
      g.drawImage(p.veil, 0, 0);
    }
    drawSel();
  }
  const soon = () => { if (!S.raf) S.raf = requestAnimationFrame(() => { S.raf = 0; compose(); }); };
  // a dashed box round the picked layer
  function drawSel() {
    const p = cur(); if (!p || !p.read) return;
    if (selC.width !== p.read.w || selC.height !== p.read.h) { selC.width = p.read.w; selC.height = p.read.h; }
    const g = selC.getContext('2d'); g.clearRect(0, 0, selC.width, selC.height);
    const L = selLayer(); if (!L || !S.view) return;
    const q = corners(L), lw = 2 / S.view.k;
    g.lineWidth = lw * 2; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.setLineDash([]); g.beginPath(); q.forEach((c, i) => (i ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y))); g.closePath(); g.stroke();
    g.lineWidth = lw; g.strokeStyle = '#fff'; g.setLineDash([6 * lw, 4 * lw]); g.stroke();
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
    else for (const c of [over, fitC, selC]) { c.width = 1; c.height = 1; } // nothing read: no photo to show
    layout();
    if (S.sel && !(p.layers || []).some((L) => L.id === S.sel)) S.sel = null;
    if (p.fit && !p.layers) renderInk(); else { drawFit(); compose(); }
    describe(); controls();
  }
  function refit() {
    const p = cur(); if (!p || !p.read) return;
    try { p.fit = fitRead(p.read, api.rest(), api.head(), { mirror: p.mirror, turn: p.turn }); p.error = null; }
    catch (e) { p.fit = null; p.error = e.message || 'I could not read how you stand in this photo.'; }
    p.layers = null; p.bodyPx = null; S.sel = null;
    show();
  }
  function pickLayer(id) { S.sel = id || null; if (id) api.tried('photoLayers'); compose(); describe(); controls(); }

  async function addFiles(files) {
    const items = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name || ''));
    if (!items.length) return;
    const run = ++S.run, first = S.photos.length;
    for (const f of items) S.photos.push({ file: f, mirror: false, turn: false, layers: null, off: new Set() });
    S.at = first; S.sel = null; say(items.length > 1 ? `Reading ${items.length} photos…` : 'Reading the photo…'); controls();
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
    root.hidden = false; root.setAttribute('aria-modal', 'true'); S.photos = []; S.at = 0; S.sel = null; say('Pick one or more photos of you. Your shoulders and hips need to show.'); controls();
    for (const c of [pic, over, fitC, selC]) { c.width = 1; c.height = 1; }
  }
  function open() { start(); $('#opFile').click(); }
  // straight onto photos already picked (from Match photos of me)
  function openWith(files) { start(); return addFiles(files); }
  function close() {
    S.run++; root.hidden = true; root.removeAttribute('aria-modal'); S.photos = []; S.pts.clear(); S.g = null; S.sel = null;
    for (const c of [pic, over, fitC, selC]) { c.width = 1; c.height = 1; } // the photos go
    $('#opLayersList').textContent = ''; delete $('#opLayersList').dataset.key;
    $('#opFile').value = '';
    releasePoseFinder(); releaseSkinFinder();
  }
  async function save() {
    const p = cur(); if (!p || !p.read) return;
    const { w, h } = p.read, c = document.createElement('canvas'); c.width = w; c.height = h;
    const sel = S.sel; S.sel = null; compose(); // no box round a picked one in the picture
    const g = c.getContext('2d'); g.drawImage(p.read.canvas, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(over, 0, 0);
    S.sel = sel; drawSel();
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) { api.toast('The picture could not be made.'); return; }
    await api.save(`tattoos on my photo${S.photos.length > 1 ? ' ' + (S.at + 1) : ''}.jpg`, blob);
  }

  $('#opClose').addEventListener('click', close);
  $('#opAdd').addEventListener('click', () => $('#opFile').click());
  $('#opFile').addEventListener('change', (e) => { const f = e.target.files; if (f && f.length) addFiles(f); e.target.value = ''; });
  $('#opWhich').addEventListener('click', (e) => { const b = e.target.closest('[data-which]'); if (!b) return; S.which = b.dataset.which; if (S.sel && !selLayer()) S.sel = null; compose(); describe(); controls(); });
  $('#opShowFit').addEventListener('click', () => { S.showFit = !S.showFit; controls(); });
  $('#opClothes').addEventListener('click', () => { S.overClothes = !S.overClothes; compose(); controls(); });
  $('#opMirror').addEventListener('click', () => { const p = cur(); if (!p) return; p.mirror = !p.mirror; refit(); });
  $('#opTurn').addEventListener('click', () => { const p = cur(); if (!p) return; p.turn = !p.turn; refit(); });
  $('#opReset').addEventListener('click', () => { const p = cur(); if (!p || !p.layers) return; for (const L of p.layers) L.nudge = still(); compose(); describe(); controls(); });
  $('#opPrev').addEventListener('click', () => { if (S.at > 0) { S.at--; S.sel = null; show(); } });
  $('#opNext').addEventListener('click', () => { if (S.at < S.photos.length - 1) { S.at++; S.sel = null; show(); } });
  $('#opSave').addEventListener('click', save);
  $('#opLayersFold').addEventListener('click', () => { S.fold = !S.fold; layersList(); });
  $('#opLayersList').addEventListener('click', (e) => {
    const p = cur(); if (!p) return;
    const eye = e.target.closest('[data-eye]');
    if (eye) { const id = eye.dataset.eye; if (p.off.has(id)) p.off.delete(id); else { p.off.add(id); if (S.sel === id) S.sel = null; } compose(); describe(); controls(); return; }
    const row = e.target.closest('[data-layer]'); if (!row) return;
    const id = row.dataset.layer; if (id && p.off.has(id)) p.off.delete(id);
    pickLayer(id || null);
  });
  $('#opHide').addEventListener('click', () => { const p = cur(), L = selLayer(); if (!p || !L) return; p.off.add(L.id); S.sel = null; compose(); describe(); controls(); });
  $('#opOne').addEventListener('click', () => { const L = selLayer(); if (!L) return; L.nudge = still(); compose(); controls(); });
  $('#opUnpick').addEventListener('click', () => pickLayer(null));
  $('#rOpSize').addEventListener('input', () => { const L = selLayer(); if (!L) return; L.nudge = { ...L.nudge, s: Math.min(MAX_S, Math.max(MIN_S, +$('#rOpSize').value / 100)) }; soon(); $('#opOne').hidden = !moved(L.nudge); $('#opReset').hidden = false; });
  $('#rOpTurn').addEventListener('input', () => { const L = selLayer(); if (!L) return; L.nudge = { ...L.nudge, r: +$('#rOpTurn').value * Math.PI / 180 }; soon(); $('#opOne').hidden = !moved(L.nudge); $('#opReset').hidden = false; });
  // the screen turning or the iPad's visual viewport changing size resizes #viewport after the
  // window's own resize event, so the photo is laid out again when the screen itself has changed
  const relayout = () => { if (!root.hidden) { layout(); drawSel(); } };
  // the line at the top wraps to more lines on a narrow screen: the list of tattoos starts under it
  const topLine = () => root.style.setProperty('--optop', Math.round($('#opTop').getBoundingClientRect().bottom - root.getBoundingClientRect().top + 6) + 'px');
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(relayout); ro.observe(root); ro.observe($('#opBar')); new ResizeObserver(topLine).observe($('#opTop')); }
  addEventListener('resize', () => requestAnimationFrame(relayout));
  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') { if (S.sel) pickLayer(null); else close(); e.preventDefault(); return; }
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable=true]')) return;
    const L = selLayer(); if (!L || !S.view) return;
    const step = (e.shiftKey ? 20 : 2) / S.view.k, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) L.nudge = moveOne(L.nudge, { dx: d[0], dy: d[1] });
    else if (e.key === '[' || e.key === ']') L.nudge = moveOne(L.nudge, { dr: (e.key === ']' ? 1 : -1) * (e.shiftKey ? 15 : 3) * Math.PI / 180 });
    else if (e.key === '-' || e.key === '=') L.nudge = moveOne(L.nudge, { ds: e.key === '=' ? 1.05 : 1 / 1.05 });
    else return;
    e.preventDefault(); compose(); controls();
  });

  // A touch that starts on a tattoo's ink picks that one and moves it alone; with one picked, a
  // touch elsewhere still moves it; with none picked it moves them all. Two fingers size and turn
  // whatever the first finger took. A tap away from every tattoo puts them back together.
  const stage = $('#opStage');
  const toPhoto = (e) => { const v = S.view; return { x: (e.clientX - v.box.left - v.L) / v.k, y: (e.clientY - v.box.top - v.T) / v.k }; };
  const begin = () => {
    if (!S.g) return;
    const p = cur(), q = [...S.pts.values()], who = S.g.who;
    const ls = who === 'all' ? shown(p) : shown(p).filter((L) => L.id === who);
    S.g = { ...S.g, ls, starts: new Map(ls.map((L) => [L.id, { ...L.nudge }])), a: { ...q[0] }, b: q[1] ? { ...q[1] } : null };
    if (who === 'all') S.g.pivot = groupCentre(ls);
  };
  stage.addEventListener('pointerdown', (e) => {
    const p = cur();
    // a first finger (or the mouse) starts a new gesture: drop any finger whose lift never arrived
    if (e.isPrimary && S.pts.size) { S.pts.clear(); S.g = null; }
    S.down = { at: null, hit: null, why: '' };
    if (!p || !p.layers || !S.view) { S.down.why = 'not ready'; return; }
    if (S.pts.size >= 2) { S.down.why = 'two fingers already'; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const at = toPhoto(e);
    S.pts.set(e.pointerId, at); try { stage.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
    if (S.pts.size === 1 || !S.g) {
      const hit = pick(shown(p), at.x, at.y, 22 / S.view.k, inkAt);
      S.down = { at, hit: hit ? hit.id : null, why: 'picked' };
      if (hit && hit.id !== S.sel) { S.sel = hit.id; api.tried('photoLayers'); describe(); controls(); drawSel(); }
      S.g = { who: hit ? hit.id : S.sel || 'all', onEmpty: !hit, moved: false, x0: e.clientX, y0: e.clientY };
    }
    begin();
  });
  stage.addEventListener('pointermove', (e) => {
    const p = cur(); if (!p || !S.pts.has(e.pointerId) || !S.g) return;
    S.pts.set(e.pointerId, toPhoto(e));
    if (!S.g.moved && Math.hypot(e.clientX - S.g.x0, e.clientY - S.g.y0) < 6 && S.pts.size < 2) return;
    S.g.moved = true;
    const q = [...S.pts.values()], g = S.g;
    let m;
    if (q.length === 1 || !g.b) m = { dx: q[0].x - g.a.x, dy: q[0].y - g.a.y };
    else m = twoFinger(g.a, g.b, q[0], q[1]);
    if (g.who === 'all') {
      const next = moveAll(g.ls, g.starts, m.mid0 || g.pivot, m);
      for (const L of g.ls) L.nudge = next.get(L.id);
    } else for (const L of g.ls) L.nudge = moveOne(g.starts.get(L.id), m);
    soon();
  });
  const end = (e) => {
    if (!S.pts.delete(e.pointerId)) return;
    if (S.pts.size) { begin(); return; }
    const g = S.g; S.g = null;
    if (g && !g.moved && g.onEmpty && S.sel) { pickLayer(null); return; } // a tap away from every tattoo
    compose(); describe(); controls();
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end); stage.addEventListener('lostpointercapture', end);

  return {
    open, openWith, close, addFiles,
    get isOpen() { return !root.hidden; },
    // for tests
    state: () => ({
      photos: S.photos.map((p) => ({ fit: p.fit && { error: p.fit.error, view: p.fit.view, camera: p.fit.camera, rotations: p.fit.rotations }, error: p.error, mirror: p.mirror, turn: p.turn,
        layers: p.layers && p.layers.map((L) => ({ id: L.id, name: L.name, status: L.status, x: L.x, y: L.y, w: L.w, h: L.h, nudge: { ...L.nudge }, hidden: p.off.has(L.id) })),
        w: p.read && p.read.w, h: p.read && p.read.h })),
      at: S.at, which: S.which, sel: S.sel, down: S.down || null, text: $('#opText').textContent, view: S.view && { k: S.view.k, L: S.view.L + S.view.box.left, T: S.view.T + S.view.box.top },
    }),
    layerPixels: () => { const p = cur(); if (!p || !p.read) return null; return over.getContext('2d').getImageData(0, 0, p.read.w, p.read.h); },
    refresh: () => { const p = cur(); if (p) { p.layers = null; show(); } },
  };
}
