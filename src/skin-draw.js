// Drawing straight onto the skin: one layer's picture while it is being drawn on (see
// src/skin-draw-math.js for the maths and app.js for the gestures). The picture is a canvas in the
// artwork's own pixels; a stroke builds up in its own buffer so a pencil line never darkens where it
// crosses itself, is held inside the chosen area when that is on, and lands on the picture when the
// pen lifts, as one undo step. What the body shows is a smaller canvas made from the picture over
// white (ink multiplies on the skin), redrawn only where a stroke changed it.
import { dabRadius, dabsAlong, smoothPoint, dabRect, clampRect, unionRect, StrokeHistory, alphaBounds } from './skin-draw-math.js';

export const DRAW_TOOLS = ['pencil', 'brush', 'eraser', 'area'];
const TINT = '#8474ff';

function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const ctx = (c) => c.getContext('2d', { willReadFrequently: true });

export class SkinDrawing {
  // art: an image or canvas to start from (or null for a blank layer), W x H its pixels.
  // mask: a canvas the same size whose alpha is the chosen area (or null: the whole picture).
  // margin: the decal's UV margin; view: the longest side of what the body shows.
  constructor({ THREE, art, W, H, mask = null, margin, view = 1024, flip = false, upsideDown = false }) {
    this.W = W; this.H = H; this.margin = margin; this.flip = !!flip;
    this.art = canvasOf(W, H); this.g = ctx(this.art);
    // an older picture kept bottom row first is turned the right way up, so drawing reads top down
    if (art) { if (upsideDown) { this.g.save(); this.g.translate(0, H); this.g.scale(1, -1); } this.g.drawImage(art, 0, 0, W, H); if (upsideDown) this.g.restore(); }
    this.buf = canvasOf(W, H); this.bg = ctx(this.buf);
    this.tmp = canvasOf(W, H); this.tg = ctx(this.tmp);
    this.mask = mask; this.mg = mask ? ctx(mask) : null;
    this.hasArea = !!mask;
    this.tool = 'pencil'; this.color = '#1d1b22'; this.sizeMm = 1.2; this.opacity = 1; this.clip = !!mask; this.areaAdd = true; this.pxPerMm = 8;
    this.history = new StrokeHistory();
    this.stroke = null; this.changed = false; this.strokes = 0;
    const k = Math.min(1, view / Math.max(W, H)), VW = Math.max(64, Math.round(W * k / (1 - 2 * margin))), VH = Math.max(64, Math.round(H * k / (1 - 2 * margin)));
    this.view = canvasOf(VW, VH); this.vg = ctx(this.view);
    this.tex = new THREE.CanvasTexture(this.view); this.tex.flipY = false; this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4; this.tex.userData.ratio = false; this.tex.userData.lift = false;
    this.vg.fillStyle = '#fff'; this.vg.fillRect(0, 0, VW, VH); // the margins round the picture stay paper white
    this.redraw();
  }
  // art pixels to the shown canvas
  get mx() { return this.margin * this.view.width; } get my() { return this.margin * this.view.height; }
  get sx() { return (this.view.width - 2 * this.mx) / this.W; } get sy() { return (this.view.height - 2 * this.my) / this.H; }
  sizePx() { return Math.max(1, this.sizeMm * this.pxPerMm); }
  // Redraw the shown canvas where the picture changed (r in art pixels; none: all of it).
  redraw(r = null) {
    const W = this.W, H = this.H; r = r ? clampRect([r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2], W, H) : [0, 0, W, H]; if (!r) return;
    const vg = this.vg, mx = this.mx, my = this.my, sx = this.sx, sy = this.sy;
    let dx = mx + r[0] * sx; const dy = my + r[1] * sy, dw = r[2] * sx, dh = r[3] * sy;
    if (this.flip) dx = this.view.width - dx - dw;
    const x0 = Math.floor(dx), y0 = Math.floor(dy), x1 = Math.ceil(dx + dw), y1 = Math.ceil(dy + dh);
    vg.save(); vg.beginPath(); vg.rect(x0, y0, x1 - x0, y1 - y0); vg.clip();
    vg.fillStyle = '#fff'; vg.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (this.flip) { vg.translate(this.view.width, 0); vg.scale(-1, 1); }
    const put = (src, a = 1) => { vg.globalAlpha = a; vg.drawImage(src, r[0], r[1], r[2], r[3], mx + r[0] * sx, my + r[1] * sy, r[2] * sx, r[3] * sy); vg.globalAlpha = 1; };
    // the area, faintly, so the edge you are drawing to shows; stronger while it is being changed
    if (this.mask && (this.clip || this.tool === 'area')) put(this.mask, this.tool === 'area' ? 0.34 : 0.14);
    const s = this.stroke;
    if (s && s.rect && s.tool === 'eraser') {
      // the picture with the stroke taken out, to show
      const tg = this.tg; tg.clearRect(r[0], r[1], r[2], r[3]); tg.globalCompositeOperation = 'source-over'; tg.drawImage(this.art, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]);
      tg.globalCompositeOperation = 'destination-out'; tg.drawImage(this.buf, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]); tg.globalCompositeOperation = 'source-over';
      put(this.tmp);
    } else {
      put(this.art);
      if (s && s.rect && s.tool !== 'area') { this.clipped(r); put(this.tmp, this.opacity); }
    }
    vg.restore();
    this.tex.needsUpdate = true;
  }
  // the stroke buffer held inside the area (into tmp)
  clipped(r) {
    const tg = this.tg; tg.clearRect(r[0], r[1], r[2], r[3]); tg.drawImage(this.buf, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]);
    if (this.mask && this.clip) { tg.globalCompositeOperation = 'destination-in'; tg.drawImage(this.mask, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]); tg.globalCompositeOperation = 'source-over'; }
  }
  dab(g, x, y, r, tool) {
    if (tool === 'brush') {
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, this.color); gr.addColorStop(0.55, this.color); gr.addColorStop(1, this.color + '00');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    } else if (tool === 'eraser' || (tool === 'area')) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, TINT); gr.addColorStop(0.7, TINT); gr.addColorStop(1, TINT + '00');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    } else { g.fillStyle = this.color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  }
  // A stroke: begin, extend with each point (art pixels, pen pressure), end.
  begin(x, y, pressure) {
    if (this.stroke) this.end();
    const tool = this.tool, r = dabRadius(tool === 'area' ? this.sizePx() * 4 : this.sizePx(), pressure, tool);
    const s = this.stroke = { tool, last: { x, y, r }, raw: { x, y, r }, carry: 0, rect: null };
    if (tool === 'area') {
      if (!this.mask) return;
      s.before = this.mg.getImageData(0, 0, this.W, this.H); // the area is small to keep, and its edits are few
      this.mg.globalCompositeOperation = this.areaAdd ? 'source-over' : 'destination-out';
    }
    this.place([{ x, y, r }]);
  }
  extend(x, y, pressure) {
    const s = this.stroke; if (!s) return;
    const r = dabRadius(s.tool === 'area' ? this.sizePx() * 4 : this.sizePx(), pressure, s.tool), next = smoothPoint(s.last, { x, y, r }, s.tool === 'pencil' ? 0.25 : 0.35);
    const { dabs, carry } = dabsAlong(s.last, next, Math.max(0.6, next.r * (s.tool === 'pencil' ? 0.18 : 0.28)), s.carry);
    s.carry = carry; s.last = next; if (dabs.length) this.place(dabs);
  }
  place(dabs) {
    const s = this.stroke, area = s.tool === 'area', g = area ? this.mg : this.bg; let rect = null;
    for (const d of dabs) { this.dab(g, d.x, d.y, d.r, s.tool); rect = unionRect(rect, dabRect(d.x, d.y, d.r, this.W, this.H)); }
    if (!rect) return; s.rect = unionRect(s.rect, rect); this.redraw(rect);
  }
  // The stroke lands on the picture (or the area), one undo step. Returns whether it changed anything.
  end() {
    const s = this.stroke; this.stroke = null; if (!s) return false;
    const r = s.rect && clampRect(s.rect, this.W, this.H);
    if (s.tool === 'area') {
      this.mg.globalCompositeOperation = 'source-over';
      if (!r || !s.before) return false;
      const before = new ImageData(s.before.data.slice(0), this.W, this.H), b = this.cut(before, r);
      this.history.push({ word: this.areaAdd ? 'adding to the area' : 'taking from the area', patches: [{ on: 'mask', rect: r, before: b, after: this.mg.getImageData(r[0], r[1], r[2], r[3]) }] });
      this.redraw(r); this.changed = true; return true;
    }
    if (!r) return false;
    const before = this.g.getImageData(r[0], r[1], r[2], r[3]);
    if (s.tool === 'eraser') { this.g.globalCompositeOperation = 'destination-out'; this.g.drawImage(this.buf, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]); this.g.globalCompositeOperation = 'source-over'; }
    else { this.clipped(r); this.g.globalAlpha = this.opacity; this.g.drawImage(this.tmp, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]); this.g.globalAlpha = 1; }
    this.bg.clearRect(r[0], r[1], r[2], r[3]);
    const after = this.g.getImageData(r[0], r[1], r[2], r[3]);
    if (same(before.data, after.data)) { this.redraw(r); return false; }
    this.history.push({ word: s.tool === 'eraser' ? 'rubbing out' : 'a stroke', patches: [{ on: 'art', rect: r, before, after }] });
    this.redraw(r); this.changed = true; this.strokes++; return true;
  }
  // A stroke that turned out to be the start of a pinch: taken back with nothing left behind.
  drop() {
    const s = this.stroke; this.stroke = null; if (!s || !s.rect) return;
    const r = clampRect(s.rect, this.W, this.H); if (!r) return;
    if (s.tool === 'area') { this.mg.globalCompositeOperation = 'source-over'; if (s.before) this.mg.putImageData(s.before, 0, 0, r[0], r[1], r[2], r[3]); }
    else this.bg.clearRect(r[0], r[1], r[2], r[3]);
    this.redraw(r);
  }
  cut(img, r) { const c = canvasOf(img.width, img.height), g = ctx(c); g.putImageData(img, 0, 0); return g.getImageData(r[0], r[1], r[2], r[3]); }
  apply(step, which) {
    for (const p of step.patches) { const g = p.on === 'mask' ? this.mg : this.g; if (!g) continue; g.putImageData(p[which], p.rect[0], p.rect[1]); this.redraw(p.rect); }
    this.changed = true;
  }
  undo() { if (this.stroke) this.drop(); const s = this.history.undo(); if (s) this.apply(s, 'before'); return s; }
  redo() { const s = this.history.redo(); if (s) this.apply(s, 'after'); return s; }
  setTool(t) { if (DRAW_TOOLS.includes(t)) { if (this.stroke) this.end(); this.tool = t; this.redraw(); } }
  setClip(on) { this.clip = !!on && !!this.mask; this.redraw(); }
  // what is drawn, as a box in art pixels, or null
  inkBox() { return alphaBounds(this.g.getImageData(0, 0, this.W, this.H).data, this.W, this.H); }
  // the picture as a PNG data URL, cut to box when given
  encode(box = null) {
    if (this.stroke) this.end();
    if (!box) return this.art.toDataURL('image/png');
    const c = canvasOf(box.w, box.h); c.getContext('2d').drawImage(this.art, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    const url = c.toDataURL('image/png'); c.width = c.height = 0; return url;
  }
  dispose() { for (const c of [this.art, this.buf, this.tmp]) c.width = c.height = 0; if (this.mask) this.mask.width = this.mask.height = 0; this.history = new StrokeHistory(); }
}
function same(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i += 4) if (a[i + 3] !== b[i + 3] || a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) return false; return true; }
