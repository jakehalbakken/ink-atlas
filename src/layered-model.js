// The 3D body for Procreate with each tattoo kept apart. Procreate's 3D painting groups a
// model's parts by material into texture sets, each shown in Layers under its own name with
// its own Base Layer and room for more layers. So the skin is one part ("Skin": plain skin
// and any paint) and every visible tattoo is its own thin part lying just over the skin,
// with its own material and picture named after it. Painting on a tattoo's set paints only
// that tattoo; the skin underneath stays clean.
//
// A tattoo's part is the triangles of skin it covers (the same triangles the ink is drawn
// on here, src/decal.js), lifted a fraction of a millimetre, with its own texture laid out
// from the artwork's own coordinates. Its picture is the ink multiplied over the skin
// colour, so where there is no ink it matches the skin around it.
import { bakeSkin, texturedBody } from './uv-bake.js';

const LIFT = 0.0006; // body units (1.75 tall), about 0.6 mm over the skin
const PAD = 0.04;    // share of the artwork added round each part's texture

// A USD prim name: letters, digits and _, not starting with a digit, unique.
export function usdName(name, used, fallback = 'Tattoo') {
  let s = String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!s) s = fallback;
  if (/^[0-9]/.test(s)) s = '_' + s;
  let out = s, n = 2;
  while (used.has(out.toLowerCase())) out = `${s}_${n++}`;
  used.add(out.toLowerCase());
  return out;
}

// The part of the skin one tattoo covers: triangles whose artwork coordinates touch the
// artwork, lifted along the normals, with texture coordinates remapped to fill 0..1.
// Returns null when nothing of the tattoo lies on the body.
export function tattooPart({ positions, normals, index, tris, uv, aspect = 1, scale = 1 }) {
  const keep = [];
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (let k = 0; k < tris.length; k++) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (let j = 0; j < 3; j++) { const u = uv[(k * 3 + j) * 2], v = uv[(k * 3 + j) * 2 + 1]; if (u < a) a = u; if (u > c) c = u; if (v < b) b = v; if (v > d) d = v; }
    if (!(c > 0 && a < 1 && d > 0 && b < 1)) continue; // wholly outside the artwork
    if (!(c - a < 3 && d - b < 3)) continue;            // torn or folded triangle
    keep.push(k);
    if (a < u0) u0 = a; if (c > u1) u1 = c; if (b < v0) v0 = b; if (d > v1) v1 = d;
  }
  if (!keep.length) return null;
  u0 = Math.min(u0, 0) - PAD; v0 = Math.min(v0, 0) - PAD; u1 = Math.max(u1, 1) + PAD; v1 = Math.max(v1, 1) + PAD;
  const du = u1 - u0, dv = v1 - v0, seen = new Map(), pos = [], nor = [], st = [], art = [], idx = [];
  for (const k of keep) {
    const t = tris[k];
    for (let j = 0; j < 3; j++) {
      const vi = index[t * 3 + j], u = uv[(k * 3 + j) * 2], v = uv[(k * 3 + j) * 2 + 1];
      const key = vi + ':' + Math.round(u * 4096) + ':' + Math.round(v * 4096);
      let n = seen.get(key);
      if (n === undefined) {
        n = pos.length / 3; seen.set(key, n);
        const nx = normals[vi * 3], ny = normals[vi * 3 + 1], nz = normals[vi * 3 + 2], l = Math.hypot(nx, ny, nz) || 1;
        pos.push((positions[vi * 3] + nx / l * LIFT) * scale, (positions[vi * 3 + 1] + ny / l * LIFT) * scale, (positions[vi * 3 + 2] + nz / l * LIFT) * scale);
        nor.push(nx / l, ny / l, nz / l);
        st.push((u - u0) / du, (v - v0) / dv); art.push(u, v);
      }
      idx.push(n);
    }
  }
  // pixels stay square: the artwork is `aspect` times wider than tall
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), st: new Float32Array(st), art: new Float32Array(art), index: idx, triangles: keep.length, ratio: (du * aspect) / dv, box: [u0, v0, u1, v1] };
}

// The part's picture: skin colour, the ink multiplied over it exactly as on the body.
function bakePart({ THREE, renderer, part, material, skinColor, longest }) {
  const w = part.ratio >= 1 ? longest : Math.max(64, Math.round(longest * part.ratio)), h = part.ratio >= 1 ? Math.max(64, Math.round(longest / part.ratio)) : longest;
  const g = new THREE.BufferGeometry(), flat = new Float32Array(part.st.length / 2 * 3);
  for (let i = 0; i < part.st.length / 2; i++) { flat[i * 3] = part.st[i * 2] * 2 - 1; flat[i * 3 + 1] = part.st[i * 2 + 1] * 2 - 1; }
  g.setAttribute('position', new THREE.BufferAttribute(flat, 3)); g.setAttribute('uv', new THREE.BufferAttribute(part.art, 2)); g.setIndex(part.index);
  const m = material.clone(); m.side = THREE.DoubleSide; m.depthTest = false; m.polygonOffset = false;
  m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.ZeroFactor; m.blendDst = THREE.SrcColorFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1), mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh);
  const target = new THREE.WebGLRenderTarget(w, h, { colorSpace: THREE.SRGBColorSpace, depthBuffer: false }); target.texture.colorSpace = THREE.SRGBColorSpace;
  const prevTarget = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha(), prevScissor = renderer.getScissorTest();
  renderer.getClearColor(prevColor);
  const raw = new Uint8Array(w * h * 4);
  try {
    renderer.setScissorTest(false); renderer.setRenderTarget(target); renderer.setClearColor(skinColor, 1); renderer.clear(); renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, w, h, raw);
  } finally {
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha); renderer.setScissorTest(prevScissor);
    target.dispose(); g.dispose(); m.dispose();
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const img = new ImageData(w, h), row = w * 4;
  for (let y = 0; y < h; y++) { const from = (h - 1 - y) * row; for (let x = 0; x < row; x++) img.data[y * row + x] = x % 4 === 3 ? 255 : raw[from + x]; }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// Stored ZIP with every file's data starting on a 64-byte boundary, as USDZ requires.
export function zipAligned(files, zipSync) {
  const out = {}; let offset = 0;
  for (const [name, data] of files) {
    const n = new TextEncoder().encode(name).length, head = offset + 30 + n + 4;
    const pad = (64 - (head % 64)) % 64;
    out[name] = [data, { extra: { 12345: new Uint8Array(pad) } }];
    offset = head + pad + data.length;
  }
  return zipSync(out, { level: 0, mtime: new Date(2026, 0, 1) });
}

// tattoos: [{ name, geometry, material, aspect }] in tray order (visible ones only).
export async function exportLayeredModel({ THREE, renderer, bodyGeometry, skinColor, tattoos, state, paint = null, size }) {
  const height = state.heightCm ?? 175;
  if (!Number.isFinite(height) || height < 50 || height > 300) throw new Error('Invalid body height');
  const scale = height / 175, max = renderer.capabilities.maxTextureSize || 4096;
  // the skin alone: no tattoos in it, paint on top
  const baked = bakeSkin({ THREE, renderer, bodyGeometry, skinColor, decals: [], size });
  const skinCanvas = document.createElement('canvas'); skinCanvas.width = skinCanvas.height = baked.size;
  const sg = skinCanvas.getContext('2d'); sg.putImageData(new ImageData(baked.pixels, baked.size, baked.size), 0, 0);
  if (paint) { sg.imageSmoothingQuality = 'high'; sg.drawImage(paint, 0, 0, baked.size, baked.size); }
  const owned = [], used = new Set(), names = new Map(), scene = new THREE.Scene(), parts = [];
  const surface = (canvas, label) => {
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.flipY = true; map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.75, metalness: 0 });
    owned.push(map, material); names.set(material.id, label); return material;
  };
  try {
    const skinName = usdName('Skin', used), bodyMesh = new THREE.Mesh(texturedBody({ THREE, bodyGeometry, scale }), surface(skinCanvas, skinName));
    bodyMesh.name = skinName; owned.push(bodyMesh.geometry); scene.add(bodyMesh);
    const P = bodyGeometry.getAttribute('position').array, N = bodyGeometry.getAttribute('normal').array, I = bodyGeometry.index.array;
    for (const t of tattoos) {
      const tris = t.geometry.userData.tris, uv = t.geometry.getAttribute('uv');
      if (!tris || !uv) continue;
      const part = tattooPart({ positions: P, normals: N, index: I, tris, uv: uv.array, aspect: t.aspect || 1, scale });
      if (!part) continue;
      const img = t.material.map && t.material.map.image, artPx = img ? Math.max(img.width || 0, img.height || 0) : 1024;
      const span = Math.max(part.box[2] - part.box[0], part.box[3] - part.box[1]);
      const longest = Math.min(2048, max, Math.max(1024, Math.round(artPx * span)));
      const label = usdName(t.name, used);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3)); g.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3)); g.setAttribute('uv', new THREE.BufferAttribute(part.st, 2));
      g.setIndex(part.positions.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(part.index, 1) : new THREE.Uint16BufferAttribute(part.index, 1));
      owned.push(g);
      const mesh = new THREE.Mesh(g, surface(bakePart({ THREE, renderer, part, material: t.material, skinColor, longest }), label)); mesh.name = label;
      scene.add(mesh); parts.push({ name: label, triangles: part.triangles });
    }
    const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
    const { unzipSync, zipSync, strFromU8, strToU8 } = await import('three/examples/jsm/libs/fflate.module.js');
    const data = await new USDZExporter().parseAsync(scene, { quickLookCompatible: true, maxTextureSize: Math.max(baked.size, 2048), ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } } });
    // name each material after its part, so Procreate's texture sets read Skin, Rose, ...
    const files = unzipSync(new Uint8Array(data)), list = Object.keys(files);
    const model = list.find((n) => /\.usda$/.test(n));
    let text = strFromU8(files[model]);
    for (const [id, label] of names) text = text.replace(new RegExp(`Material_${id}(?![0-9])`, 'g'), label);
    files[model] = strToU8(text);
    const zip = zipAligned([model, ...list.filter((n) => n !== model)].map((n) => [n, files[n]]), zipSync);
    return { blob: new Blob([zip], { type: 'model/vnd.usdz+zip' }), name: 'ink-atlas-model-layers.usdz', size: baked.size, parts };
  } finally { for (const o of owned) o.dispose(); }
}
