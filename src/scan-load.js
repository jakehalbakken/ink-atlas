// Reading a 3D body scan file from Files: GLB or glTF (Polycam, Scaniverse, most apps), OBJ, or
// USDZ (an iPhone scan). Every mesh in the file is merged into one triangle list in the file's own
// units and axes, then sampled into surface points with normals for the fit (scan-fit.js).
// The file itself is never kept: only the fitted shape is, on this device (scan-store.js).
import { sampleSurface, dropFloor, faceOut } from './scan-fit.js';

export const SCAN_TYPES = '.glb,.gltf,.obj,.usdz,model/gltf-binary,model/gltf+json,model/obj,model/vnd.usdz+zip';

function kindOf(name, bytes) {
  const ext = (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1]?.toLowerCase();
  const head = String.fromCharCode(...bytes.subarray(0, 4));
  if (head === 'glTF') return 'glb';
  if (head.startsWith('PK')) return 'usdz';
  if (ext === 'gltf' || (bytes[0] === 0x7b && ext !== 'obj')) return 'gltf';
  if (ext === 'obj') return 'obj';
  if (ext === 'usdz') return 'usdz';
  if (ext === 'glb') return 'glb';
  return /^\s*(#|v |o |g |mtllib)/m.test(new TextDecoder().decode(bytes.subarray(0, 2000))) ? 'obj' : null;
}

async function sceneOf(kind, buf) {
  if (kind === 'glb' || kind === 'gltf') {
    const [{ GLTFLoader }, { DRACOLoader, DRACO_GLTF_CONFIG }, { MeshoptDecoder }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'), import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    const loader = new GLTFLoader(), draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_GLTF_CONFIG); // three's own decoder, fetched only for a compressed scan
    loader.setDRACOLoader(draco); loader.setMeshoptDecoder(MeshoptDecoder);
    try {
      const g = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
      return g.scene || (g.scenes && g.scenes[0]);
    } catch (e) {
      if (kind === 'gltf') throw new Error('This glTF file needs files that came with it. Export the scan as GLB, one file, instead.');
      throw e;
    } finally { draco.dispose(); }
  }
  if (kind === 'obj') { const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js'); return new OBJLoader().parse(new TextDecoder().decode(buf)); }
  if (kind === 'usdz') { const { USDZLoader } = await import('three/addons/loaders/USDZLoader.js'); return new USDZLoader().parse(buf); }
  return null;
}

// Every triangle of every mesh, in world space. Returns { positions, index, tris }.
export function mergeMeshes(root) {
  const parts = []; let nv = 0, nt = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    if (o.visible === false) return;
    const g = o.geometry, p = g.attributes.position, m = o.matrixWorld.elements, n = p.count;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      pos[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; pos[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; pos[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    let idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n - (n % 3) }, (_, i) => i);
    if (o.isSkinnedMesh) { /* a rigged scan: its rest shape is fine for the fit */ }
    // a mirrored node (negative scale) turns its triangles inside out
    const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
    if (det < 0) for (let t = 0; t < idx.length; t += 3) { const a = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = a; }
    parts.push({ pos, idx, base: nv }); nv += n; nt += idx.length / 3;
  });
  const positions = new Float32Array(nv * 3), index = new Uint32Array(nt * 3);
  let ti = 0; for (const p of parts) { positions.set(p.pos, p.base * 3); for (let i = 0; i < p.idx.length; i++) index[ti++] = p.idx[i] + p.base; }
  return { positions, index, tris: nt };
}

// File -> { pts, nrm, tris, dropped } in the file's units, ready for scanToBody.
export async function readScan(file, { points = 150000 } = {}) {
  const buf = await file.arrayBuffer(), bytes = new Uint8Array(buf);
  const kind = kindOf(file.name, bytes);
  if (!kind) throw new Error('That file is not a 3D scan this can read. Use GLB, OBJ or USDZ.');
  let root;
  try { root = await sceneOf(kind, buf); } catch (e) { throw new Error(e && /files that came/.test(e.message) ? e.message : 'That scan file could not be read. Try exporting it again as GLB.'); }
  if (!root) throw new Error('That scan file could not be read. Try exporting it again as GLB.');
  const { positions, index, tris } = mergeMeshes(root);
  if (tris < 500) throw new Error(tris ? 'That scan has too little in it to be a body. Export the mesh, not a point cloud.' : 'That file has no mesh in it. Export the mesh, not a point cloud.');
  const s = sampleSurface(positions, index, points, 11);
  const fl = dropFloor(s.pts, s.nrm);
  faceOut(fl.pts, fl.nrm);
  return { pts: fl.pts, nrm: fl.nrm, tris, dropped: fl.dropped, kind, name: file.name };
}
