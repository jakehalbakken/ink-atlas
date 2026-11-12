// Tattoos painted into the skin. The body is laid flat by MakeHuman's own texture
// coordinates (UVs), every tattoo triangle is drawn onto the triangle of skin it
// sits on, and the result is one skin picture wrapped on one body mesh. That is what
// Procreate, AR Quick Look, Blender and most 3D apps expect, unlike the separate
// floating ink meshes of the other exports.
//
// Every decal triangle is a copy of one body triangle (src/decal.js records which),
// so baking is exact per triangle and never smears across a UV seam.
import { UV_TRIS, UV_BODY_TRIS, UV_CORNERS } from './body-uv.js';

let cornerCache = null;
// Per-corner UVs (u, v in 0..1) for the body and eye triangles, in index order.
export function bodyCornerUVs() {
  if (!cornerCache) {
    const bin = atob(UV_CORNERS), raw = new Uint16Array(bin.length / 2);
    for (let i = 0; i < raw.length; i++) raw[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
    cornerCache = Float32Array.from(raw, (q) => q / 65535);
  }
  return cornerCache;
}

// A small square of plain skin in an unused corner of the texture, for triangles
// without their own UVs (the genital geometry, which is smoothed at bake time).
const SPARE = [0.0015, 0.0015, 0.0055, 0.0055];

// Grow covered pixels outward into empty ones, so texture filtering at an island's
// edge never pulls in background. Works on frontier pixels only.
export function dilate(pixels, w, h, passes = 8) {
  const covered = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (pixels[p * 4 + 3]) covered[p] = 1;
  let frontier = [];
  const near = (p) => { const x = p % w; return (x > 0 && covered[p - 1]) || (x < w - 1 && covered[p + 1]) || (p >= w && covered[p - w]) || (p < w * (h - 1) && covered[p + w]); };
  for (let p = 0; p < w * h; p++) if (!covered[p] && near(p)) frontier.push(p);
  for (let pass = 0; pass < passes && frontier.length; pass++) {
    const done = [];
    for (const p of frontier) {
      if (covered[p]) continue;
      let r = 0, g = 0, b = 0, n = 0; const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < w * (h - 1) ? p + w : -1]) if (q >= 0 && covered[q]) { r += pixels[q * 4]; g += pixels[q * 4 + 1]; b += pixels[q * 4 + 2]; n++; }
      if (!n) continue;
      pixels[p * 4] = r / n; pixels[p * 4 + 1] = g / n; pixels[p * 4 + 2] = b / n; pixels[p * 4 + 3] = 255; done.push(p);
    }
    for (const p of done) covered[p] = 1;
    const next = new Set();
    for (const p of done) { const x = p % w; for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < w * (h - 1) ? p + w : -1]) if (q >= 0 && !covered[q]) next.add(q); }
    frontier = [...next];
  }
  return covered;
}

// Draw skin and ink in texture space. Returns { pixels (top row first), size }.
export function bakeSkin({ THREE, renderer, bodyGeometry, skinColor, decals, size }) {
  const max = renderer.capabilities.maxTextureSize || 4096;
  size = size || (max >= 4096 ? 4096 : 2048);
  const uv = bodyCornerUVs(), index = bodyGeometry.index.array;
  if (index.length / 3 < UV_TRIS) throw new Error('Body mesh does not match its texture coordinates');
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1), owned = [];
  const add = (positions, material, order, uvs) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const m = new THREE.Mesh(g, material); m.renderOrder = order; m.frustumCulled = false; scene.add(m); owned.push(g, material);
  };
  // skin and eyes
  const flat = (from, to) => { const out = new Float32Array((to - from) * 9); for (let t = from, k = 0; t < to; t++) for (let j = 0; j < 3; j++, k += 3) { out[k] = uv[(t * 3 + j) * 2] * 2 - 1; out[k + 1] = uv[(t * 3 + j) * 2 + 1] * 2 - 1; out[k + 2] = 0; } return out; };
  const plain = (color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
  add(flat(0, UV_BODY_TRIS), plain(skinColor), 0);
  add(flat(UV_BODY_TRIS, UV_TRIS), plain(new THREE.Color('#3b302b')), 1);
  const [a, b, c, d] = SPARE.map((v) => v * 2 - 1);
  add(new Float32Array([a, b, 0, c, b, 0, c, d, 0, a, b, 0, c, d, 0, a, d, 0]), plain(skinColor), 2);
  // ink, triangle by triangle onto the skin it covers
  let inked = 0;
  decals.forEach((dc, order) => {
    const tris = dc.geometry.userData.tris, src = dc.geometry.getAttribute('uv');
    if (!tris || !src) return;
    const pos = [], tex = [];
    for (let k = 0; k < tris.length; k++) {
      const t = tris[k]; if (t >= UV_TRIS) continue; // genital: no texture coordinates of its own
      for (let j = 0; j < 3; j++) { pos.push(uv[(t * 3 + j) * 2] * 2 - 1, uv[(t * 3 + j) * 2 + 1] * 2 - 1, 0); tex.push(src.getX(k * 3 + j), src.getY(k * 3 + j)); }
    }
    if (!pos.length) return;
    const m = dc.material.clone(); m.side = THREE.DoubleSide; m.depthTest = false; m.polygonOffset = false;
    // multiply the colour, keep the skin's alpha so coverage stays readable
    m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.ZeroFactor; m.blendDst = THREE.SrcColorFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
    add(new Float32Array(pos), m, 10 + order, new Float32Array(tex)); inked++;
  });
  const target = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace, depthBuffer: false });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const prevTarget = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha(), prevScissor = renderer.getScissorTest();
  renderer.getClearColor(prevColor);
  const raw = new Uint8Array(size * size * 4);
  try {
    renderer.setScissorTest(false); renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, raw);
  } finally {
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha); renderer.setScissorTest(prevScissor);
    target.dispose(); for (const o of owned) o.dispose();
  }
  dilate(raw, size, size, 8);
  // anything still empty becomes plain skin, so the picture is opaque everywhere
  const s = skinColor.clone().convertLinearToSRGB(), fill = [Math.round(s.r * 255), Math.round(s.g * 255), Math.round(s.b * 255)];
  const pixels = new Uint8ClampedArray(size * size * 4), row = size * 4;
  for (let y = 0; y < size; y++) {
    const from = (size - 1 - y) * row, to = y * row; // GL rows start at the bottom
    for (let x = 0; x < row; x += 4) {
      if (raw[from + x + 3]) { pixels[to + x] = raw[from + x]; pixels[to + x + 1] = raw[from + x + 1]; pixels[to + x + 2] = raw[from + x + 2]; }
      else { pixels[to + x] = fill[0]; pixels[to + x + 1] = fill[1]; pixels[to + x + 2] = fill[2]; }
      pixels[to + x + 3] = 255;
    }
  }
  return { pixels, size, inked };
}

// One mesh, split at UV seams: a vertex for every distinct (position, uv) pair.
export function texturedBody({ THREE, bodyGeometry, scale = 1 }) {
  const uv = bodyCornerUVs(), index = bodyGeometry.index.array, P = bodyGeometry.getAttribute('position'), N = bodyGeometry.getAttribute('normal');
  const spareU = (SPARE[0] + SPARE[2]) / 2, spareV = (SPARE[1] + SPARE[3]) / 2;
  const key = new Map(), pos = [], nor = [], tex = [], idx = [];
  for (let c = 0; c < index.length; c++) {
    const vi = index[c], t = (c / 3) | 0, u = t < UV_TRIS ? uv[c * 2] : spareU, v = t < UV_TRIS ? uv[c * 2 + 1] : spareV;
    const k = vi * 4294967296 + Math.round(u * 65535) * 65536 + Math.round(v * 65535);
    let n = key.get(k);
    if (n === undefined) { n = pos.length / 3; key.set(k, n); pos.push(P.getX(vi) * scale, P.getY(vi) * scale, P.getZ(vi) * scale); nor.push(N.getX(vi), N.getY(vi), N.getZ(vi)); tex.push(u, v); }
    idx.push(n);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(tex, 2));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return g;
}

const num = (n) => String(Math.round(n * 1e6) / 1e6);
export function objText(geometry) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), t = geometry.getAttribute('uv'), I = geometry.index.array;
  const out = ['# Ink Atlas body with tattoos painted into the skin texture. Units: meters, Y up.', 'mtllib model.mtl', 'o body', 'usemtl skin'];
  for (let i = 0; i < p.count; i++) out.push(`v ${num(p.getX(i))} ${num(p.getY(i))} ${num(p.getZ(i))}`);
  for (let i = 0; i < t.count; i++) out.push(`vt ${num(t.getX(i))} ${num(t.getY(i))}`);
  for (let i = 0; i < n.count; i++) out.push(`vn ${num(n.getX(i))} ${num(n.getY(i))} ${num(n.getZ(i))}`);
  for (let i = 0; i < I.length; i += 3) { const a = I[i] + 1, b = I[i + 1] + 1, c = I[i + 2] + 1; out.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`); }
  return out.join('\n') + '\n';
}

async function pngOf(pixels, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').putImageData(new ImageData(pixels, size, size), 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('Could not make the skin picture');
  return { blob, canvas: c };
}

// kind: 'usdz' (one file: Procreate, Files, AR Quick Look) or 'obj' (ZIP: model.obj, model.mtl, skin.png).
export async function exportPaintedModel({ THREE, renderer, bodyGeometry, skinColor, decals, state, kind = 'usdz', size }) {
  const height = state.heightCm ?? 175;
  if (!Number.isFinite(height) || height < 50 || height > 300) throw new Error('Invalid body height');
  const baked = bakeSkin({ THREE, renderer, bodyGeometry, skinColor, decals, size });
  const geometry = texturedBody({ THREE, bodyGeometry, scale: height / 175 });
  const { blob: png, canvas } = await pngOf(baked.pixels, baked.size);
  try {
    if (kind === 'usdz') {
      const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.flipY = true;
      const material = new THREE.MeshStandardMaterial({ map, roughness: 0.75, metalness: 0 });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = 'body';
      const scene = new THREE.Scene(); scene.add(mesh);
      try {
        const data = await new USDZExporter().parseAsync(scene, { quickLookCompatible: true, maxTextureSize: baked.size, ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } } });
        return { blob: new Blob([data], { type: 'model/vnd.usdz+zip' }), name: 'ink-atlas-model.usdz', size: baked.size, inked: baked.inked };
      } finally { map.dispose(); material.dispose(); }
    }
    const { zipStored } = await import('./obj-export.js');
    const enc = new TextEncoder(), manifest = { format: 'obj-uv-baked', units: 'meters', heightCm: height, texture: `${baked.size}x${baked.size}`, tattoos: baked.inked, uvBaked: true, includesNotes: false, includesSourceArtwork: false };
    const files = [
      { name: 'model.obj', data: enc.encode(objText(geometry)) },
      { name: 'model.mtl', data: enc.encode('newmtl skin\nKa 1 1 1\nKd 1 1 1\nKs 0 0 0\nillum 1\nmap_Kd skin.png\n') },
      { name: 'skin.png', data: new Uint8Array(await png.arrayBuffer()) },
      { name: 'README.txt', data: enc.encode('Ink Atlas body with your tattoos painted into one skin texture (skin.png).\nUnzip, keep the three files together, and open model.obj in your 3D app.\nUnits are meters. The body is in its standing pose.\n') },
      { name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2)) },
    ];
    return { blob: zipStored(files), name: 'ink-atlas-model-obj.zip', size: baked.size, inked: baked.inked };
  } finally { geometry.dispose(); }
}
