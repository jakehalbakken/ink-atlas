// t161 flat files read the way the tattoo sits on the body: the artist sheet's thumbnail is mirrored, flipped and
// bent as it is on the skin (it showed the plain file), Print at real size flips a tattoo that is flipped top to
// bottom (it printed the file upright) and says so, Real size on screen shows a bent tattoo bent and at the size it
// fills (it showed the plain file at the plain size), and the From a distance line measures a bent tattoo's lines as
// they are drawn, the way Ink check does (it measured the unbent file).
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const st = () => p.evaluate(() => window.__ink.state());
  const add = async (draw, name) => {
    const n0 = (await st()).tattoos.length;
    await p.evaluate(async (src, nm) => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 200); new Function('g', src)(g);
      const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], nm, { type: 'image/png' }));
      const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
    }, draw, name);
    await p.waitForFunction((n) => window.__ink.state().tattoos.length === n + 1, { timeout: 8000 }, n0);
    const id = (await st()).tattoos.at(-1).id;
    await p.waitForFunction((i) => window.__ink.inkOnSkin(i), { timeout: 8000 }, id); await wait(300);
    return id;
  };
  // one dark square in the top left of the file, so every way it is turned shows
  const id = await add("g.fillStyle='#000'; g.fillRect(20,20,80,80);", 'corner.png');
  const set = (o) => p.evaluate((i, o) => { const s = window.__ink.state(); for (const t of s.tattoos) t.hidden = t.id !== i; Object.assign(s.tattoos.find((t) => t.id === i), o); window.__ink.commitTest(); }, id, o);
  // darkness of each quarter of a box in a picture given as a data URL
  const quarters = (url, box) => p.evaluate(async (url, [x, y, w, h]) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const q = (qx, qy) => { const d = g.getImageData(Math.round(x + qx * w / 2), Math.round(y + qy * h / 2), Math.round(w / 2), Math.round(h / 2)).data; let s = 0; for (let o = 0; o < d.length; o += 4) s += 255 - (d[o] + d[o + 1] + d[o + 2]) / 3; return s / (d.length / 4); };
    return { tl: q(0, 0), tr: q(1, 0), bl: q(0, 1), br: q(1, 1) };
  }, url, box);
  const darkest = (q) => Object.entries(q).sort((a, b) => b[1] - a[1])[0][0];

  // the artist sheet: the first thumbnail box is at 1080, 200, 130 square
  const sheet = async () => {
    await p.click('#shareBtn'); await wait(250);
    await p.evaluate(() => { document.querySelector('#pvImg').removeAttribute('src'); });
    await p.click('#cSheet');
    await p.waitForFunction(() => document.querySelector('#pvTitle').textContent === 'Artist sheet' && document.querySelector('#pvImg').src.startsWith('data:') && document.querySelector('#pvImg').naturalWidth > 0, { timeout: 60000 });
    const url = await p.$eval('#pvImg', (i) => i.src);
    await p.evaluate(() => document.querySelector('#pvDone, #preview [data-close], #preview .done')?.click()); await p.keyboard.press('Escape'); await wait(300);
    return quarters(url, [1088, 236, 114, 58]);
  };
  await set({ flip: false, imageTopDown: true }); await wait(600);
  assert.equal(darkest(await sheet()), 'tl', 'the sheet shows the plain file as it is');
  await set({ flip: true }); await wait(600);
  assert.equal(darkest(await sheet()), 'tr', 'a mirrored tattoo is mirrored on the sheet, as on the body');
  await set({ flip: true, imageTopDown: false }); await wait(600);
  assert.equal(darkest(await sheet()), 'br', 'mirrored and flipped on the sheet, as on the body');

  // Print at real size: the one visible tattoo's picture, flipped top to bottom as it is on the body
  await p.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); window.saved = {}; const old = URL.createObjectURL; URL.createObjectURL = function (blob) { if (blob.name) window.saved[blob.askedAs||blob.name] = blob.arrayBuffer(); return old.call(this, blob); }; });
  const print = async () => {
    await p.evaluate(() => { window.saved = {}; });
    await p.click('#shareBtn'); await wait(250); await p.click('#cPrint');
    await p.waitForFunction(() => !!window.saved['ink-atlas-real-size.pdf'], { timeout: 60000 });
    return p.evaluate(async () => {
      const b = new Uint8Array(await window.saved['ink-atlas-real-size.pdf']); let s = ''; for (const c of b) s += String.fromCharCode(c);
      const m = /\/Width (\d+) \/Height (\d+) [^>]*\/Length (\d+) >>\nstream\n/.exec(s); const start = m.index + m[0].length;
      const bmp = await createImageBitmap(new Blob([b.slice(start, start + +m[3])], { type: 'image/jpeg' }));
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
      return { url: c.toDataURL(), w: bmp.width, h: bmp.height, text: s };
    });
  };
  await set({ flip: false, imageTopDown: true }); await wait(400);
  let pr = await print(); assert.equal(darkest(await quarters(pr.url, [0, 0, pr.w, pr.h])), 'tl', 'the plain tattoo prints as the file');
  await set({ flip: false, imageTopDown: false }); await wait(400);
  pr = await print(); assert.equal(darkest(await quarters(pr.url, [0, 0, pr.w, pr.h])), 'bl', 'a flipped tattoo prints flipped, as on the body');
  assert.match(pr.text, /flipped as on the body/, 'the print says it is flipped as on the body');
  await set({ flip: true, imageTopDown: false }); await wait(400);
  pr = await print(); assert.equal(darkest(await quarters(pr.url, [0, 0, pr.w, pr.h])), 'br', 'mirrored and flipped prints as on the body');
  assert.match(pr.text, /mirrored and flipped as on the body/);

  // Real size on screen: a bent tattoo shows its bent picture in the box it fills on the skin
  const rid = await add("g.fillStyle='#000'; g.fillRect(0,0,400,200);", 'block.png');
  await p.evaluate((i) => window.__ink.select(i), rid); await wait(300);
  const W2 = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] };
  await p.evaluate((i, w) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.warp = w; window.__ink.commitTest(); }, rid, W2); await wait(900);
  const rt = (await st()).tattoos.find((t) => t.id === rid);
  await p.$eval('#bRealSize', (e) => e.click()); await wait(400);
  const rs = await p.evaluate(async () => {
    const box = document.querySelector('#rsArt').getBoundingClientRect(), im = document.querySelector('#rsImg'); await im.decode().catch(() => {});
    return { w: box.width, h: box.height, iw: im.naturalWidth, ih: im.naturalHeight, text: document.querySelector('#rsText').textContent };
  });
  assert(Math.abs(rs.w / rs.h - rt.aspect * 0.5) < 0.05, `the box has the bent shape, half as wide (${(rs.w / rs.h).toFixed(2)} for ${(rt.aspect * 0.5).toFixed(2)})`);
  assert(Math.abs(rs.iw / rs.ih - rs.w / rs.h) < 0.08, `the picture in it is the bent one (${(rs.iw / rs.ih).toFixed(2)})`);
  const wIn = rt.width * 0.5 * (await st()).heightCm / 175 * 100 / 2.54;
  assert(rs.text.includes(wIn.toFixed(1) + ' ×'), `it reads the bent width, ${wIn.toFixed(1)} in: ${rs.text}`);
  await p.$eval('#rsClose', (e) => e.click()); await wait(300);

  // From a distance: thin upright lines, then bent into half the width; the lines it measures get thinner with it
  const lid = await add("g.fillStyle='#000'; for (let x=20; x<380; x+=40) g.fillRect(x,20,10,160);", 'lines.png');
  await p.evaluate((i) => { const s = window.__ink.state(); for (const t of s.tattoos) t.hidden = t.id !== i; window.__ink.commitTest(); }, lid); await wait(500);
  const plain = await p.evaluate((i) => window.__ink.finest(i), lid);
  await p.evaluate((i) => { const t = window.__ink.state().tattoos.find((q) => q.id === i); t.warp = { n: 3, p: [0, 0, 0.25, 0, 0.5, 0, 0, 0.5, 0.25, 0.5, 0.5, 0.5, 0, 1, 0.25, 1, 0.5, 1] }; window.__ink.commitTest(); }, lid); await wait(900);
  assert((await st()).tattoos.find((t) => t.id === lid).warp, 'it is bent');
  const bent = await p.evaluate((i) => window.__ink.finest(i), lid);
  assert(plain && bent && plain.lineMm > 0, 'both measure: ' + JSON.stringify({ plain, bent }));
  const r = bent.lineMm / plain.lineMm;
  assert(r > 0.35 && r < 0.65, `squeezed to half the width, its lines measure about half as thick (x${r.toFixed(2)})`);
  console.log('PASS t161 flat files as on the body: artist sheet thumbnails mirrored, flipped and bent as on the skin, Print at real size flips a flipped tattoo and says so, Real size on screen shows it bent at its size, From a distance measures a bent tattoo as drawn');
}
