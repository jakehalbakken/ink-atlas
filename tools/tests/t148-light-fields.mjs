// In the light look, what you type in a box reads clearly (2026-11-20 QA: the note box in Body tools wrote
// white on near-white). Every text box in the panels that have one, light and dark, has text at 4.5:1 or
// more against what is behind it.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 500) => new Promise((r) => setTimeout(r, n));
  const flows = [['Body tools', '#openBodyTools'], ['Notes', '#openNotes'], ['Artwork library', '#openArtworkLibrary'], ['Line up', '#openPlacement'], ['Photo fit', '#openPhotoFit']];
  const bad = []; let n = 0;
  for (const scheme of ['light', 'dark']) {
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    for (const [name, sel] of flows) {
      await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__ink && window.__ink.ready(), { timeout: 30000 }); await wait(1000);
      await p.click('#projectsBtn'); await wait(500); await p.click(sel); await wait(1200);
      const r = await p.evaluate(() => {
        const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
        const over = (a, b) => { const al = a[3] + b[3] * (1 - a[3]); if (!al) return [0, 0, 0, 0]; return [0, 1, 2].map((i) => (a[i] * a[3] + b[i] * b[3] * (1 - a[3])) / al).concat(al); };
        const bgOf = (e) => { const layers = []; for (let x = e; x; x = x.parentElement) layers.push(parse(getComputedStyle(x).backgroundColor)); let c = parse(getComputedStyle(document.documentElement).backgroundColor); if (!c[3]) c = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) c = over(layers[i], c); return c; };
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const out = [];
        const boxes = [...document.querySelectorAll('textarea,input:not([type=range],[type=checkbox],[type=radio],[type=file],[type=color],[type=button]),select')].filter((e) => e.offsetParent && e.checkVisibility() && !e.closest('#sheet,#layersDock,#bodyPop'));
        for (const e of boxes) { const bg = bgOf(e); const fg = over(parse(getComputedStyle(e).color), bg); const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); out.push([(e.id || e.getAttribute('aria-label') || e.tagName).slice(0, 30), Math.round(ratio * 10) / 10]); }
        return out;
      });
      for (const [lab, ratio] of r) { n++; if (ratio < 4.5) bad.push(`${scheme} ${name} ${lab} ${ratio}:1`); }
    }
  }
  assert.ok(n >= 10, 'found the boxes: ' + n);
  assert.deepEqual(bad, [], bad.join('\n'));
  console.log(`PASS t148 light fields: ${n} text boxes in five panels read at 4.5:1 or more, light and dark`);
}
