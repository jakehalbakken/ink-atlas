// Render the app icon (a stencil-violet placement reticle on the studio-dark
// background) to the PNG sizes the PWA manifest and iOS home screen need.
// Run once: `npm run icons`. Output lands in public/.
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = resolve(import.meta.dirname, '..', 'public');
const EXE = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function svg({ radius, markScale }) {
  const t = `translate(256,256) scale(${markScale}) translate(-256,-256)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">`
    + `<rect width="512" height="512" rx="${radius}" fill="#17181d"/>`
    + `<g fill="none" stroke="#8474ff" stroke-width="18" stroke-linecap="round" transform="${t}">`
    + `<circle cx="256" cy="256" r="150" stroke-dasharray="40 26"/>`
    + `<circle cx="256" cy="256" r="92"/>`
    + `<line x1="256" y1="74" x2="256" y2="132"/><line x1="256" y1="380" x2="256" y2="438"/>`
    + `<line x1="74" y1="256" x2="132" y2="256"/><line x1="380" y1="256" x2="438" y2="256"/>`
    + `</g><circle cx="256" cy="256" r="26" fill="#8474ff" transform="${t}"/></svg>`;
}

const TARGETS = [
  { file: 'pwa-192.png', size: 192, radius: 112, markScale: 1, opaque: false },
  { file: 'pwa-512.png', size: 512, radius: 112, markScale: 1, opaque: false },
  { file: 'maskable-512.png', size: 512, radius: 0, markScale: 0.66, opaque: true },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, markScale: 0.82, opaque: true },
];

await mkdir(OUT, { recursive: true });
const b = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
for (const t of TARGETS) {
  await p.setViewport({ width: t.size, height: t.size, deviceScaleFactor: 1 });
  const markup = svg(t).replace('<svg ', `<svg width="${t.size}" height="${t.size}" `);
  await p.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`, { waitUntil: 'load' });
  await p.screenshot({ path: resolve(OUT, t.file), omitBackground: !t.opaque, type: 'png' });
  console.log('icon', t.file, `${t.size}x${t.size}`);
}
await b.close();
