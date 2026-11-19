// How I see it (Preview): what you can see of your own body without a mirror, the view from
// your own eyes, and a mirror selfie. Pure maths, no three.js, so it runs in tests.
//
// Units are the body's (1.75 tall); `k` turns metres into body units for this person's height.
// A head turns about 75 degrees each way and bends about 55 degrees down; the eyes add about
// 50 more. So you see a spot when, for some turn and bend of the head, it lies within the eyes'
// reach and nothing of your own body is in between. Head and neck skin is never seen without a
// mirror, and the head itself does not hide anything (looking down, it moves out of the way).

export const HEAD_TURN = 75 * Math.PI / 180, HEAD_BEND = 55 * Math.PI / 180, EYE_REACH = 50 * Math.PI / 180;
export const LOOK_SIDE = HEAD_TURN + EYE_REACH, LOOK_DOWN = HEAD_BEND + 50 * Math.PI / 180, LOOK_UP = 25 * Math.PI / 180;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const at = (P, v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
// turn v about the unit axis k by angle a (Rodrigues)
export function turn(v, k, a) { const c = Math.cos(a), s = Math.sin(a), d = dot(k, v) * (1 - c), x = cross(k, v); return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d]; }

// Which vertices are head, neck or hand, from the rig's bone weights (vertexBones(v) -> [[name, w]]).
const HEAD_RE = /^(head|jaw|eye\.|special0|levator|oculi|orbicularis|oris|risorius|temporalis|tongue)/;
export function bodyParts(count, vertexBones) {
  const head = new Uint8Array(count), neck = new Uint8Array(count), handL = [], handR = [];
  for (let v = 0; v < count; v++) {
    let h = 0, n = 0, hl = 0, hr = 0;
    for (const [name, w] of vertexBones(v)) {
      if (HEAD_RE.test(name)) h += w; else if (/^neck0/.test(name)) n += w;
      else if (/^(metacarpal|finger)/.test(name)) { if (name.endsWith('.L')) hl += w; else hr += w; }
    }
    head[v] = h > 0.5 ? 1 : 0; neck[v] = !head[v] && h + n > 0.5 ? 1 : 0;
    if (hl > 0.6) handL.push(v); if (hr > 0.6) handR.push(v);
  }
  return { head, neck, handL, handR };
}

// Landmarks picked once on a standing body: the tip of the nose, the back of the head level with
// it and the top of the head, plus the eyeballs (vertices first..first+count).
export function headLandmarks(P, head, eyes) {
  let nose = -1, top = -1;
  for (let v = 0; v < head.length; v++) {
    if (!head[v]) continue;
    if (Math.abs(P[v * 3]) < 0.012 && (nose < 0 || P[v * 3 + 2] > P[nose * 3 + 2])) nose = v;
    if (top < 0 || P[v * 3 + 1] > P[top * 3 + 1]) top = v;
  }
  let back = -1; const ny = P[nose * 3 + 1];
  for (let v = 0; v < head.length; v++) if (head[v] && Math.abs(P[v * 3]) < 0.02 && Math.abs(P[v * 3 + 1] - ny) < 0.03 && (back < 0 || P[v * 3 + 2] < P[back * 3 + 2])) back = v;
  return { nose, back, top, eyes };
}
// The head as it is now (standing or posed): where the eyes look from and which way is forward.
export function headFrame(P, L) {
  const nose = at(P, L.nose), back = at(P, L.back), top = at(P, L.top);
  let c = [0, 0, 0]; for (let v = L.eyes[0]; v < L.eyes[0] + L.eyes[1]; v++) c = add(c, at(P, v));
  c = mul(c, 1 / L.eyes[1]);
  const forward = unit(sub(nose, back)), u0 = sub(top, mul(add(nose, back), 0.5));
  const up = unit(sub(u0, mul(forward, dot(u0, forward)))), right = unit(cross(forward, up));
  const size = Math.hypot(...sub(nose, back)); // about 20 cm on an average head
  return { eye: add(c, mul(forward, size * 0.06)), forward, up, right, size };
}
// The head turned (yaw, + to its left) and bent down (bend, radians), about the top of the neck
// for the turn and its base for the bend, so the eyes move as a real head carries them.
export function headPose(F, yaw, bend) {
  const s = F.size, turnPivot = add(sub(F.eye, mul(F.forward, s * 0.45)), mul(F.up, -s * 0.3)), bendPivot = add(sub(F.eye, mul(F.forward, s * 0.4)), mul(F.up, -s * 0.55));
  let eye = add(turnPivot, turn(sub(F.eye, turnPivot), F.up, yaw)), forward = turn(F.forward, F.up, yaw), right = turn(F.right, F.up, yaw);
  // bending down: forward swings toward the feet about the (turned) ear-to-ear line
  const axis = mul(right, -1);
  eye = add(bendPivot, turn(sub(eye, bendPivot), axis, bend)); forward = turn(forward, axis, bend);
  const up = turn(F.up, axis, bend);
  return { eye, forward, up: turn(up, F.up, 0), right };
}
// The live view from your eyes, for a look yaw (+ left) and pitch (+ down). The head takes most
// of a turn and the eyes the rest, as people do. Each is held to what a body can do.
export function eyeView(F, yaw, pitch) {
  yaw = Math.max(-LOOK_SIDE, Math.min(LOOK_SIDE, yaw)); pitch = Math.max(-LOOK_UP, Math.min(LOOK_DOWN, pitch));
  const hy = Math.max(-HEAD_TURN, Math.min(HEAD_TURN, yaw * 0.8)), hb = Math.max(0, Math.min(HEAD_BEND, pitch * 0.6));
  const H = headPose(F, hy, hb);
  // the eyes do the rest about the head's own axes
  let dir = turn(H.forward, H.up, yaw - hy); const r = unit(cross(dir, H.up));
  dir = turn(dir, r, -(pitch - hb));
  return { pos: H.eye, dir: unit(dir), up: H.up, yaw, pitch };
}
// The head positions the eyes look from when checking what can be seen.
export function lookPostures(F) {
  const out = [];
  for (const b of [0, 0.5, 1]) for (const y of [-1, -0.5, 0, 0.5, 1]) out.push(headPose(F, y * HEAD_TURN, b * HEAD_BEND));
  // and leaning over a little at the hips to look down the legs, as people do
  const flat = unit([F.forward[0], 0, F.forward[2]]);
  for (const y of [-0.5, 0, 0.5]) { const H = headPose(F, y * HEAD_TURN, HEAD_BEND); out.push({ ...H, eye: add(add(H.eye, mul(flat, F.size * 0.6)), [0, -F.size * 0.2, 0]) }); }
  return out;
}

// Per-vertex seen (1) or not (0). P positions, N normals (or null), I triangle index, count
// vertices to judge. skip[v] = 1: never judged (eyes), unseen[v] = 1: always unseen (head and
// neck), clear[v] = 1: never hides anything (the head). only: optional list of vertices to judge.
export function seenMask(P, N, I, count, { postures, skip, unseen, clear, only = null, res = 200, reach = EYE_REACH }) {
  const seen = new Uint8Array(count), want = only ? Uint8Array.from({ length: count }, () => 0) : null;
  if (want) for (const v of only) want[v] = 1;
  const nv = P.length / 3, sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv);
  const half = reach + 8 * Math.PI / 180, f = (res / 2) / Math.tan(half), cosReach = Math.cos(reach), near = 0.02;
  const depth = new Float32Array(res * res), pix = 1.5 / f;
  const todo = []; for (let v = 0; v < count; v++) if (!skip[v] && !unseen[v] && (!want || want[v])) todo.push(v);
  const tris = []; for (let i = 0; i < I.length; i += 3) if (!clear[I[i]] && !clear[I[i + 1]] && !clear[I[i + 2]]) tris.push(I[i], I[i + 1], I[i + 2]);
  for (const C of postures) {
    const { eye: e, forward: g, up: u, right: r } = C;
    // anything to judge in this direction at all?
    let any = false;
    for (const v of todo) { if (seen[v]) continue; const d = sub(at(P, v), e), z = dot(d, g); if (z > near && z / Math.hypot(...d) >= cosReach) { any = true; break; } }
    if (!any) continue;
    for (let v = 0; v < nv; v++) {
      const dx = P[v * 3] - e[0], dy = P[v * 3 + 1] - e[1], dz = P[v * 3 + 2] - e[2];
      const z = dx * g[0] + dy * g[1] + dz * g[2]; sz[v] = z;
      if (z > near) { sx[v] = res / 2 + f * (dx * r[0] + dy * r[1] + dz * r[2]) / z; sy[v] = res / 2 - f * (dx * u[0] + dy * u[1] + dz * u[2]) / z; }
    }
    depth.fill(Infinity);
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2];
      if (sz[a] <= near || sz[b] <= near || sz[c] <= near) continue;
      const ax = sx[a], ay = sy[a], bx = sx[b], by = sy[b], cx = sx[c], cy = sy[c];
      let x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.ceil(Math.max(ax, bx, cx)), y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy));
      if (x1 < 0 || y1 < 0 || x0 >= res || y0 >= res) continue;
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(res - 1, x1); y1 = Math.min(res - 1, y1);
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) { const k = Math.round(ay) * res + Math.round(ax); if (ax >= 0 && ay >= 0 && ax < res && ay < res) depth[k] = Math.min(depth[k], sz[a]); continue; }
      const za = sz[a], zb = sz[b], zc = sz[c];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        let w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const z = w0 * za + w1 * zb + w2 * zc, k = y * res + x;
        if (z < depth[k]) depth[k] = z;
      }
    }
    for (const v of todo) {
      if (seen[v]) continue;
      const z = sz[v]; if (z <= near) continue;
      const dx = P[v * 3] - e[0], dy = P[v * 3 + 1] - e[1], dz = P[v * 3 + 2] - e[2], dist = Math.hypot(dx, dy, dz);
      if (z / dist < cosReach) continue;
      // skin turned away from the eye is the far side of an arm or leg
      if (N && (N[v * 3] * dx + N[v * 3 + 1] * dy + N[v * 3 + 2] * dz) / dist > 0.08) continue;
      const x = Math.floor(sx[v]), y = Math.floor(sy[v]); if (x < 0 || y < 0 || x >= res || y >= res) continue;
      // a pixel of skin seen edge-on spans a long way in depth, so allow for how glancing it is
      const own = depth[y * res + x], c = N ? Math.min(1, Math.max(0.25, -(N[v * 3] * dx + N[v * 3 + 1] * dy + N[v * 3 + 2] * dz) / dist)) : 1;
      if (own === Infinity || z - own <= 0.006 + 0.02 * z + pix * z * Math.sqrt(1 - c * c) / c) seen[v] = 1;
    }
  }
  return seen;
}
// Soften a 0/1 mask over the mesh's neighbours, for an edge that reads as skin, not triangles.
export function softMask(seen, neighbours, rounds = 2) {
  let a = Float32Array.from(seen);
  for (let r = 0; r < rounds; r++) {
    const b = new Float32Array(a.length);
    for (let v = 0; v < a.length; v++) { const nb = neighbours[v]; let s = a[v] * 2, n = 2; if (nb) for (const w of nb) if (w < a.length) { s += a[w]; n++; } b[v] = s / n; }
    a = b;
  }
  return a;
}
// How much of a tattoo is seen: the share of the body vertices under its ink.
export function shareSeen(seen, verts) {
  let n = 0, s = 0; for (const v of verts) if (v < seen.length) { n++; s += seen[v]; }
  return n ? s / n : null;
}
export function seenWords(share) {
  if (share == null) return '';
  if (share >= 0.97) return 'all of it';
  if (share <= 0.03) return 'none of it';
  return `about ${Math.max(5, Math.min(95, Math.round(share * 20) * 5))}%`;
}
// posed: true when the body is in a pose, so the line says so
export function seenLine(name, share, posed) {
  if (share == null) return '';
  const where = posed ? ' in this pose' : ' standing';
  if (share >= 0.97) return `You can see all of ${name} yourself${where}.`;
  if (share <= 0.03) return `You can't see ${name} yourself${where}, only in a mirror.`;
  return `You can see ${seenWords(share)} of ${name} yourself${where}. The darker part needs a mirror.`;
}

// Mirror selfie. hand: the middle of the hand holding the phone. turnBody: how far you have
// turned from facing the mirror (radians, + to your left). gap: phone to mirror, body units.
// The phone points at the mirror, so the camera you see is the phone's reflection, looking back.
export function selfieCamera(hand, { turnBody = 0, gap = 0.6, lift = 0 } = {}) {
  const n = [Math.sin(-turnBody), 0, Math.cos(-turnBody)]; // from you to the mirror, in the body's frame
  const phone = hand, pos = add(phone, mul(n, 2 * gap));
  return { phone, normal: n, pos, dir: unit(add(mul(n, -1), [0, -lift, 0])), up: [0, 1, 0] };
}
// A phone photo's frame (portrait 3:4, about 26 mm lens): vertical field of view in degrees.
export const PHONE_FOV = 2 * Math.atan(17.3 / 26) * 180 / Math.PI;

// Smooth vertex normals for a set of positions (a pose worked out off screen).
export function vertexNormals(P, I) {
  const N = new Float32Array(P.length);
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    for (const o of [a, b, c]) { N[o] += x; N[o + 1] += y; N[o + 2] += z; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}
