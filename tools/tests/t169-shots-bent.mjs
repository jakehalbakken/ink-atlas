// t169 close pictures of a bent tattoo (the artist sheet close-up, How it ages, From a distance, If your
// body changes, As you move) aimed at the flat file's middle and zoomed for its size, so a piece bent
// into the left half of its file came out small and off to the side. They now aim at the bent box.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1000);
  const n0 = (await st()).tattoos.length;
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 400, 200);
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'block.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, n0);
  const id = (await st()).tattoos.at(-1).id;
  await p.evaluate((i) => { const ink = window.__ink, s = ink.state(), a = ink.surfaceAt([0, 1.25, 2], [0, 0, -1]); for (const t of s.tattoos) t.hidden = t.id !== i; const t = s.tattoos.find((q) => q.id === i); Object.assign(t, a, { status: 'planned', name: 'Block', width: 0.1, aspect: 2, rot: 0 }); ink.select(i); ink.commitTest(); }, id);
  await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id); await wait(800);
  // the red ink's box in a close-up, as shares of the picture
  const shot = () => p.evaluate(async (i) => {
    const url = window.__ink.closeUp(i), im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const k = (y * c.width + x) * 4; if (d[k] > 50 && d[k] > 1.8 * d[k + 1] && d[k] > 1.8 * d[k + 2]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    return x1 < 0 ? null : { cx: (x0 + x1) / 2 / c.width, cy: (y0 + y1) / 2 / c.height, w: (x1 - x0) / c.width, h: (y1 - y0) / c.height };
  }, id);
  const flat = await shot();
  const w0 = await p.evaluate((i) => { const b = window.__ink.inkBox(i); return b[2] - b[0]; }, id);
  assert.ok(flat && flat.w > 0.15, 'the flat piece shows in the close-up: ' + JSON.stringify(flat));
  // bent into the left half of its file: a 5 x 5 cm square where a 10 x 5 cm piece was
  await p.evaluate((i) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, id);
  await p.waitForFunction(() => window.__ink.settled(), { timeout: 30000 }).catch(() => {});
  // the bend shows a few seconds later headless: wait until the ink on screen has narrowed
  await p.waitForFunction((i, w) => { const b = window.__ink.inkBox(i); return b && b[2] - b[0] < w; }, { timeout: 30000 }, id, 0.7 * w0).catch(() => {}); await wait(800);
  const bent = await shot();
  assert.ok(bent, 'the bent piece shows');
  assert.ok(Math.abs(bent.cx - 0.5) < 0.05 && Math.abs(bent.cy - 0.5) < 0.06, `centred on the bent piece: ${JSON.stringify(bent)}`);
  // zoomed in for the 5 cm square, so it is nearly as tall in the picture as the 10 x 5 cm piece was wide
  // (the fixed margin round it keeps it a little smaller)
  assert.ok(Math.abs(bent.h / flat.w - 1) < 0.25, `framed for its bent size: ${flat.w.toFixed(2)} then ${bent.h.toFixed(2)}`);
  const tried = await p.evaluate(() => JSON.parse(localStorage.getItem('ia-tried') || '[]'));
  assert.ok(tried.includes('shotsBent'), 'ticked in New to try');
  console.log('PASS t169 close pictures aim at a bent tattoo: ' + JSON.stringify({ flat, bent }));
}
