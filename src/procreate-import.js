// Back from Procreate: the painted 3D model (USDZ, or OBJ in a ZIP, or just its skin
// picture) comes back, and whatever was drawn on the skin becomes tattoos on the body.
//
// The model went out with our own texture layout (uv-bake.js), so the skin picture that
// comes back lines up with the body triangle for triangle. New drawing is found by
// comparing it with the same skin baked again here (plain skin plus the tattoos that are
// already on the body), separate drawings are grouped by where they sit on the body, and
// each group is photographed straight on from the body, which is exactly how a tattoo is
// projected back onto the skin. Nothing on the body changes until the new tattoos are added.
import { bodyCornerUVs } from './uv-bake.js';
import { UV_BODY_TRIS } from './body-uv.js';

/* ---------- reading the file ---------- */
const IMAGE = /\.(png|jpe?g)$/i;

// ZIP and USDZ (a ZIP whose files are stored, not compressed). Deflated entries are
// opened with the browser's own DecompressionStream.
export async function readZip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let end = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('That file is not a model Ink Atlas can read.');
  const count = dv.getUint16(end + 10, true), out = [];
  let p = dv.getUint32(end + 16, true);
  if (count > 4096) throw new Error('That file has too many parts.');
  for (let k = 0; k < count; k++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('That model file is damaged.');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    if (local + 30 > u8.length || dv.getUint32(local, true) !== 0x04034b50) throw new Error('That model file is damaged.');
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    if (start + csize > u8.length) throw new Error('That model file is cut short.');
    const raw = u8.subarray(start, start + csize);
    out.push({ name, method, size: usize, read: async () => {
      if (method === 0) return raw;
      if (method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('That model file is packed in a way this browser cannot open.');
      if (usize > 300e6) throw new Error('That model file is too large.');
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } });
  }
  return out;
}

// The skin picture inside a painted model: the colour texture, not roughness or normals.
export function pickTexture(entries) {
  const imgs = entries.filter((e) => IMAGE.test(e.name) && !/(^|[/_.-])(normal|rough|metal|occlusion|ao|height|bump|spec)/i.test(e.name.split('/').pop()));
  if (!imgs.length) return null;
  const named = imgs.filter((e) => /(color|colour|albedo|diffuse|base|skin)/i.test(e.name.split('/').pop()));
  return (named.length ? named : imgs).sort((a, b) => b.size - a.size)[0];
}

// File -> Blob of the skin picture.
export async function skinPictureOf(file) {
  const name = file.name || '';
  if (IMAGE.test(name) || /^image\/(png|jpeg)$/.test(file.type)) return file;
  const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
  const tex = pickTexture(entries);
  if (!tex) throw new Error('No skin picture was found in that model. Export it from Procreate as USDZ or OBJ.');
  return new Blob([await tex.read()], { type: /\.png$/i.test(tex.name) ? 'image/png' : 'image/jpeg' });
}

/* ---------- where each texture pixel sits on the body ---------- */
// Pixel (x, y) of a size x size picture (rows from the top) is u = (x + .5) / size,
// v = 1 - (y + .5) / size, matching the picture bakeSkin makes.
export function triangleMap(size) {
  const uv = bodyCornerUVs(), map = new Int32Array(size * size).fill(-1);
  for (let t = 0; t < UV_BODY_TRIS; t++) {
    const o = t * 6, ax = uv[o] * size - 0.5, ay = (1 - uv[o + 1]) * size - 0.5, bx = uv[o + 2] * size - 0.5, by = (1 - uv[o + 3]) * size - 0.5, cx = uv[o + 4] * size - 0.5, cy = (1 - uv[o + 5]) * size - 0.5;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w1 = ((x - ax) * (cy - ay) - (y - ay) * (cx - ax)) / area, w2 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / area;
      if (w1 >= -0.02 && w2 >= -0.02 && w1 + w2 <= 1.02) map[y * size + x] = t;
    }
  }
  return map;
}

// The skin colour of a picture: its most common colour (on the body's own pixels when
// a map is given; the whole picture when its way up is not known yet).
export function skinColorOf(pixels, map) {
  const bins = new Map();
  for (let p = 0; p < pixels.length / 4; p += 3) {
    if (map && map[p] < 0) continue;
    const o = p * 4, k = (pixels[o] >> 3) << 10 | (pixels[o + 1] >> 3) << 5 | pixels[o + 2] >> 3;
    let b = bins.get(k); if (!b) bins.set(k, (b = [0, 0, 0, 0]));
    b[0]++; b[1] += pixels[o]; b[2] += pixels[o + 1]; b[3] += pixels[o + 2];
  }
  let best = null; for (const b of bins.values()) if (!best || b[0] > best[0]) best = b;
  if (!best) throw new Error('That picture does not look like an Ink Atlas skin.');
  return [Math.round(best[1] / best[0]), Math.round(best[2] / best[0]), Math.round(best[3] / best[0])];
}

const PAINT_MIN = 34, PAINT_FULL = 90; // colour difference (0..441) from "no drawing" to "fully drawn"
export const paintAlpha = (d) => Math.min(1, Math.max(0, (d - PAINT_MIN) / (PAINT_FULL - PAINT_MIN)));
const diff = (a, b, p) => Math.hypot(a[p] - b[p], a[p + 1] - b[p + 1], a[p + 2] - b[p + 2]);

// New drawing, grouped by where it sits on the body. positions / normals / index: the
// rest body. Returns groups of body points with their average normal, biggest first.
export function findDrawings({ pixels, baseline, map, size, positions, normals, index, skin, minPixels = 24, joinGap = 0.02, maxPieces = 60 }) {
  const painted = new Uint8Array(size * size), skinPx = skin ? [skin[0], skin[1], skin[2]] : null;
  let count = 0, body = 0;
  for (let p = 0; p < map.length; p++) {
    if (map[p] < 0) continue; body++;
    if (diff(pixels, baseline, p * 4) <= PAINT_MIN) continue;
    // painted back to plain skin (ink rubbed out) is not new ink
    if (skinPx && Math.hypot(pixels[p * 4] - skinPx[0], pixels[p * 4 + 1] - skinPx[1], pixels[p * 4 + 2] - skinPx[2]) <= PAINT_MIN) continue;
    painted[p] = 1; count++;
  }
  if (count > body * 0.4) throw new Error('That model does not match this body. Open it in the project it was exported from.');
  // connected pieces of drawing on the picture
  const label = new Int32Array(size * size).fill(-1), pieces = [];
  for (let s = 0; s < painted.length; s++) {
    if (!painted[s] || label[s] >= 0) continue;
    const id = pieces.length, stack = [s], px = []; label[s] = id;
    while (stack.length) {
      const p = stack.pop(); px.push(p); const x = p % size, y = (p / size) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const q = ny * size + nx; if (painted[q] && label[q] < 0) { label[q] = id; stack.push(q); }
      }
    }
    pieces.push(px);
  }
  const uv = bodyCornerUVs();
  const point = (p) => { // body point and normal under picture pixel p
    const t = map[p], x = (p % size + 0.5) / size, y = 1 - (((p / size) | 0) + 0.5) / size, o = t * 6;
    const ax = uv[o], ay = uv[o + 1], bx = uv[o + 2], by = uv[o + 3], cx = uv[o + 4], cy = uv[o + 5];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    let w1 = ((x - ax) * (cy - ay) - (y - ay) * (cx - ax)) / area, w2 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / area;
    w1 = Math.min(1, Math.max(0, w1)); w2 = Math.min(1 - w1, Math.max(0, w2)); const w0 = 1 - w1 - w2;
    const i0 = index[t * 3] * 3, i1 = index[t * 3 + 1] * 3, i2 = index[t * 3 + 2] * 3, out = [0, 0, 0], n = [0, 0, 0];
    for (let k = 0; k < 3; k++) { out[k] = positions[i0 + k] * w0 + positions[i1 + k] * w1 + positions[i2 + k] * w2; n[k] = normals[i0 + k] * w0 + normals[i1 + k] * w1 + normals[i2 + k] * w2; }
    return { p: out, n };
  };
  const kept = pieces.filter((px) => px.length >= minPixels).sort((a, b) => b.length - a.length).slice(0, maxPieces).map((px) => {
    const step = Math.max(1, Math.floor(px.length / 400)), pts = [];
    for (let i = 0; i < px.length; i += step) pts.push(point(px[i]));
    const every = Math.max(1, Math.floor(pts.length / 60));
    return { pixels: px.length, pts, few: pts.filter((_, i) => i % every === 0) };
  });
  // join pieces that touch on the body (one drawing across a texture seam)
  const parent = kept.map((_, i) => i), root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) {
    if (root(i) === root(j)) continue;
    let near = false;
    for (const a of kept[i].few) { for (const b of kept[j].few) if (Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) < joinGap) { near = true; break; } if (near) break; }
    if (near) parent[root(j)] = root(i);
  }
  const groups = new Map();
  kept.forEach((k, i) => { const r = root(i); if (!groups.has(r)) groups.set(r, { pixels: 0, pts: [] }); const g = groups.get(r); g.pixels += k.pixels; g.pts.push(...k.pts); });
  return [...groups.values()].map((g) => {
    const c = [0, 0, 0], n = [0, 0, 0];
    for (const q of g.pts) for (let k = 0; k < 3; k++) { c[k] += q.p[k]; n[k] += q.n[k]; }
    const nl = Math.hypot(...n) || 1;
    return { pixels: g.pixels, center: c.map((v) => v / g.pts.length), normal: n.map((v) => v / nl), points: g.pts.map((q) => q.p) };
  }).sort((a, b) => b.pixels - a.pixels);
}

// The flat frame a tattoo uses for this normal at turn 0 (same as frameOf in app.js).
export function tattooFrame(n) {
  const ref = Math.abs(n[1]) > 0.93 ? [0, 0, -1] : [0, 1, 0];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const right = norm(cross(ref, n)), up = norm(cross(n, right));
  return { right, up };
}

// Size and centre of a drawing in its tattoo frame, with a small border.
export function drawingBox(group, pad = 0.08) {
  const { right, up } = tattooFrame(group.normal), c = group.center;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of group.points) {
    const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]], x = d[0] * right[0] + d[1] * right[1] + d[2] * right[2], y = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const w = Math.max(0.012, x1 - x0), h = Math.max(0.012, y1 - y0), m = Math.max(w, h) * pad + 0.006;
  const mid = [(x0 + x1) / 2, (y0 + y1) / 2];
  return { right, up, w: w + 2 * m, h: h + 2 * m, mid: [c[0] + right[0] * mid[0] + up[0] * mid[1], c[1] + right[1] * mid[0] + up[1] * mid[1], c[2] + right[2] * mid[0] + up[2] * mid[1]] };
}

// Photograph the drawing straight on, from outside the body along its normal.
// geometry: the body with texture coordinates (texturedBody). paint: a texture holding
// only the new drawing (transparent elsewhere). Returns a canvas, rows from the top.
export function photographDrawing({ THREE, renderer, geometry, paint, center, normal, box, longSide = 1024 }) {
  const aspect = box.w / box.h, W = Math.max(16, Math.round(aspect >= 1 ? longSide : longSide * aspect)), H = Math.max(16, Math.round(aspect >= 1 ? longSide / aspect : longSide));
  // only the skin near the drawing: an arm in front of the torso is outside this depth window
  const cam = new THREE.OrthographicCamera(-box.w / 2, box.w / 2, box.h / 2, -box.h / 2, 0.6 - 0.07, 0.6 + 0.14);
  const n = new THREE.Vector3(...normal).normalize();
  cam.position.set(...center).addScaledVector(n, 0.6); cam.up.set(...box.up); cam.lookAt(new THREE.Vector3(...center)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const mat = new THREE.MeshBasicMaterial({ map: paint, blending: THREE.NoBlending, side: THREE.FrontSide, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const target = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.SRGBColorSpace }); target.texture.colorSpace = THREE.SRGBColorSpace;
  const prev = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha(), prevScissor = renderer.getScissorTest();
  renderer.getClearColor(prevColor);
  const raw = new Uint8Array(W * H * 4);
  try {
    renderer.setScissorTest(false); renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
    renderer.readRenderTargetPixels(target, 0, 0, W, H, raw);
  } finally { renderer.setRenderTarget(prev); renderer.setClearColor(prevColor, prevAlpha); renderer.setScissorTest(prevScissor); target.dispose(); mat.dispose(); }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const img = new ImageData(W, H), row = W * 4;
  for (let y = 0; y < H; y++) img.data.set(raw.subarray((H - 1 - y) * row, (H - y) * row), y * row);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// The new drawing alone, as ink on white paper: the picture holds skin x ink, so the ink
// is the picture divided by the skin. Everything that is not new drawing is transparent.
export function paintLayer({ pixels, baseline, map, size, skin }) {
  const out = new ImageData(size, size), d = out.data;
  for (let o = 0; o < d.length; o += 4) d[o] = d[o + 1] = d[o + 2] = 255; // white paper, so soft edges fade to white
  for (let p = 0; p < map.length; p++) {
    if (map[p] < 0) continue;
    const o = p * 4;
    const a = paintAlpha(diff(pixels, baseline, o));
    if (a <= 0) continue;
    if (Math.hypot(pixels[o] - skin[0], pixels[o + 1] - skin[1], pixels[o + 2] - skin[2]) <= PAINT_MIN) continue;
    for (let k = 0; k < 3; k++) { const ink = Math.min(1, pixels[o + k] / Math.max(1, skin[k])); d[o + k] = Math.round(255 * ink); }
    d[o + 3] = Math.round(255 * a);
  }
  return out;
}

// Apps store the skin picture either way up (the USDZ we write keeps it upside down,
// the OBJ picture the right way up), so compare both with the expected skin and keep
// the one that matches. Returns the pixels the right way up.
export function uprightPixels(pixels, baseline, map, size) {
  let same = 0, flip = 0;
  for (let p = 0; p < map.length; p += 7) {
    if (map[p] < 0) continue;
    const x = p % size, y = (p / size) | 0, q = ((size - 1 - y) * size + x) * 4;
    // count clear mismatches, so a slightly different skin tone everywhere does not decide it
    if (diff(pixels, baseline, p * 4) > PAINT_MIN) same++;
    if (Math.hypot(pixels[q] - baseline[p * 4], pixels[q + 1] - baseline[p * 4 + 1], pixels[q + 2] - baseline[p * 4 + 2]) > PAINT_MIN) flip++;
  }
  if (!(flip < same * 0.8)) return pixels; // the right way up, or no way to tell
  const out = new Uint8ClampedArray(pixels.length), row = size * 4;
  for (let y = 0; y < size; y++) out.set(pixels.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  return out;
}
