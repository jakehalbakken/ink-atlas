// A 60-tattoo project for the speed checks (t187), every tattoo's ink points worked out
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const ink = (f, ...a) => p.evaluate(f, ...a);
  await p.setViewport({ width: 1180, height: 820, hasTouch: true });
  await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1200);
  await ink(() => { const I = window.__ink, s = structuredClone(I.state()), b = s.tattoos[0], P = I.positions();
    const X = I.bodyIndex(); s.tattoos = []; for (let k = 0; k < 60; k++) { const t = structuredClone(b), f = 40 + k * 433, a = X[f * 3] * 3, c = X[f * 3 + 1] * 3, d = X[f * 3 + 2] * 3, e1 = [0, 1, 2].map((j) => P[c + j] - P[a + j]), e2 = [0, 1, 2].map((j) => P[d + j] - P[a + j]), n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(...n); t.id = 'id' + k; t.name = 'T' + k; t.pos = [0, 1, 2].map((j) => (P[a + j] + P[c + j] + P[d + j]) / 3); t.normal = n.map((x) => x / nl); t.status = k % 3 ? 'planned' : 'existing'; t.locked = false; delete t.group; s.tattoos.push(t); }
    s.groups = []; I.loadState(s); });
  await p.waitForFunction(() => window.__ink.inkReads().warmed >= 60, { timeout: 90000 }); await wait(1500);
}
