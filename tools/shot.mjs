// Headless screenshot / scripted check against the built site.
// Serves dist/ over http (module scripts need http, not file://) at the same
// base path the deploy uses, then drives it with puppeteer.
// Usage: node tools/shot.mjs [out.png] [tools/tests/t1.mjs]
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , out = 'shots/out.png', script] = process.argv;
const DIST = resolve(process.env.INK_DIST || resolve(import.meta.dirname, '..', 'dist'));
const BASE = '/ink-atlas';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.startsWith(BASE)) p = p.slice(BASE.length);
    if (!p || p === '/') p = '/index.html';
    const file = normalize(join(DIST, p));
    if (!file.startsWith(DIST)) { res.statusCode = 403; return res.end('forbidden'); }
    const body = await readFile(file);
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.setHeader('Service-Worker-Allowed', BASE + '/');
    res.end(body);
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}${BASE}/`;

await mkdir(dirname(resolve(out)), { recursive: true });
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 });
p.on('console', (m) => { const t = m.text(); if (!/GPU stall|fonts\.g|ERR_/.test(t)) console.log('console:', t); });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 2500));
await p.evaluate(() => { const c = document.querySelector('#coachOk'); c && c.click(); });
if (script) { const mod = await import(pathToFileURL(resolve(script)).href); await mod.default(p); }
await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: out });
await b.close();
server.close();
console.log('shot', out, 'from', url);
