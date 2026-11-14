// Paint on the body: what you painted on the 3D body in Procreate, kept as one picture in
// the body's own texture layout (MakeHuman's UVs, the same layout uv-bake.js writes out).
// It is shown as a thin skin of paint over the body that follows every shape and pose, and
// it goes back out in the next 3D model, so you can paint, bring it back, and paint again.
//
// Bringing a model back finds the paint by comparing its skin picture with the same skin
// baked here without paint (plain skin plus the tattoos), so the whole of the paint comes
// back each time: new strokes, earlier strokes, and whatever was rubbed out.
import { bodyCornerUVs } from './uv-bake.js';
import { UV_BODY_TRIS } from './body-uv.js';
import { paintAlpha } from './procreate-import.js';

const diff = (a, b, o) => Math.hypot(a[o] - b[o], a[o + 1] - b[o + 1], a[o + 2] - b[o + 2]);

// pixels, baseline: RGBA, rows from the top, size x size; map: triangleMap(size); skin: the
// picture's skin colour.
// Returns { image: ImageData of the paint alone (its own colour, transparent elsewhere),
// painted: body pixels with paint, body: body pixels }.
export function extractPaint({ pixels, baseline, map, size, skin }) {
  const out = new ImageData(size, size), d = out.data;
  let painted = 0, body = 0;
  for (let p = 0; p < map.length; p++) {
    if (map[p] < 0) continue; body++;
    const o = p * 4, a = paintAlpha(diff(pixels, baseline, o));
    if (a <= 0) continue;
    // bare skin where a tattoo is now: the tattoo was moved here after the model went out,
    // not painted over in Procreate
    if (skin && Math.hypot(pixels[o] - skin[0], pixels[o + 1] - skin[1], pixels[o + 2] - skin[2]) <= 34) continue;
    painted++;
    // a soft edge is part paint, part skin: take the skin back out so the paint keeps its colour
    for (let k = 0; k < 3; k++) d[o + k] = Math.max(0, Math.min(255, Math.round((pixels[o + k] - (1 - a) * baseline[o + k]) / a)));
    d[o + 3] = Math.round(255 * a);
  }
  bleed(d, size, map);
  return { image: out, painted, body };
}

// Spread the paint's colour (not its cover) a few pixels into the clear pixels round it,
// and its cover too into the gaps between the texture's islands, so texture filtering at
// an edge or a seam never pulls in a dark or white fringe.
function bleed(d, size, map, passes = 4) {
  const n = size * size, has = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (d[p * 4 + 3]) has[p] = 1;
  for (let pass = 0; pass < passes; pass++) {
    const add = [];
    for (let p = 0; p < n; p++) {
      if (has[p]) continue;
      const x = p % size; let r = 0, g = 0, b = 0, a = 0, c = 0;
      for (const q of [x > 0 ? p - 1 : -1, x < size - 1 ? p + 1 : -1, p >= size ? p - size : -1, p < n - size ? p + size : -1]) {
        if (q < 0 || !has[q]) continue; const o = q * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; a = Math.max(a, d[o + 3]); c++;
      }
      if (c) add.push([p, r / c, g / c, b / c, map[p] < 0 ? a : 0]);
    }
    if (!add.length) break;
    for (const [p, r, g, b, a] of add) { const o = p * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a; has[p] = 1; }
  }
}

// The paint over a skin picture (both rows from the top, the same size): ordinary
// painting over, as Procreate shows it.
export function paintOver(base, paint) {
  const out = new Uint8ClampedArray(base.length);
  for (let o = 0; o < base.length; o += 4) {
    const a = paint[o + 3] / 255;
    for (let k = 0; k < 3; k++) out[o + k] = base[o + k] * (1 - a) + paint[o + k] * a;
    out[o + 3] = base[o + 3];
  }
  return out;
}

// The thin skin of paint shown over the body: the body's triangles split at the texture's
// seams, each corner remembering which body vertex it sits on. Before each draw it takes
// the body's current positions and normals (standing, reshaped or posed), so it is always
// exactly on the skin.
export function createPaintOverlay({ THREE, body }) {
  const uv = bodyCornerUVs(), I = body.geometry.index.array;
  const key = new Map(), src = [], tex = [], idx = [];
  for (let c = 0; c < UV_BODY_TRIS * 3; c++) {
    const vi = I[c], u = uv[c * 2], v = uv[c * 2 + 1], k = vi * 4294967296 + Math.round(u * 65535) * 65536 + Math.round(v * 65535);
    let n = key.get(k);
    if (n === undefined) { n = src.length; key.set(k, n); src.push(vi); tex.push(u, v); }
    idx.push(n);
  }
  const g = new THREE.BufferGeometry(), count = src.length, from = Uint32Array.from(src);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(tex, 2));
  g.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  const mat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.62, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'paint'; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 900; mesh.raycast = () => {}; mesh.userData.notBody = true;
  let seen = '';
  const copy = (geo) => {
    const k = geo.uuid + ':' + geo.attributes.position.version + ':' + (geo.attributes.normal ? geo.attributes.normal.version : 0);
    if (k === seen) return; seen = k;
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < count; i++) { const s = from[i] * 3, o = i * 3; p[o] = P[s]; p[o + 1] = P[s + 1]; p[o + 2] = P[s + 2]; n[o] = N[s]; n[o + 1] = N[s + 1]; n[o + 2] = N[s + 2]; }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  };
  mesh.onBeforeRender = () => copy(body.geometry);
  body.add(mesh);
  let texture = null, shownFor = null;
  return {
    mesh,
    // picture: an image element or canvas in the texture layout, rows from the top
    set(picture, visible) {
      if (picture !== shownFor) {
        if (texture) texture.dispose();
        texture = picture ? new THREE.Texture(picture) : null;
        if (texture) { texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = true; texture.anisotropy = 4; texture.needsUpdate = true; }
        mat.map = texture; mat.needsUpdate = true; shownFor = picture;
      }
      mesh.visible = !!texture && !!visible;
    },
    // where the body is for the paint now, for tests
    positionsNow: () => { copy(body.geometry); return g.attributes.position.array; },
    from,
  };
}
