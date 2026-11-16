// Measured wrap studio: one workspace for planning a wrap round an arm or leg from your own tape
// measurements. Measurements (rings and the length between them), Existing tattoo (photos
// straightened, scaled from a known length, matched by landmarks, the old ink traced and the gaps
// in it protected, then locked), and Design (separate plant pictures arranged on the flat measured
// shape, with the front focal point marked and overlaps with the old ink warned). The flat
// template and the body show the same thing at once: the body wears the measured area as a thin
// layer over its skin, cut along the seam.
//
// Everything lives in state.regions (see measured-region.js), so undo, backups and account sync
// carry it. Lengths are millimetres inside; inches or millimetres on screen.
import * as G from './wrap-geometry.js';
import * as R from './measured-region.js';
import * as K from './wrap-register.js';
import * as PP from './print-profiles.js';
import * as P from './procreate-package.js';

let C = null; // what the app gives the studio (see initWrapStudio)
const ui = { printKind: 'stencil', printOut: null, cutDrag: null, ppi: 300, pkgFormat: 'psd', pkg: null, review: null, busy: '', step: 'measure', view: 'all', sub: 'photos', sel: null, mode: null, brush: 4, holdBefore: false, open: false, fitted: false, lmKey: null };
const $s = (q) => root && root.querySelector(q);
let root = null, cv = null, ctx2 = null, side = null, insp = null;
const view = { s: 1, cx: 0, cy: 0, W: 1, H: 1, fitFor: '' };
const units = () => { try { return localStorage.getItem('ia-units') === 'mm' ? 'mm' : 'in'; } catch (_) { return 'in'; } };
const setUnits = (u) => { try { localStorage.setItem('ia-units', u); } catch (_) { /* ignore */ } };
const nowIso = () => new Date().toISOString().slice(0, 19) + 'Z';
const uid = () => Math.random().toString(36).slice(2, 10);

function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
  return n;
}
const S = () => C.getState();
function reg() { const list = S().regions; if (!Array.isArray(list) || !list.length) return null; return list.find((r) => r.id === ui.regionId) || list[0]; }
const tplCache = { key: '', t: null };
function tpl(r = reg()) { if (!r) return null; const k = R.measureKey(r); if (tplCache.key !== k) { tplCache.key = k; tplCache.t = R.templateOf(r); } return tplCache.t; }
const fmt = (mm, d) => R.fmtLen(mm, units(), d);
const fmtT = (mm) => fmt(mm).replace(/(\.\d*?)0+ (in|mm)$/, '$1 $2').replace(/\. (in|mm)$/, ' $1');
// change the project: one undo step, saved, everything redrawn
function change(fn) { C.snapshot(); fn(); C.commit(); }

/* ---------------- style (uses the app's tokens only) ---------------- */
const CSS = `
#wrapStudio{position:fixed;left:0;right:0;bottom:0;height:min(66vh,760px);z-index:30;display:flex;flex-direction:column;background:var(--surface-solid);border-top:1px solid var(--line);border-radius:var(--r-lg) var(--r-lg) 0 0;box-shadow:var(--shadow);padding-bottom:env(safe-area-inset-bottom);color:var(--text)}
#wrapStudio[hidden]{display:none}
#wrapStudio.tall{height:calc(100% - var(--below,64px))}
@media (orientation:landscape) and (min-width:960px){#wrapStudio{left:auto;top:var(--below,64px);height:auto;width:min(60vw,860px);border-radius:var(--r-lg) 0 0 0;border-left:1px solid var(--line)}#wrapStudio.tall{width:calc(100% - 16px);height:auto}}
#wrapStudio header{display:flex;align-items:center;gap:10px;padding:10px 12px 6px 18px}
#wrapStudio header h2{font-size:19px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#wsTabs{display:flex;gap:4px;padding:0 12px 6px;overflow-x:auto;scrollbar-width:none}
#wsTabs .btn{flex:1 0 auto;min-width:96px}
#wsTabs .btn[aria-selected=true]{background:var(--stencil);color:var(--on-accent);border-color:var(--stencil)}
#wsInsp{margin:0 12px 6px;padding:6px 10px;border-radius:var(--r-md);background:var(--fill-soft);font-size:13px;line-height:1.35;color:var(--muted)}
#wsInsp b{color:var(--text);font-weight:600}
#wsInsp .warn{color:#e8a33d}
#wsMain{flex:1;min-height:0;display:flex;flex-direction:column}
@media (min-aspect-ratio:5/4){#wsMain{flex-direction:row}}
#wsFlat{position:relative;flex:1 1 55%;min-height:180px;min-width:0;margin:0 12px;border-radius:var(--r-md);overflow:hidden;background:var(--fill-soft)}
#wsFlat canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
#wsViews{position:absolute;left:8px;top:8px;display:flex;gap:4px;flex-wrap:wrap;max-width:calc(100% - 16px)}
#wsViews .btn{min-height:44px;padding:0 10px;font-size:13px;background:var(--surface)}
#wsViews .btn[aria-pressed=true]{background:var(--stencil);color:var(--on-accent);border-color:var(--stencil)}
#wsFlatHint{position:absolute;left:8px;right:8px;bottom:8px;font-size:13px;text-align:center;color:var(--text);pointer-events:none;text-shadow:0 1px 2px var(--surface-solid)}
#wsSide{flex:1 1 45%;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:8px 12px 16px;display:flex;flex-direction:column;gap:12px;touch-action:pan-y}
@media (min-aspect-ratio:5/4){#wsSide{flex:0 0 330px}}
#wsSide .shHead{margin:4px 2px -4px}
#wsSide .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#wsSide .row .btn{flex:1 1 auto}
#wsSide .seg .btn[aria-pressed=true]{background:var(--stencil);color:var(--on-accent);border-color:var(--stencil)}
#wsSide label.f{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted);flex:1 1 120px;min-width:0}
#wsSide input[type=text],#wsSide input[type=number],#wsSide select{min-height:44px;font:16px var(--body);color:var(--text);background:var(--fill);border:1px solid var(--line);border-radius:var(--r-md);padding:8px 12px;width:100%;-webkit-user-select:text;user-select:text}
#wsSide p,#wsSide li{font-size:14px;line-height:1.4;margin:0;color:var(--muted)}
#wsSide p b{color:var(--text)}
#wsSide .box{padding:10px 12px;border-radius:var(--r-md);background:var(--fill-soft);display:flex;flex-direction:column;gap:8px}
#wsSide .warnbox{padding:10px 12px;border-radius:var(--r-md);background:rgba(253,204,56,.12);border:1px solid rgba(253,204,56,.45);color:var(--text);font-size:14px;line-height:1.4}
#wsSide .okbox{padding:10px 12px;border-radius:var(--r-md);background:rgba(95,207,143,.12);border:1px solid rgba(95,207,143,.4);color:var(--text);font-size:14px;line-height:1.4}
#wsSide .steps{display:flex;flex-direction:column;gap:6px}
#wsSide .steps .btn{justify-content:flex-start;text-align:left;white-space:normal;min-height:48px;padding:6px 12px}
#wsSide .steps .btn[aria-current=true]{border-color:var(--stencil);background:var(--stencil-soft)}
#wsSide .steps .btn i{font-style:normal;display:inline-grid;place-items:center;width:24px;height:24px;border-radius:12px;background:var(--fill-strong);font-size:13px;flex:none}
#wsSide .steps .btn.done i{background:var(--good);color:#06240f}
#wsSide .plist{display:flex;flex-direction:column;gap:6px}
#wsSide .plist .prow{display:flex;gap:8px;align-items:center}
#wsSide .plist .prow .btn.name{flex:1;justify-content:flex-start;overflow:hidden;text-overflow:ellipsis}
#wsSide .plist img{width:40px;height:40px;object-fit:contain;border-radius:8px;background:#fff;flex:none}
#wsSide .plist .prow[aria-current=true] .btn.name{border-color:var(--stencil);background:var(--stencil-soft)}
#wsAsk{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.35);display:grid;place-items:center;padding:16px}
#wsAsk[hidden]{display:none}
#wsAsk .glass{max-width:420px;padding:16px;display:flex;flex-direction:column;gap:12px}
#wsAsk p{margin:0;font-size:15px;line-height:1.4}
`;

/* ---------------- opening and closing ---------------- */
export function initWrapStudio(ctx) {
  C = ctx;
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  root = h('section', { id: 'wrapStudio', role: 'dialog', 'aria-label': 'Measured wrap', hidden: true });
  document.body.append(root);
  return { open, close, refresh, isOpen: () => ui.open, tapBody, overlay: () => overlay, api: testApi() };
}

function open(step) {
  ui.open = true; root.hidden = false; C.closePanels && C.closePanels();
  if (step) ui.step = step;
  build(); refresh(); aimAt(ui.step === 'design' ? 90 : 270);
  C.markTried && C.markTried('measuredWrap');
}
function close() {
  ui.open = false; ui.mode = null; root.hidden = true; root.replaceChildren(); cv = null;
  if (overlay) overlay.set(null, false);
  C.requestRender();
}

function build() {
  const r = reg();
  root.replaceChildren(
    h('header', {}, h('h2', { id: 'wsTitle', text: r ? r.name : 'Measured wrap' }),
      h('button', { class: 'btn', type: 'button', id: 'wsTall', 'aria-pressed': String(root.classList.contains('tall')), text: root.classList.contains('tall') ? 'Show body' : 'Bigger', onclick: () => { root.classList.toggle('tall'); build(); refresh(); } }),
      h('button', { class: 'btn', type: 'button', id: 'wsDone', text: 'Done', onclick: close })),
    h('div', { id: 'wsTabs', role: 'tablist' }, ...[['measure', 'Measurements'], ['existing', 'Existing tattoo'], ['design', 'Design'], ['procreate', 'Procreate'], ['print', 'Print']].map(([k, label]) =>
      h('button', { class: 'btn', type: 'button', role: 'tab', 'data-step': k, 'aria-selected': String(ui.step === k), text: label, onclick: () => { ui.step = k; ui.mode = null; ui.sel = null; build(); refresh(); if (k === 'design') aimAt(90); if (k === 'existing') aimAt(270); } }))),
    h('div', { id: 'wsInsp', 'aria-live': 'polite' }),
    h('div', { id: 'wsMain' },
      h('div', { id: 'wsFlat' }, h('canvas', { id: 'wsCanvas', 'aria-label': 'The measured wrap laid flat' }),
        h('div', { id: 'wsViews', role: 'group', 'aria-label': 'Show' }, ...[['all', 'Together'], ['existing', 'Existing ink'], ['new', 'New art'], ['protected', 'Protected']].map(([k, label]) =>
          h('button', { class: 'btn', type: 'button', 'data-view': k, 'aria-pressed': String(ui.view === k), text: label, onclick: () => { ui.view = k; refreshViews(); draw(); syncOverlay(); } }))),
        h('div', { id: 'wsFlatHint' })),
      h('div', { id: 'wsSide' })),
    h('div', { id: 'wsAsk', hidden: true }));
  cv = $s('#wsCanvas'); ctx2 = cv.getContext('2d'); side = $s('#wsSide'); insp = $s('#wsInsp');
  bindCanvas(); view.fitFor = '';
  if (!r) $s('#wsTabs').hidden = true;
}
function refreshViews() { if (!root) return; for (const b of root.querySelectorAll('#wsViews .btn')) b.setAttribute('aria-pressed', String(b.dataset.view === ui.view)); }

// Redraw everything from the project (after any change, undo or redo).
function refresh() {
  if (!ui.open || !root) return;
  const r = reg();
  if (!r) { renderStart(); draw(); return; }
  if (root.querySelector('#wsTabs').hidden) { build(); }
  $s('#wsTitle').textContent = r.name;
  if (ui.sel && !(r.art?.pieces || []).some((p) => p.id === ui.sel)) ui.sel = null;
  for (const b of root.querySelectorAll('#wsTabs .btn')) b.setAttribute('aria-selected', String(b.dataset.step === ui.step));
  renderInspector(r); renderSide(r); refreshViews(); draw(); syncOverlay();
}

// in-studio question with two answers
function ask(text, yes, no = 'Cancel') {
  return new Promise((res) => {
    const box = $s('#wsAsk'); box.hidden = false;
    box.replaceChildren(h('div', { class: 'glass' }, h('p', { text }), h('div', { class: 'row', style: 'display:flex;gap:8px' },
      h('button', { class: 'btn', type: 'button', text: no, onclick: () => { box.hidden = true; res(false); } }),
      h('button', { class: 'btn primary', type: 'button', text: yes, onclick: () => { box.hidden = true; res(true); } }))));
  });
}

/* ---------------- start ---------------- */
function renderStart() {
  $s('#wsTabs').hidden = true; insp.textContent = 'Plan a wrap from your own tape measurements.';
  side.replaceChildren(
    h('p', { text: 'Measure round the limb at the bottom and top of the area, and the length between. The flat shape for Procreate and the printed stencil come from these numbers, not from the 3D body.' }),
    h('label', { class: 'f' }, 'Where', h('select', { id: 'wsStartLimb' }, ...R.LIMBS.map((k) => h('option', { value: k, text: R.LIMB_NAMES[k] })))),
    h('button', { class: 'btn primary', type: 'button', id: 'wsStart', text: 'Start with my ankle numbers', onclick: () => {
      const limb = $s('#wsStartLimb').value, r = R.startingRegion(limb);
      r.focal = { deg: 90, at: 0.5, w: 90, h: 70 };
      change(() => { S().regions = [...(S().regions || []), r]; ui.regionId = r.id; });
      build(); refresh(); aimAt(270);
    } }),
    h('p', { text: 'Starts at 9 in round at the bottom, 12.5 in at the top and 4 in between, as you measured round your cactus. Change any of them next.' }));
}

/* ---------------- inspector: always on, the numbers that matter ---------------- */
function warnings(r) {
  const t = tpl(r), out = [];
  if (!r.methodConfirmed) out.push(`Confirm how the ${fmtT(r.levels[1].gap)} was measured: along the skin or straight up.`);
  for (let i = 1; i < r.levels.length; i++) if (r.levels[i].gap > 130) out.push('Rings more than about 5 in apart: add one in between, since the shape between them is a guess.');
  if (!r.existing?.ink) out.push('The existing tattoo is not traced yet, so nothing protects it.');
  const width = inkWidth(r); if (!width) out.push('The existing tattoo’s width is not measured yet.');
  if (t && cutThroughFocal(r)) out.push('The cut runs through the front focal point. Move it to the inside or outside.');
  if (r.existing && cutThroughInk(r)) out.push('The cut runs through the existing tattoo. Move it.');
  if (r.existing?.maskCalib && r.existing.maskCalib !== r.calib) out.push('The measurements changed after the existing tattoo was traced. Check it still sits right.');
  return out;
}
function renderInspector(r) {
  const t = tpl(r); if (!t) { insp.textContent = 'These measurements do not make a shape. Check the numbers.'; return; }
  const s = G.summary(t), how = r.method === 'skin' ? 'along the skin' : 'straight up';
  const w = inkWidth(r);
  insp.replaceChildren(
    h('div', {}, h('b', { text: `${fmtT(r.levels[0].circ)} round at the bottom, ${fmtT(r.levels[r.levels.length - 1].circ)} at the top, ${fmtT(r.levels.slice(1).reduce((a, l) => a + l.gap, 0))} ${how}` }),
      r.methodConfirmed ? '' : h('span', { class: 'warn', text: ' (not confirmed)' })),
    h('div', { text: `Flat shape ${fmt(s.w)} × ${fmt(s.h)} · cut on the ${seamName(r.seam).toLowerCase()} · ${R.LIMB_NAMES[r.limb].toLowerCase()}` + (w ? ` · old tattoo about ${fmt(w)} wide (from the photo, an estimate)` : '') }),
    ...warnings(r).slice(0, 2).map((x) => h('div', { class: 'warn', text: x })));
}
const seamName = (deg) => (R.SEAMS.find(([d]) => d === deg) || [0, `${deg}°`])[1];

/* ---------------- side panel per step ---------------- */
function renderSide(r) {
  const keepScroll = side.scrollTop;
  if (ui.step === 'measure') side.replaceChildren(...measurePanel(r));
  else if (ui.step === 'existing') side.replaceChildren(...existingPanel(r));
  else if (ui.step === 'procreate') side.replaceChildren(...procreatePanel(r));
  else if (ui.step === 'print') side.replaceChildren(...printPanel(r));
  else side.replaceChildren(...designPanel(r));
  side.scrollTop = keepScroll;
  hint();
}
function hint(text) {
  const el = $s('#wsFlatHint'); if (!el) return;
  if (text != null) { el.textContent = text; return; }
  const r = reg(); let t = '';
  if (ui.mode && ui.mode.startsWith('band:')) t = 'Tap the body where you measured this ring.';
  else if (ui.mode && ui.mode.startsWith('lm:')) t = `Tap the photo on: ${landmarkName(ui.mode.slice(3))}`;
  else if (ui.mode && ui.mode.startsWith('brush:')) t = 'Draw with your finger or Pencil. Two fingers move the view.';
  else if (ui.step === 'existing' && ui.sub === 'straighten') t = 'Drag the four corners onto the edges of the paper or a rectangle on your skin. Leave them at the photo’s corners if it was taken square on.';
  else if (ui.step === 'design') t = (r?.art?.pieces?.length ? 'Drag a plant to move it. Two fingers on it size and turn it.' : 'Add plant pictures to start arranging the garden.');
  el.textContent = t;
}

function seg(items, current, on, cls = '') {
  return h('div', { class: 'seg' + (items.length === 4 ? ' four' : '') + (cls ? ' ' + cls : ''), role: 'group', style: `grid-template-columns:repeat(${items.length},1fr)` }, ...items.map(([v, label]) =>
    h('button', { class: 'btn', type: 'button', 'aria-pressed': String(v === current), 'data-v': String(v), text: label, onclick: () => on(v) })));
}
function lenInput(id, mm, onSet, label) {
  const inp = h('input', { type: 'text', inputmode: 'decimal', id, value: R.fmtLen(mm, units()).replace(/ (in|mm)$/, ''), 'aria-label': label });
  inp.addEventListener('change', () => { const v = R.parseLen(inp.value, units()); if (!Number.isFinite(v) || v <= 0) { C.toast('Type a length, like 9 or 228.6 mm.'); inp.value = R.fmtLen(mm, units()).replace(/ (in|mm)$/, ''); return; } onSet(v); });
  return h('label', { class: 'f' }, label + ` (${units()})`, inp);
}

// a measurement change: asks first when it would move a traced tattoo or an approved print
async function measure(fn) {
  const r = reg(); const before = R.measureKey(r);
  const copy = JSON.parse(JSON.stringify(r)); fn(copy);
  if (R.measureKey(copy) !== before) {
    if (!R.templateOf(copy)) { C.toast('Those numbers do not make a shape: a length along the skin must be longer than the change in radius.'); refresh(); return; }
    if (r.approved || r.existing?.ink) {
      const ok = await ask(r.approved ? 'This wrap is approved for printing. Changing its measurements takes the approval off, and the traced tattoo may need checking. Change it?' : 'The existing tattoo was traced on the old measurements. Change them and check its place after?', 'Change it');
      if (!ok) { refresh(); return; }
    }
  }
  change(() => { const x = reg(); fn(x); if (R.measureKey(x) !== before) { x.calib = (x.calib || 1) + 1; delete x.approved; } });
}

function measurePanel(r) {
  const u = units(), t = tpl(r), s = t && G.summary(t);
  const rows = [];
  for (let i = r.levels.length - 1; i >= 0; i--) {
    const l = r.levels[i];
    rows.push(h('div', { class: 'box' },
      h('div', { class: 'row' }, h('b', { text: l.label || (i === 0 ? 'Bottom ring' : i === r.levels.length - 1 ? 'Top ring' : `Ring ${i + 1}`) })),
      h('div', { class: 'row' }, lenInput('wsCirc' + i, l.circ, (v) => measure((x) => { x.levels[i].circ = v; }), 'Round'),
        h('button', { class: 'btn', type: 'button', id: 'wsPin' + i, 'aria-pressed': String(ui.mode === 'band:' + i), text: l.pin ? 'Moved on body' : 'Set on body', onclick: () => { ui.mode = ui.mode === 'band:' + i ? null : 'band:' + i; refresh(); aimAt(270); } }),
        r.levels.length > 2 ? h('button', { class: 'btn', type: 'button', 'aria-label': 'Remove this ring', text: 'Remove', onclick: () => measure((x) => { x.levels.splice(i, 1); if (i === 0) delete x.levels[0].gap; }) }) : '')));
    if (i > 0) rows.push(h('div', { class: 'row' }, lenInput('wsGap' + i, l.gap, (v) => measure((x) => { x.levels[i].gap = v; }), r.method === 'skin' ? 'Length along the skin' : 'Height straight up')));
  }
  return [
    h('div', { class: 'row' }, h('span', { text: 'Units', style: 'color:var(--muted);font-size:13px' }), seg([['in', 'Inches'], ['mm', 'Millimetres']], u, (v) => { setUnits(v); refresh(); })),
    h('h3', { class: 'shHead', text: 'Rings, top to bottom' }),
    h('button', { class: 'btn', type: 'button', id: 'wsAddTop', text: 'Add a ring above', disabled: r.levels.length >= R.MAX_LEVELS, onclick: () => measure((x) => { const top = x.levels[x.levels.length - 1]; x.levels.push({ id: uid(), circ: top.circ, gap: 25.4 }); }) }),
    ...rows,
    h('button', { class: 'btn', type: 'button', id: 'wsAddBottom', text: 'Add a ring below', disabled: r.levels.length >= R.MAX_LEVELS, onclick: () => measure((x) => { const b = x.levels[0]; x.levels[0] = { ...b, gap: 25.4 }; x.levels.unshift({ id: uid(), circ: b.circ }); }) }),
    h('h3', { class: 'shHead', text: 'How the length was measured' }),
    seg([['skin', 'Along the skin'], ['axial', 'Straight up']], r.method, (v) => measure((x) => { x.method = v; })),
    h('button', { class: 'btn', type: 'button', id: 'wsConfirm', 'aria-pressed': String(r.methodConfirmed), text: r.methodConfirmed ? 'Confirmed: I measured it this way' : 'I measured it this way', onclick: () => change(() => { reg().methodConfirmed = !reg().methodConfirmed; }) }),
    h('p', { text: 'Along the skin is a tape laid on the leg. Straight up is a ruler held upright beside it. Until you confirm, the flat shape uses along the skin.' }),
    h('h3', { class: 'shHead', text: 'Where the cut runs' }),
    seg(R.SEAMS, r.seam, (v) => change(() => { reg().seam = v; })),
    h('p', { text: 'The flat shape is cut here and laid open. Keep it away from the existing tattoo and the front focal point.' }),
    h('h3', { class: 'shHead', text: 'Limb' }),
    h('select', { id: 'wsLimb', 'aria-label': 'Limb', onchange: (e) => change(() => { reg().limb = e.target.value; }) }, ...R.LIMBS.map((k) => h('option', { value: k, text: R.LIMB_NAMES[k], selected: k === r.limb }))),
    s ? h('div', { class: 'box', id: 'wsSummary' },
      h('p', {}, 'Bottom arc ', h('b', { text: R.fmtBoth(s.lower, u) })),
      h('p', {}, 'Middle arc ', h('b', { text: R.fmtBoth(s.middle, u) })),
      h('p', {}, 'Top arc ', h('b', { text: R.fmtBoth(s.upper, u) })),
      h('p', {}, 'Along the skin ', h('b', { text: R.fmtBoth(s.slant, u) }), ' · straight up ', h('b', { text: R.fmtBoth(s.height, u) })),
      h('p', {}, 'Flat shape ', h('b', { text: `${fmt(s.w, u === 'in' ? 3 : 2)} × ${fmt(s.h, u === 'in' ? 3 : 2)}` }), ' (the box round the curved shape, never stretched to the top ring)')) : '',
    h('p', { text: 'These numbers come from your tape. The 3D body only shows where they sit; it does not change them, and neither does any paper setting.' }),
  ];
}

/* ---------------- the existing tattoo ---------------- */
const SUBS = [['photos', 'Add a photo or stencil'], ['straighten', 'Straighten it'], ['landmarks', 'Mark the landmarks'], ['place', 'Scale and place it'], ['trace', 'Trace the old ink'], ['lock', 'Lock it']];
function activePhoto(r = reg()) { const e = r?.existing; if (!e?.photos?.length) return null; return e.photos.find((p) => p.id === e.active) || e.photos[0]; }
function landmarkName(key) { const r = reg(); const m = (r?.existing?.landmarks || []).find((l) => (l.key || l.id) === key); return m ? m.name : (K.LANDMARKS.find((l) => l.key === key) || {}).name || 'landmark'; }
function subDone(k, r) {
  const e = r.existing || {}, p = activePhoto(r);
  if (k === 'photos') return !!p;
  if (k === 'straighten') return !!p?.quad;
  if (k === 'landmarks') return (e.landmarks || []).filter((l) => l.src && p && l.src[p.id]).length >= 2;
  if (k === 'place') return !!p?.fit;
  if (k === 'trace') return !!e.ink;
  return !!e.locked;
}
function existingPanel(r) {
  const e = r.existing || {}, locked = !!e.locked, p = activePhoto(r);
  const steps = h('div', { class: 'steps' }, ...SUBS.map(([k, label], i) => h('button', { class: 'btn' + (subDone(k, r) ? ' done' : ''), type: 'button', 'data-sub': k, 'aria-current': String(ui.sub === k), onclick: () => { ui.sub = k; ui.mode = null; view.fitFor = ''; refresh(); } }, h('i', { text: subDone(k, r) ? '✓' : String(i + 1) }), h('span', { text: label }))));
  const out = [steps];
  const lockedNote = locked ? h('div', { class: 'okbox', text: 'The existing tattoo is locked. Unlock it under Lock it to change anything here.' }) : null;
  if (ui.sub === 'photos') {
    out.push(h('p', { text: 'A photo of the tattoo, the original stencil or a see-through PNG. Each picture is kept exactly as it is; more photos can help match the landmarks.' }));
    out.push(fileButton('wsAddPhoto', 'Add a photo or stencil', true, locked, addPhotos));
    out.push(h('div', { class: 'plist' }, ...(e.photos || []).map((ph) => h('div', { class: 'prow', 'aria-current': String(ph.id === e.active) },
      thumb(ph.img), h('button', { class: 'btn name', type: 'button', text: ph.name || 'Photo', onclick: () => change(() => { reg().existing.active = ph.id; }) }),
      h('button', { class: 'btn', type: 'button', disabled: locked, text: 'Remove', onclick: () => change(() => { const x = reg().existing; x.photos = x.photos.filter((q) => q.id !== ph.id); for (const l of x.landmarks || []) if (l.src) delete l.src[ph.id]; if (!x.photos.length) delete x.photos; x.active = x.photos?.[0]?.id; }) })))));
  } else if (ui.sub === 'straighten') {
    if (!p) out.push(h('p', { text: 'Add a photo first.' }));
    else out.push(h('p', { text: 'A photo taken at an angle makes the tattoo look squashed. Drag the corners onto something rectangular in the photo, like the paper’s edges or a square drawn on the skin, and the picture is straightened. The photo itself is kept unchanged.' }),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', disabled: locked, text: 'Reset corners', onclick: () => change(() => { const ph = activePhoto(); setQuad(ph, null); }) }),
        h('button', { class: 'btn primary', type: 'button', disabled: locked, text: 'Next', onclick: () => { if (!p.quad) change(() => { activePhoto().quad = cornersOf(activePhoto()); }); ui.sub = 'landmarks'; view.fitFor = ''; refresh(); } })));
  } else if (ui.sub === 'landmarks') {
    if (!p) out.push(h('p', { text: 'Add a photo first.' }));
    else {
      const lms = e.landmarks || [];
      out.push(h('p', { text: 'Tap a landmark, then tap where it is on the photo. Drag a pin to fine-tune it. The top flower and the bottom of the stone base set the size.' }));
      out.push(h('div', { class: 'steps' }, ...K.LANDMARKS.concat(lms.filter((l) => !K.LANDMARKS.some((k) => k.key === l.key)).map((l) => ({ key: l.key || l.id, name: l.name }))).map((L) => {
        const m = lms.find((l) => (l.key || l.id) === L.key), on = m && m.src && m.src[p.id];
        return h('button', { class: 'btn' + (on ? ' done' : ''), type: 'button', disabled: locked, 'aria-current': String(ui.mode === 'lm:' + L.key), 'data-lm': L.key, onclick: () => { ui.mode = ui.mode === 'lm:' + L.key ? null : 'lm:' + L.key; refresh(); } }, h('i', { text: on ? '✓' : '+' }), h('span', { text: L.name }));
      })));
      out.push(h('button', { class: 'btn', type: 'button', disabled: locked, text: 'Add another join', onclick: () => change(() => { const x = reg().existing; const n = (x.landmarks || []).filter((l) => /^j/.test(l.key || '')).length + 1; x.landmarks = [...(x.landmarks || []), { id: uid(), key: 'j' + (n + 2) + uid().slice(0, 2), name: `Trunk and arm join ${n + 2 > 2 ? n + 2 : n}` }]; }) }));
      out.push(h('button', { class: 'btn primary', type: 'button', text: 'Next', onclick: () => { ui.sub = 'place'; ui.mode = null; view.fitFor = ''; refresh(); } }));
    }
  } else if (ui.sub === 'place') {
    const top = lmSrc(r, 'top'), base = lmSrc(r, 'base');
    out.push(h('p', { text: 'The size comes from one measured length: the top flower to the bottom of the stone base. Then the photo is stood upright with its base on the bottom ring, on the back of the leg.' }));
    out.push(h('div', { class: 'row' }, lenInput('wsKnown', e.knownMm || 101.6, (v) => change(() => { ex(reg()).knownMm = v; placePhoto(); }), 'Top flower to base'),
      h('label', { class: 'f' }, 'Measured', seg([['vertical', 'Straight up'], ['skin', 'Along the skin']], e.knownHow || 'vertical', (v) => change(() => { ex(reg()).knownHow = v; placePhoto(); })))));
    if (!top || !base) out.push(h('div', { class: 'warnbox', text: 'Mark the top flower and the bottom of the stone base on the photo first.' }));
    else out.push(h('button', { class: 'btn primary', type: 'button', id: 'wsPlace', disabled: locked, text: p?.fit ? 'Place it again from the landmarks' : 'Scale and place it', onclick: () => change(() => placePhoto()) }));
    if (p?.fit) {
      out.push(h('p', { text: 'Drag the photo on the flat shape to fine-tune where it sits. Its size stays fixed by the measured length.' }));
      out.push(h('label', { class: 'f' }, 'Turn', slider(-30, 30, 0.5, p.fit.rot || 0, (v, done) => { const ph = activePhoto(); if (!ph?.fit || locked) return; if (done) change(() => { activePhoto().fit.rot = v; }); else { ph.fit.rot = v; draw(); syncOverlay(); } })));
      out.push(h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', disabled: locked, 'aria-pressed': String(!!p.fit.flip), text: 'Mirror', onclick: () => change(() => { const f = activePhoto().fit; f.flip = !f.flip; placePhoto(true); }) }),
        h('label', { class: 'f' }, 'See-through', slider(0.2, 1, 0.05, p.opacity ?? 0.85, (v, done) => { const ph = activePhoto(); if (done) change(() => { activePhoto().opacity = v; }); else { ph.opacity = v; draw(); syncOverlay(); } }))));
      const miss = registrationMiss(r); if (miss != null) out.push(h('p', { text: `Landmarks from your other photos land within ${fmt(miss, 2)} of this one.` }));
      out.push(h('div', { class: 'okbox', text: 'From your tape: the length and the rings. From the photo (an estimate): the shape and width of the cactus. A photo cannot measure how the skin curves, so print and hold the stencil on the leg before trusting the fit.' }));
    }
  } else if (ui.sub === 'trace') {
    out.push(h('p', { text: 'Mark the old ink, and the bare skin that must stay bare, like the gaps between the floating cactus pieces. New art is warned off both.' }));
    out.push(h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', id: 'wsFindInk', disabled: locked || !p?.fit, text: e.ink ? 'Find the ink again' : 'Find the ink in the photo', onclick: findInk }),
      h('button', { class: 'btn', type: 'button', id: 'wsFindGaps', disabled: locked || !e.ink, text: 'Protect the gaps', onclick: findGaps })));
    out.push(h('h3', { class: 'shHead', text: 'Touch up by hand' }));
    out.push(seg([['brush:ink+', 'Add ink'], ['brush:ink-', 'Rub out ink'], ['brush:gap+', 'Protect skin'], ['brush:gap-', 'Unprotect']], ui.mode, (v) => { if (locked) return; ui.mode = ui.mode === v ? null : v; ui.view = v.startsWith('brush:gap') ? 'protected' : ui.view; refresh(); }));
    out.push(h('label', { class: 'f' }, `Brush ${fmt(ui.brush, 1)}`, slider(1, 12, 0.5, ui.brush, (v) => { ui.brush = v; })));
    out.push(h('label', { class: 'f' }, `Clear margin round the old ink: ${fmt(e.buffer ?? 2, 1)}`, slider(0, 8, 0.5, e.buffer ?? 2, (v, done) => { if (done) change(() => { ex(reg()).buffer = v; }); else { ex(reg()).buffer = v; collisions.key = ''; draw(); } })));
    if (!p?.fit) out.push(h('div', { class: 'warnbox', text: 'Scale and place the photo first, or draw the old ink by hand.' }));
  } else {
    out.push(h('p', { text: locked ? 'Locked: the photos, landmarks and traced ink stay exactly where they are.' : 'Lock the existing tattoo when it sits right, so nothing moves it by accident.' }));
    out.push(h('button', { class: 'btn primary', type: 'button', id: 'wsLock', 'aria-pressed': String(locked), text: locked ? 'Unlock the existing tattoo' : 'Lock the existing tattoo', onclick: () => change(() => { const x = ex(reg()); x.locked = !x.locked; if (x.locked) storeLandmarkSpots(); }) }));
    const done = SUBS.slice(0, 5).filter(([k]) => !subDone(k, r)); if (done.length && !locked) out.push(h('div', { class: 'warnbox', text: 'Not done yet: ' + done.map(([, l]) => l.toLowerCase()).join(', ') + '.' }));
  }
  if (lockedNote && ui.sub !== 'lock') out.unshift(lockedNote);
  return out;
}
const ex = (r) => (r.existing = r.existing || {});
function lmSrc(r, key, p = activePhoto(r)) { const m = (r.existing?.landmarks || []).find((l) => (l.key || l.id) === key); return m && p && m.src && m.src[p.id]; }
function cornersOf(p) { return [[0, 0], [p.pw, 0], [p.pw, p.ph], [0, p.ph]]; }
// a photo's straightening; landmarks already on it keep their spot on the photo
function setQuad(p, quad) {
  const before = straightOf(p); p.quad = quad || cornersOf(p);
  if (!quad) delete p.quad;
  const after = straightOf(p), r = reg();
  for (const l of r.existing?.landmarks || []) if (l.src && l.src[p.id] && before && after) { const raw = K.applyH(before.Hi, ...l.src[p.id]); l.src[p.id] = K.applyH(after.H, ...raw); }
  if (p.fit && before && after) p.fit.mmPerPx *= before.w / after.w;
}
function straightOf(p) { if (!p?.pw) return null; return K.straighten(p.quad || cornersOf(p), 2400); }

// scale from the known length, stand it upright, base on the bottom ring at the back
function placePhoto(keepPlace) {
  const r = reg(), p = activePhoto(r), st = straightOf(p), t = tpl(r); if (!p || !st || !t) return;
  const top = lmSrc(r, 'top'), base = lmSrc(r, 'base'); if (!top || !base) return;
  const e = ex(r), known = e.knownMm || 101.6;
  // a straight-up length is shorter than the same length along the sloping skin of the cone
  const g = t.segs[0], along = e.knownHow === 'skin' ? known : known * (g.s / Math.max(1e-9, g.h));
  const back = K.fAt(270, r.seam, r.limb), at = keepPlace && p.fit ? K.photoToTemplate(p.fit, st.w, st.h, ...base) : G.point(t, back, 0);
  const fit = K.calibrate(st.w, st.h, base, top, along, at, !!p.fit?.flip);
  if (fit) { p.fit = fit; storeLandmarkSpots(); }
  // other photos fitted from the shared landmarks, at their own scale
  for (const q of e.photos || []) if (q !== p) fitOther(r, q);
}
function storeLandmarkSpots() {
  const r = reg(), p = activePhoto(r), st = straightOf(p); if (!p?.fit || !st) return;
  for (const l of r.existing.landmarks || []) if (l.src && l.src[p.id]) l.at = K.photoToTemplate(p.fit, st.w, st.h, ...l.src[p.id]);
}
function fitOther(r, q) {
  const st = straightOf(q); if (!st) return;
  const pairs = (r.existing.landmarks || []).filter((l) => l.at && l.src && l.src[q.id]).map((l) => [l.src[q.id], l.at]);
  const res = K.fitLandmarks(st.w, st.h, pairs); if (res) q.fit = res.fit;
}
function registrationMiss(r) {
  const p = activePhoto(r); let miss = null;
  for (const q of r.existing?.photos || []) {
    if (q === p || !q.fit) continue; const st = straightOf(q);
    for (const l of r.existing.landmarks || []) if (l.at && l.src && l.src[q.id]) { const a = K.photoToTemplate(q.fit, st.w, st.h, ...l.src[q.id]); miss = Math.max(miss || 0, Math.hypot(a[0] - l.at[0], a[1] - l.at[1])); }
  }
  return miss;
}

async function addPhotos(files) {
  const added = [];
  for (const f of files) {
    const pic = await C.readPicture(f, 4096); if (!pic) { C.toast('That picture could not be opened.'); continue; }
    added.push({ id: uid(), img: C.putImage(pic.dataUrl), pw: pic.w, ph: pic.h, name: (f.name || 'Photo').replace(/\.[a-z0-9]+$/i, '').slice(0, 60) });
  }
  if (!added.length) return;
  change(() => { const e = ex(reg()); e.photos = [...(e.photos || []), ...added].slice(0, 6); e.active = e.active && e.photos.some((p) => p.id === e.active) ? e.active : added[0].id; if (!e.landmarks) e.landmarks = K.LANDMARKS.slice(0, 4).map((l) => ({ id: uid(), key: l.key, name: l.name })); });
  ui.sub = 'straighten'; view.fitFor = ''; refresh();
}

/* ---- masks ---- */
const mask = { key: '', ink: null, gap: null, w: 0, h: 0, ppmm: 4, o: [0, 0] };
// the mask grid for this region: its pictures as canvases, made when first needed
async function masks(create) {
  const r = reg(), e = r.existing || {};
  const k = [e.ink, e.gap, e.maskPpmm, JSON.stringify(e.maskO)].join('|');
  if (mask.key === k && (mask.ink || !create)) return mask;
  const t = tpl(r); if (!t) return null;
  let o = e.maskO, ppmm = e.maskPpmm || 4, w, hh;
  const im = e.ink ? await C.loadImg(e.ink) : null, ig = e.gap ? await C.loadImg(e.gap) : null;
  if (o && (im || ig)) { w = (im || ig).naturalWidth; hh = (im || ig).naturalHeight; }
  else { if (!create) { mask.key = k; mask.ink = mask.gap = null; return mask; } const b = t.bounds; o = [b.minX - 20, b.maxY + 20]; w = Math.ceil((b.w + 40) * ppmm); hh = Math.ceil((b.h + 40) * ppmm); }
  const mk = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; if (img) c.getContext('2d').drawImage(img, 0, 0); return c; };
  Object.assign(mask, { key: k, ink: mk(im), gap: mk(ig), w, h: hh, ppmm, o: o.slice() });
  return mask;
}
function saveMasks(m, which = ['ink', 'gap']) {
  change(() => {
    const e = ex(reg()); e.maskO = m.o.slice(); e.maskPpmm = m.ppmm; e.maskCalib = reg().calib;
    for (const n of which) { const c = m[n]; c.version = (c.version || 0) + 1; e[n] = C.putImage(c.toDataURL('image/png')); }
    mask.key = [e.ink, e.gap, e.maskPpmm, JSON.stringify(e.maskO)].join('|');
  });
}
const toMask = (m, x, y) => [(x - m.o[0]) * m.ppmm, (m.o[1] - y) * m.ppmm];
const fromMask = (m, mx, my) => [m.o[0] + mx / m.ppmm, m.o[1] - my / m.ppmm];

async function findInk() {
  const r = reg(), p = activePhoto(r), st = straightOf(p); if (!p?.fit || !st) return;
  C.toast('Finding the ink…');
  const pic = await warped(p); if (!pic) return;
  const m = await masks(true), W = pic.width, H = pic.height, g = pic.getContext('2d').getImageData(0, 0, W, H).data;
  const L = new Float32Array(W * H), A = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { L[i] = 0.299 * g[i * 4] + 0.587 * g[i * 4 + 1] + 0.114 * g[i * 4 + 2]; A[i] = g[i * 4 + 3]; }
  // the skin round each spot (a wide blur), so shading across the leg is not taken as ink
  const rad = Math.max(4, Math.round(8 / (p.fit.mmPerPx * st.w / W))), bg = boxBlur(L, W, H, rad);
  const see = A.some((a) => a < 250); // a see-through stencil: what is drawn is the ink
  const ink = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) ink[i] = see ? (A[i] > 100 && L[i] < 200 ? 1 : 0) : (bg[i] - L[i] > Math.max(18, 0.16 * bg[i]) ? 1 : 0);
  // only near the landmarks, when there are some: hair and shadows further off are not ink
  let box = null; const lms = (r.existing.landmarks || []).map((l) => l.src && l.src[p.id]).filter(Boolean);
  if (lms.length >= 2) { const xs = lms.map((q) => q[0] * W / st.w), ys = lms.map((q) => q[1] * H / st.h), pad = 12 / (p.fit.mmPerPx * st.w / W); box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]; }
  const out = m.ink.getContext('2d'), id = out.createImageData(m.w, m.h), d = id.data, sx = W / st.w, sy = H / st.h;
  for (let my = 0; my < m.h; my++) for (let mx = 0; mx < m.w; mx++) {
    const [x, y] = fromMask(m, mx + 0.5, my + 0.5), q = K.templateToPhoto(p.fit, st.w, st.h, x, y), px = Math.floor(q[0] * sx), py = Math.floor(q[1] * sy);
    if (px < 0 || py < 0 || px >= W || py >= H || (box && (px < box[0] || px > box[2] || py < box[1] || py > box[3]))) continue;
    if (ink[py * W + px]) { const o = (my * m.w + mx) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = 255; }
  }
  dropSpecks(d, m.w, m.h, Math.round(1.5 * m.ppmm * m.ppmm));
  out.clearRect(0, 0, m.w, m.h); out.putImageData(id, 0, 0);
  saveMasks(m, ['ink']); ui.view = 'protected'; refresh();
  C.toast('Found the ink. Rub out anything that is not the tattoo, then protect the gaps.');
}
async function findGaps() {
  const m = await masks(true), w = m.w, hh = m.h, a = m.ink.getContext('2d').getImageData(0, 0, w, hh).data, ink = new Uint8Array(w * hh);
  for (let i = 0; i < w * hh; i++) ink[i] = a[i * 4 + 3] > 100 ? 1 : 0;
  const gap = K.gapsBetween(ink, w, hh, Math.round(5 * m.ppmm)), g = m.gap.getContext('2d'), id = g.getImageData(0, 0, w, hh), d = id.data;
  for (let i = 0; i < w * hh; i++) if (gap[i]) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0); saveMasks(m, ['gap']); ui.view = 'protected'; refresh();
  C.toast('The gaps between the pieces of the old tattoo are protected.');
}
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let s = 0, n = 0; for (let x = -r; x < w; x++) { if (x + r < w) { s += src[y * w + x + r]; n++; } if (x - r - 1 >= 0) { s -= src[y * w + x - r - 1]; n--; } if (x >= 0) tmp[y * w + x] = s / n; } }
  for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let y = -r; y < h; y++) { if (y + r < h) { s += tmp[(y + r) * w + x]; n++; } if (y - r - 1 >= 0) { s -= tmp[(y - r - 1) * w + x]; n--; } if (y >= 0) out[y * w + x] = s / n; } }
  return out;
}
function dropSpecks(d, w, h, min) {
  const seen = new Uint8Array(w * h), stack = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || !d[i * 4 + 3]) continue;
    const comp = []; stack.push(i); seen[i] = 1;
    while (stack.length) { const j = stack.pop(); comp.push(j); const x = j % w; for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) if (k >= 0 && k < w * h && !seen[k] && d[k * 4 + 3]) { seen[k] = 1; stack.push(k); } }
    if (comp.length < min) for (const j of comp) d[j * 4 + 3] = 0;
  }
}
function inkWidth(r) {
  // width of the traced ink round the limb, measured along the arc at its widest: from the mask
  const m = mask; if (!r.existing?.ink || !m.ink || mask.key.indexOf(r.existing.ink) !== 0) return null;
  if (!m.widthFor || m.widthFor !== m.key) {
    const t = tpl(r), a = m.ink.getContext('2d').getImageData(0, 0, m.w, m.h).data; let lo = Infinity, hi = -Infinity;
    for (let my = 0; my < m.h; my += 2) for (let mx = 0; mx < m.w; mx += 2) if (a[(my * m.w + mx) * 4 + 3] > 100) { const q = fromMask(m, mx, my), f = G.invert(t, ...q); if (f) { const len = f.f * G.circAt(t, Math.min(t.slant, Math.max(0, f.u))); lo = Math.min(lo, len); hi = Math.max(hi, len); } }
    m.width = hi > lo ? hi - lo : null; m.widthFor = m.key;
  }
  return m.width;
}
function cutThroughFocal(r) { const fo = r.focal; if (!fo) return false; const t = tpl(r), f = K.fAt(fo.deg, r.seam, r.limb), half = fo.w / 2 / G.circAt(t, fo.at * t.slant); return Math.abs(f) + half > 0.5; }
function cutThroughInk(r) {
  const t = tpl(r); for (const l of r.existing?.landmarks || []) if (l.at) { const q = G.invert(t, ...l.at); if (q && Math.abs(q.f) > 0.45) return true; }
  return false;
}

/* ---- straightened photos, cached ---- */
const warpCache = new Map();
async function warped(p) {
  const st = straightOf(p); if (!st) return null;
  const k = p.img + '|' + JSON.stringify(p.quad || null);
  if (warpCache.has(k)) return warpCache.get(k);
  const im = await C.loadImg(p.img); if (!im) return null;
  const scale = Math.min(1, 1600 / Math.max(st.w, st.h)), W = Math.max(1, Math.round(st.w * scale)), H = Math.max(1, Math.round(st.h * scale));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  if (!p.quad) g.drawImage(im, 0, 0, W, H);
  else {
    const sw = im.naturalWidth, sh = im.naturalHeight, src = document.createElement('canvas'); src.width = sw; src.height = sh;
    const sg = src.getContext('2d'); sg.drawImage(im, 0, 0); const sd = sg.getImageData(0, 0, sw, sh).data, out = g.createImageData(W, H), od = out.data;
    const kx = sw / p.pw, ky = sh / p.ph;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const q = K.applyH(st.Hi, (x + 0.5) / scale, (y + 0.5) / scale), fx = q[0] * kx - 0.5, fy = q[1] * ky - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy);
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) continue;
      const ax = fx - x0, ay = fy - y0, o = (y * W + x) * 4;
      for (let ch = 0; ch < 4; ch++) { const i = (y0 * sw + x0) * 4 + ch; od[o + ch] = (sd[i] * (1 - ax) + sd[i + 4] * ax) * (1 - ay) + (sd[i + sw * 4] * (1 - ax) + sd[i + sw * 4 + 4] * ax) * ay; }
    }
    g.putImageData(out, 0, 0); src.width = src.height = 0;
  }
  c.k = W / st.w; warpCache.set(k, c); if (warpCache.size > 8) warpCache.delete(warpCache.keys().next().value);
  return c;
}

/* ---------------- design ---------------- */
function pieces(r = reg()) { return r?.art?.pieces || []; }
// what the flat view, the body and the overlap check show: the design, or a returned picture
// being reviewed before it is used
function shownPieces(r = reg()) { return ui.review && ui.review.piece ? [ui.review.piece] : pieces(r).filter((p) => !p.hidden); }
function selPiece(r = reg()) { return pieces(r).find((p) => p.id === ui.sel) || null; }
function designPanel(r) {
  const ps = pieces(r), p = selPiece(r), u = units(), out = [];
  out.push(h('p', { text: 'Arrange separate plants on the measured shape. Draw them in Procreate, then bring them in here as pictures; each stays its own piece to move, size, turn and mirror.' }));
  out.push(fileButton('wsAddPlants', 'Add plant pictures', true, false, addPieces));
  const col = collisions.result;
  if (col && col.total > 0) out.push(h('div', { class: 'warnbox', id: 'wsClash', text: clashText(col) }));
  else if (ps.length && reg().existing?.ink) out.push(h('div', { class: 'okbox', id: 'wsClash', text: 'No new art touches the old ink, its clear margin or the protected gaps.' }));
  if (p) {
    const ar = p.w / p.aspect;
    out.push(h('div', { class: 'box', id: 'wsPiece' },
      h('label', { class: 'f' }, 'Name', h('input', { type: 'text', value: p.name || '', maxlength: '60', onchange: (e) => change(() => { selPiece().name = e.target.value.trim().slice(0, 60); }) })),
      h('div', { class: 'row' }, lenInput('wsPieceW', p.w, (v) => change(() => { selPiece().w = Math.max(1, Math.min(600, v)); }), 'Width'),
        h('p', {}, 'At true size ', h('b', { text: `${fmt(p.w)} × ${fmt(ar)}` }))),
      h('label', { class: 'f' }, 'Turn', slider(-180, 180, 1, p.rot || 0, (v, done) => { if (done) change(() => { selPiece().rot = v; }); else { selPiece().rot = v; draw(); syncOverlay(); } })),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', 'aria-pressed': String(!!p.flip), text: 'Mirror', onclick: () => change(() => { selPiece().flip = !selPiece().flip; }) }),
        h('button', { class: 'btn', type: 'button', text: 'Duplicate', onclick: () => change(() => { const q = { ...selPiece(), id: uid(), x: selPiece().x + 8, y: selPiece().y - 8 }; reg().art.pieces.push(q); ui.sel = q.id; }) }),
        h('button', { class: 'btn', type: 'button', text: 'Forward', onclick: () => change(() => order(1)) }),
        h('button', { class: 'btn', type: 'button', text: 'Back', onclick: () => change(() => order(-1)) })),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', text: 'Put at the front focal point', onclick: () => change(() => { const q = focalCentre(reg()); if (q) { selPiece().x = q[0]; selPiece().y = q[1]; } }) }),
        h('button', { class: 'btn', type: 'button', 'aria-pressed': String(!!p.hidden), text: p.hidden ? 'Show' : 'Hide', onclick: () => change(() => { const s = selPiece(); if (s.hidden) delete s.hidden; else s.hidden = true; }) }),
        h('button', { class: 'btn', type: 'button', text: 'Remove', onclick: () => change(() => { reg().art.pieces = pieces().filter((q) => q.id !== ui.sel); if (!reg().art.pieces.length && !reg().art.saved) delete reg().art; ui.sel = null; }) }))));
  }
  if (ps.length) out.push(h('h3', { class: 'shHead', text: 'Plants, top first' }), h('div', { class: 'plist', id: 'wsPieces' }, ...ps.slice().reverse().map((q) => h('div', { class: 'prow', 'aria-current': String(q.id === ui.sel) }, thumb(q.img),
    h('button', { class: 'btn name', type: 'button', text: (q.name || 'Plant') + (q.hidden ? ' (hidden)' : ''), onclick: () => { ui.sel = q.id; refresh(); } })))));
  out.push(h('h3', { class: 'shHead', text: 'Composition' }),
    h('p', { text: 'Grow the garden out from the cactus: small plants round its base, taller ones round the sides and front, joined by low planting and stones so it never reads as a solid band. The front focal point is a wider, sculptural piece, like a looping or arched cactus with flowers.' }),
    h('div', { class: 'row' }, h('span', { text: 'Front focal point', style: 'font-size:13px;color:var(--muted)' }),
      seg([[90, 'Front'], [45, 'Front inside'], [135, 'Front outside']], r.focal?.deg ?? 90, (v) => change(() => { const x = reg(); x.focal = { ...(x.focal || { at: 0.5, w: 90, h: 70 }), deg: v }; }))),
    h('label', { class: 'f' }, `Focal area width ${fmt(r.focal?.w ?? 90)}`, slider(30, 160, 1, r.focal?.w ?? 90, (v, done) => { const x = reg(); if (done) change(() => { reg().focal = { ...(reg().focal || { deg: 90, at: 0.5, h: 70 }), w: v }; }); else { x.focal = { ...(x.focal || { deg: 90, at: 0.5, h: 70 }), w: v }; draw(); } })));
  out.push(h('h3', { class: 'shHead', text: 'Design versions' }),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'wsSaveVer', disabled: !ps.length, text: 'Save this version', onclick: () => change(() => { const a = reg().art; const n = (a.saved || []).length + 1; a.saved = [...(a.saved || []), { id: uid(), name: `Version ${n}`, at: nowIso(), pieces: JSON.parse(JSON.stringify(a.pieces || [])) }].slice(-12); C.toast(`Saved as Version ${n}.`); }) }),
      h('button', { class: 'btn', type: 'button', id: 'wsBefore', text: 'Hold to see before', onpointerdown: (e) => { e.preventDefault(); ui.holdBefore = true; draw(); syncOverlay(); }, onpointerup: () => { ui.holdBefore = false; draw(); syncOverlay(); }, onpointerleave: () => { if (ui.holdBefore) { ui.holdBefore = false; draw(); syncOverlay(); } } })),
    ...(r.art?.saved || []).slice().reverse().map((v) => h('div', { class: 'row' }, h('span', { text: `${v.name} · ${v.pieces.length} plants`, style: 'flex:1;font-size:14px' }),
      h('button', { class: 'btn', type: 'button', text: 'Use this one', onclick: () => change(() => { reg().art.pieces = JSON.parse(JSON.stringify(v.pieces)); ui.sel = null; }) }),
      h('button', { class: 'btn', type: 'button', text: 'Delete', onclick: () => change(() => { const a = reg().art; a.saved = a.saved.filter((x) => x.id !== v.id); if (!a.saved.length) delete a.saved; }) }))));
  return out;
}
function order(d) { const a = reg().art.pieces, i = a.findIndex((p) => p.id === ui.sel), j = i + d; if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; }
function focalCentre(r) { const t = tpl(r), fo = r.focal || { deg: 90, at: 0.5 }; return t ? G.point(t, K.fAt(fo.deg, r.seam, r.limb), fo.at * t.slant) : null; }
function clashText(c) {
  const parts = []; const a = (n) => units() === 'mm' ? `${Math.round(n)} mm²` : `${(n / 645.16).toFixed(2)} sq in`;
  if (c.ink) parts.push(`the old ink (${a(c.ink)})`); if (c.buffer) parts.push(`its clear margin (${a(c.buffer)})`); if (c.gap) parts.push(`the protected gaps (${a(c.gap)})`);
  return `New art overlaps ${parts.join(', ')}, shown in red. Nothing of the old tattoo is changed.`;
}
async function addPieces(files) {
  const r = reg(), t = tpl(r); if (!t) return;
  const added = [], start = pieces(r).length;
  for (const f of files) {
    const pic = await C.readPicture(f, 4096); if (!pic) { C.toast('That picture could not be opened.'); continue; }
    const n = start + added.length, focal = focalCentre(r);
    // the first plant goes to the front focal point, the rest round the wrap low down
    let at = focal; if (n > 0) { const f2 = ((n * 0.21) % 1) - 0.5; at = G.point(t, f2 * 0.9, t.slant * 0.3); }
    added.push({ id: uid(), img: C.putImage(pic.dataUrl), pw: pic.w, ph: pic.h, x: at[0], y: at[1], w: n === 0 ? 70 : 35, aspect: pic.w / pic.h, rot: 0, flip: false, name: (f.name || 'Plant').replace(/\.[a-z0-9]+$/i, '').slice(0, 60) });
  }
  if (!added.length) return;
  change(() => { const x = reg(); x.art = x.art || {}; x.art.pieces = [...(x.art.pieces || []), ...added].slice(0, 60); ui.sel = added[added.length - 1].id; });
}

/* ---------------- Procreate: send the flat shape out, bring the drawing back ---------------- */
const REF_NAMES = new Set(P.LAYERS.filter((L) => L.key !== 'garden').map((L) => L.name));
const isRef = (name) => REF_NAMES.has((name || '').trim()) || /^Optional background/.test((name || '').trim());
const sizeText = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
function procreatePanel(r) {
  const t = tpl(r), out = []; if (!t) return out;
  const hi = P.highPpi(t); if (ui.ppi !== 300 && ui.ppi !== hi) ui.ppi = 300;
  const c = P.packageCanvas(t, ui.ppi), e = r.existing || {};
  out.push(h('p', { text: 'The flat shape at its real size, as one Procreate document. Draw on Proposed garden; the cactus, its ink, the protected gaps, the landmarks, the seam and alignment marks and a measurement grid come as locked layers to draw round.' }));
  out.push(h('div', { class: 'row' }, h('span', { text: 'Resolution', style: 'font-size:13px;color:var(--muted)' }),
    seg(hi > 300 ? [[300, '300 PPI'], [hi, `${hi} PPI`]] : [[300, '300 PPI']], ui.ppi, (v) => { ui.ppi = v; ui.pkg = null; renderSide(reg()); })));
  out.push(h('div', { class: 'row' }, h('span', { text: 'File', style: 'font-size:13px;color:var(--muted)' }),
    seg([['psd', 'Layered PSD'], ['png', 'PNG layers']], ui.pkgFormat, (v) => { ui.pkgFormat = v; ui.pkg = null; renderSide(reg()); })));
  out.push(h('p', { id: 'wsPkgSize', text: `${c.w} × ${c.h} pixels at ${ui.ppi} PPI, ${fmt(c.wMm)} × ${fmt(c.hMm)} with room round the shape for the alignment marks. Transparent, so only what you draw comes back.` + (ui.ppi !== 300 ? ` ${ui.ppi} PPI is the most this size can come back at on an iPad.` : '') }));
  if (!e.locked) out.push(h('div', { class: 'warnbox', text: e.ink ? 'The existing tattoo is not locked yet. It still goes out as it is now.' : 'The existing tattoo is not traced yet, so its reference layers go out empty. Trace it first under Existing tattoo.' }));
  if (ui.pkg && ui.pkg.calib === r.calib && ui.pkg.ppi === ui.ppi && ui.pkg.format === ui.pkgFormat) {
    out.push(h('div', { class: 'okbox', id: 'wsPkgReady', text: `Ready: ${ui.pkg.name}, ${sizeText(ui.pkg.blob.size)}.` }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', id: 'wsSendPkg', text: 'Send to Procreate', onclick: sendPackage })));
  } else {
    out.push(h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', id: 'wsMakePkg', disabled: !!ui.busy, text: ui.busy === 'make' ? 'Making it…' : 'Make the Procreate file', onclick: () => makePackage().catch((err) => { ui.busy = ''; C.toast('That file could not be made: ' + (err && err.message || err)); renderSide(reg()); }) })));
  }
  out.push(h('p', { text: 'In Procreate draw only on Proposed garden and keep the canvas size. Then Share > PSD and bring that file back here. A Procreate file, or a PNG of just the Proposed garden layer, works too.' }));
  out.push(h('h3', { class: 'shHead', text: 'Bring it back' }));
  const inp = h('input', { type: 'file', accept: '.psd,.procreate,image/png,image/vnd.adobe.photoshop,application/octet-stream', hidden: true, id: 'wsBringBackFile' });
  inp.addEventListener('change', () => { const f = inp.files[0]; inp.value = ''; if (f) bringBack(f).catch((err) => { ui.busy = ''; C.toast('That file could not be read: ' + (err && err.message || err)); renderSide(reg()); }); });
  out.push(h('div', { class: 'row' }, inp, h('button', { class: 'btn' + (ui.pkg || (r.sessions || []).length ? ' primary' : ''), type: 'button', id: 'wsBringBack', disabled: !!ui.busy, text: ui.busy === 'read' ? 'Reading it…' : 'Bring back from Procreate', onclick: () => inp.click() })));
  const rv = ui.review;
  if (rv) {
    const col = collisions.result, lines = [rv.check.why];
    if (rv.stale) lines.push('It was drawn on earlier measurements, so it is placed at the size it was drawn for. Check it against the new shape.');
    if (rv.check.ok) lines.push(col && col.total > 0 ? clashText(col) : (r.existing?.ink ? 'It does not touch the old ink, its clear margin or the protected gaps.' : ''));
    out.push(h('div', { class: rv.check.ok ? 'box' : 'warnbox', id: 'wsReview' }, ...lines.filter(Boolean).map((x) => h('p', { text: x })),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', id: 'wsCancelReturn', text: rv.check.ok ? 'Cancel' : 'OK', onclick: () => { ui.review = null; collisions.key = ''; refresh(); } }),
        rv.check.ok ? h('button', { class: 'btn primary', type: 'button', id: 'wsUseReturn', text: rv.check.how === 'scaled' ? 'Use it at this size' : 'Use it', onclick: useReturn }) : null)));
  }
  const ss = (r.sessions || []).slice().reverse();
  if (ss.length) out.push(h('h3', { class: 'shHead', text: 'Sent to Procreate' }), ...ss.slice(0, 5).map((q) => h('div', { class: 'row', style: 'font-size:14px' },
    h('span', { style: 'flex:1', text: `${q.name || 'Wrap'} · ${(q.at || '').slice(0, 10)} · ${q.ppi} PPI` + (q.returned ? ` · brought back${q.returned.how === 'exact' ? '' : ' (' + q.returned.how + ')'}` : '') + (q.calib !== r.calib ? ' · earlier measurements' : '') }))));
  return out;
}

/* ---------------- print ---------------- */
const PAPER_LABEL = { letter: 'Letter', a4: 'A4', legal: 'Legal', '8.5x16': '8.5×16', custom: 'Custom' };
const PRINTER_LABEL = { inkjet: 'Inkjet', laser: 'Laser', thermal: 'Thermal', custom: 'Custom' };
function printOf(r) { return { paper: 'letter', orient: 'auto', printer: 'inkjet', overlap: PP.OVERLAP_MM, mirror: false, ...(r.print || {}) }; }
function artBox(r) { const t = tpl(r); return t && { w: t.bounds.w, h: t.bounds.h }; }
// what the approval covers: the measurements and the placed art
function artSig(r) {
  const a = (r.art?.pieces || []).filter((p) => !p.hidden).map((p) => [p.img, p.x, p.y, p.w, p.aspect, p.rot, p.flip].map((v) => (typeof v === 'number' ? +v.toFixed(2) : v)).join(','));
  let hsh = 0; const str = R.measureKey(r) + '|' + a.join(';'); for (let i = 0; i < str.length; i++) hsh = (hsh * 31 + str.charCodeAt(i)) | 0;
  return (hsh >>> 0).toString(36);
}
function approval(r) {
  const a = r.approved; if (!a) return { state: 'none' };
  if (a.calib !== r.calib) return { state: 'stale', why: 'The measurements changed after it was approved.' };
  if (a.sig && a.sig !== artSig(r)) return { state: 'stale', why: 'The design changed after it was approved.' };
  return { state: 'ok', at: a.at };
}
const dayText = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return (iso || '').slice(0, 10); } };
function setPrint(fn) { change(() => { const x = reg(); const pr = printOf(x); fn(pr); x.print = pr; }); ui.printOut = null; }
function printLayout(r) { const box = artBox(r); return box && PP.layoutTiles(box, printOf(r)); }
function printPanel(r) {
  const out = [], box = artBox(r); if (!box) return out;
  const pr = printOf(r), L = PP.layoutTiles(box, pr), ap = approval(r), stencil = ui.printKind === 'stencil';
  out.push(h('p', { text: `Prints at its measured size, ${fmt(box.w)} × ${fmt(box.h)}, on any paper. The paper only changes how many pages, never the size.` }));
  out.push(seg([['stencil', 'Stencil'], ['guide', 'Placement guide']], ui.printKind, (v) => { ui.printKind = v; ui.printOut = null; renderSide(reg()); }));
  out.push(h('p', { text: stencil ? 'Just the new garden as clean lines, for stencil paper. The old cactus and the guides are left off so they never transfer.' : 'For plain paper: the old ink, the gaps to keep open, the landmarks, the cut edges and a 1 cm grid, with the new garden faint. Wrap it round your ankle to check the fit before the stencil.' }));
  out.push(h('h3', { class: 'shHead', text: 'Paper' }));
  out.push(h('div', { class: 'seg', style: 'grid-template-columns:repeat(5,1fr)', id: 'wsPaper' }, ...PP.PAPER_ORDER.map((k) => h('button', { class: 'btn', type: 'button', 'data-v': k, 'aria-pressed': String(pr.paper === k), text: PAPER_LABEL[k], onclick: () => setPrint((x) => { x.paper = k; if (k === 'custom' && !x.custom) x.custom = { w: 215.9, h: 279.4 }; }) }))));
  if (pr.paper === 'custom') { const c = pr.custom || { w: 215.9, h: 279.4 }; out.push(h('div', { class: 'row' }, lenInput('wsPaperW', c.w, (v) => setPrint((x) => { x.custom = { ...(x.custom || c), w: Math.min(2000, Math.max(50, v)) }; }), 'Width'), lenInput('wsPaperH', c.h, (v) => setPrint((x) => { x.custom = { ...(x.custom || c), h: Math.min(2000, Math.max(50, v)) }; }), 'Height'))); }
  out.push(seg([['auto', 'Auto'], ['landscape', 'Landscape'], ['portrait', 'Portrait']], pr.orient, (v) => setPrint((x) => { x.orient = v; })));
  out.push(h('h3', { class: 'shHead', text: 'Printer' }));
  out.push(seg(PP.PRINTER_ORDER.map((k) => [k, PRINTER_LABEL[k]]), pr.printer, (v) => setPrint((x) => { x.printer = v; if (v === 'custom' && !x.margins) x.margins = { ...PP.PRINTERS.custom.margins }; })));
  const prn = PP.printerOf(pr);
  if (pr.printer === 'custom') out.push(h('div', { class: 'row' }, lenInput('wsMargin', prn.margins.top, (v) => setPrint((x) => { const m = Math.min(60, Math.max(0, v)); x.margins = { top: m, right: m, bottom: m, left: m }; }), 'Margin all round')));
  out.push(h('p', { text: `${prn.name}: ${fmt(prn.margins.left, 1)} margins${prn.feed ? `, ${fmt(prn.feed, 1)} more at each end it feeds` : ''}, drawn at ${PP.rasterDpi(box, prn.dpi)} dots per inch, on ${prn.media.toLowerCase()}.` }));
  if (stencil) {
    out.push(seg([[false, 'As drawn'], [true, 'Mirror once']], !!pr.mirror, (v) => setPrint((x) => { x.mirror = v; })));
    out.push(h('p', { text: pr.mirror ? 'Mirrored here. Leave the printer’s own mirror setting off, or it flips back.' : 'Most stencil paper flips the picture onto the skin by itself. Mirror here only if yours needs it, and never in the printer too.' }));
  }
  out.push(h('div', { class: 'row' }, h('span', { text: 'Overlap', style: 'font-size:13px;color:var(--muted)' }), h('div', { style: 'flex:1' }, seg([[10, '10 mm'], [15, '15 mm'], [20, '20 mm']], pr.overlap, (v) => setPrint((x) => { x.overlap = v; })))));
  out.push(h('div', { class: L.ok ? 'box' : 'warnbox', id: 'wsLayout' }, h('p', { text: PP.layoutNote(L) }),
    L.ok && L.tiles.length > 1 ? h('p', { text: 'The joins show on the flat view. Slide one to move it off a flower; the pages still overlap by the same amount.' }) : null));
  if (L.ok) L.cuts.x.forEach((c, i) => {
    const others = L.cuts.x.filter((_, j) => j !== i), ext = (v) => PP.clampCuts([...others, v].sort((a, b) => a - b), box.w, L.area.w, L.overlap)[[...others, v].sort((a, b) => a - b).indexOf(v)];
    const lo = Math.ceil(ext(-1e9)), hi = Math.floor(ext(1e9));
    const label = h('span', { style: 'font-size:13px;color:var(--muted);min-width:96px', text: `Join ${'ABCDEFGH'[i]} at ${fmtT(c)}` });
    const sl = slider(lo, Math.max(lo + 1, hi), 1, Math.round(c), (v, done) => {
      ui.cutDrag = { i, at: v }; label.textContent = `Join ${'ABCDEFGH'[i]} at ${fmtT(v)}`; draw();
      if (done) { ui.cutDrag = null; setPrint((x) => { const xs = L.cuts.x.slice(); xs[i] = v; x.cuts = [...xs.map((at) => ({ axis: 'x', at })), ...L.cuts.y.map((at) => ({ axis: 'y', at }))]; }); }
    });
    sl.id = 'wsCut' + i; sl.style.flex = '1';
    out.push(h('div', { class: 'row' }, label, sl));
  });
  if (L.ok && L.cuts.x.length && (pr.cuts || []).length) out.push(h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'wsCutsReset', text: 'Even joins', onclick: () => setPrint((x) => { x.cuts = []; }) })));
  // approval: of this design at these measurements; anything that changes it shows here and on the print
  out.push(h('h3', { class: 'shHead', text: 'Approval' }));
  if (ap.state === 'ok') out.push(h('div', { class: 'okbox', id: 'wsApproved', text: `Approved for the stencil on ${dayText(ap.at)}, at these measurements and this design.` }), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'wsUnapprove', text: 'Take approval off', onclick: () => { change(() => { delete reg().approved; }); ui.printOut = null; } })));
  else out.push(h('div', { class: 'warnbox', id: 'wsApproved', text: ap.state === 'stale' ? `${ap.why} Approve it again before you make the stencil.` : 'Not approved yet. You can still print a draft; it says Draft on every page.' }),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'wsApprove', disabled: !pieces(r).some((p) => !p.hidden), text: ap.state === 'stale' ? 'Approve again' : 'Approve this design', onclick: () => { change(() => { const x = reg(); x.approved = { calib: x.calib, at: nowIso(), sig: artSig(x) }; }); ui.printOut = null; C.markTried && C.markTried('wrapPrint'); } })));
  // making and sharing are separate, so the share sheet opens straight from the tap
  const want = printKey(r);
  if (ui.printOut && ui.printOut.key === want) out.push(h('div', { class: 'okbox', id: 'wsPrintReady', text: `Ready: ${ui.printOut.name}, ${ui.printOut.pages} page${ui.printOut.pages > 1 ? 's' : ''}, ${sizeText(ui.printOut.blob.size)}. In the print options choose 100% or Actual size.` }),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', id: 'wsSendPrint', text: 'Print or share', onclick: sendPrint })));
  else out.push(h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', id: 'wsMakePrint', disabled: !L.ok || !!ui.busy, text: ui.busy === 'print' ? 'Making it…' : stencil ? 'Make the stencil PDF' : 'Make the placement guide PDF', onclick: () => makePrint().catch((err) => { ui.busy = ''; C.toast('That PDF could not be made: ' + (err && err.message || err)); renderSide(reg()); }) })));
  // the fitting check on the real leg
  out.push(h('h3', { class: 'shHead', text: 'Fitting check' }));
  const f = r.fitted;
  out.push(h('p', { id: 'wsFitText', text: f ? (f.ok ? `Fitted on ${dayText(f.at)}: the printed guide wrapped round and met itself.` : `Did not fit on ${dayText(f.at)}${f.note ? ': ' + f.note : ''}. Measure again under Measurements.`) : 'Print the placement guide, cut round its outline and wrap it round your ankle. The cut edges should meet with the cactus at the back.' }));
  const note = h('input', { type: 'text', id: 'wsFitNote', placeholder: 'What was off (optional)', 'aria-label': 'What was off', value: f && !f.ok && f.note ? f.note : '' });
  out.push(h('div', { class: 'row' },
    h('button', { class: 'btn', type: 'button', id: 'wsFitYes', text: 'It fits', 'aria-pressed': String(!!(f && f.ok)), onclick: () => change(() => { reg().fitted = { at: nowIso(), ok: true }; }) }),
    h('button', { class: 'btn', type: 'button', id: 'wsFitNo', text: 'It doesn’t fit', 'aria-pressed': String(!!(f && !f.ok)), onclick: () => change(() => { const n = note.value.trim().slice(0, 300); reg().fitted = { at: nowIso(), ok: false, ...(n ? { note: n } : {}) }; }) })), note);
  return out;
}
function printKey(r) { return JSON.stringify([ui.printKind, printOf(r), r.calib, artSig(r), approval(r).state, r.existing?.ink, r.existing?.gap, r.existing?.buffer]); }
// The art for the PDF: the whole box at real size, black lines for the stencil or the guide in colour
async function printPicture(r, kind, dpi) {
  const t = tpl(r), c = G.canvasFor(t, { ppi: dpi, padMm: 0 }), ppmm = c.w / c.wMm, sy = c.h / c.hMm, M = [ppmm, 0, 0, -sy, c.originMm[0] * ppmm, c.originMm[1] * sy];
  const cnv = document.createElement('canvas'); cnv.width = c.w; cnv.height = c.h;
  const g = cnv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.w, c.h);
  const s = { marks: [] };
  if (kind === 'stencil') {
    await drawLayer('garden', g, M, r, s, ppmm);
    const { stencilLines } = await import('./stencil.js');
    g.setTransform(1, 0, 0, 1, 0, 0);
    const res = stencilLines(g.getImageData(0, 0, c.w, c.h).data, c.w, c.h, { detail: 0.5, line: Math.max(2, Math.round(0.4 * ppmm)), solid: Math.max(6, Math.round(4 * ppmm)) });
    const data = new Uint8Array(c.w * c.h); for (let i = 0; i < data.length; i++) data[i] = res.lines[i] ? 0 : 255;
    return { w: c.w, h: c.h, channels: 1, data, lines: res.linePixels };
  }
  const layer = async (key, alpha = 1) => { const tmp = document.createElement('canvas'); tmp.width = c.w; tmp.height = c.h; const tg = tmp.getContext('2d'); await drawLayer(key, tg, M, r, s, ppmm); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alpha; g.drawImage(tmp, 0, 0); g.globalAlpha = 1; };
  await layer('grid', 0.45); await layer('gap', 0.5); await layer('ink', 0.75); await layer('garden', 0.35); await layer('landmarks'); await layer('marks');
  g.setTransform(1, 0, 0, 1, 0, 0);
  const px = g.getImageData(0, 0, c.w, c.h).data, data = new Uint8Array(c.w * c.h * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { data[j] = px[i]; data[j + 1] = px[i + 1]; data[j + 2] = px[i + 2]; }
  return { w: c.w, h: c.h, channels: 3, data };
}
async function makePrint() {
  const r = reg(), t = tpl(r); if (!t || ui.busy) return null;
  const kind = ui.printKind, pr = printOf(r), box = artBox(r), L = PP.layoutTiles(box, pr); if (!L.ok) throw new Error(L.why);
  ui.busy = 'print'; renderSide(r); await new Promise((res) => setTimeout(res, 30));
  const dpi = PP.rasterDpi(box, PP.printerOf(pr).dpi, kind === 'stencil' ? 6e6 : 8e6);
  const picture = await printPicture(r, kind, dpi);
  const b = t.bounds, outline = kind === 'guide' ? G.outline(t, 160).map(([x, y]) => [x - b.minX, b.maxY - y]) : null;
  const ap = approval(r);
  const status = ap.state === 'ok' ? `Approved for the stencil on ${dayText(ap.at)}.` : ap.state === 'stale' ? `Draft: ${ap.why.toLowerCase().replace(/\.$/, '')}, not approved again yet.` : 'Draft: not approved yet.';
  const { measuredPdf } = await import('./measured-print.js'), { deflateBrowser } = await import('./pdf-writer.js');
  const bytes = await measuredPdf({ kind, L, art: box, picture, mirror: kind === 'stencil' && !!pr.mirror, outline, title: r.name || 'Measured wrap', paperName: pr.paper === 'custom' ? `Custom ${fmtT(PP.paperOf(pr, 'portrait').w)} x ${fmtT(PP.paperOf(pr, 'portrait').h)}` : PP.PAPERS[pr.paper].name, status, deflate: deflateBrowser });
  const name = `${r.name || 'Measured wrap'} ${kind === 'stencil' ? 'stencil' : 'placement guide'} ${(PP.PAPERS[pr.paper] || PP.PAPERS.letter).name}.pdf`.replace(/[\\/:*?"<>|]/g, '');
  ui.printOut = { blob: new Blob([bytes], { type: 'application/pdf' }), name, pages: L.tiles.length, key: printKey(r), dpi, kind, lines: picture.lines };
  C.markTried && C.markTried('wrapPrint');
  ui.busy = ''; renderSide(reg());
  return { name, size: bytes.length, pages: L.tiles.length, dpi };
}
async function sendPrint() {
  if (!ui.printOut) return;
  const { shareOrDownload } = await import('./share.js');
  const how = await shareOrDownload(ui.printOut.name, ui.printOut.blob);
  if (how === 'downloaded') C.toast(`Saved ${ui.printOut.name}. Print it at 100% / Actual size.`);
}
// the joins between pages on the flat view, while the Print step is open
function drawJoins(g, M, r) {
  const t = tpl(r), box = artBox(r), L = printLayout(r); if (!L || !L.ok) return;
  const cuts = L.cuts.x.slice(); if (ui.cutDrag) cuts[ui.cutDrag.i] = ui.cutDrag.at;
  const b = t.bounds, s = Math.abs(M[0]);
  setAffine(g, M); g.save(); g.strokeStyle = '#e8a33d'; g.lineWidth = 2 / s;
  cuts.forEach((c, i) => {
    const x = b.minX + c;
    g.setLineDash([6 / s, 4 / s]); g.beginPath(); g.moveTo(x, b.minY - 4); g.lineTo(x, b.maxY + 4); g.stroke(); g.setLineDash([]);
    g.globalAlpha = 0.15; g.fillStyle = '#e8a33d'; g.fillRect(x - L.overlap / 2, b.minY, L.overlap, b.h); g.globalAlpha = 1;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); const q = [M[0] * x + M[4], M[3] * (b.maxY + 4) + M[5]]; g.font = `600 ${13 * (view.dpr || 1)}px -apple-system, system-ui, sans-serif`; g.fillStyle = '#e8a33d'; g.textAlign = 'center'; g.fillText('Join ' + 'ABCDEFGH'[i], q[0], q[1] - 4 * (view.dpr || 1)); g.restore();
  });
  g.restore();
}

// the canvas pictures of one layer, drawn a strip of rows at a time
async function drawLayer(key, g, M, r, s, ppmm) {
  const t = tpl(r), e = r.existing || {}, ol = G.outline(t, 160);
  const px = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  const text = (str, x, y, mm, align = 'center', colr = '#000') => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.font = `600 ${Math.max(8, mm * ppmm)}px -apple-system, system-ui, sans-serif`; g.textAlign = align; g.fillStyle = colr; const q = px(x, y); g.fillText(str, q[0], q[1]); g.restore(); };
  const path = (pts) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(...q) : g.moveTo(...q))); };
  if (key === 'background') { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore(); return; }
  if (key === 'grid') {
    setAffine(g, M); path(ol); g.closePath(); g.save(); g.clip(); g.strokeStyle = '#6b6b6b';
    for (let u = 10, k = 1; u < t.slant; u += 10, k++) { g.lineWidth = (k % 5 ? 0.12 : 0.3); path(Array.from({ length: 97 }, (_, i) => G.point(t, -0.5 + i / 96, u))); g.stroke(); }
    const mid = G.circAt(t, t.slant / 2), n = Math.floor(mid / 10);
    for (let k = -Math.floor(n / 2); k <= Math.floor(n / 2); k++) { const f = k * 10 / mid; if (Math.abs(f) >= 0.5) continue; g.lineWidth = k % 5 ? 0.12 : 0.3; path([G.point(t, f, 0), G.point(t, f, t.slant)]); g.stroke(); }
    g.restore(); return;
  }
  if (key === 'marks') {
    setAffine(g, M); g.strokeStyle = '#000'; g.lineWidth = 0.35; path(ol); g.closePath(); g.stroke();
    for (const sg of t.segs.slice(1)) { path(Array.from({ length: 97 }, (_, i) => G.point(t, -0.5 + i / 96, sg.u0))); g.stroke(); }
    // where each side of the limb falls, as ticks under the bottom ring
    for (const [deg, name] of [[0, 'Inside'], [90, 'Front'], [180, 'Outside'], [270, 'Back']]) {
      const f = K.fAt(deg, r.seam, r.limb); if (Math.abs(f) > 0.49) continue;
      setAffine(g, M); path([G.point(t, f, -1), G.point(t, f, 3)]); g.lineWidth = 0.35; g.stroke(); const q = G.point(t, f, -4); text(name, q[0], q[1], 2.6);
    }
    for (const side of [-0.5, 0.5]) { const q = G.point(t, side, t.slant / 2); text('Cut', q[0] + side * 9, q[1], 2.6); }
    if (r.focal) { const fo = r.focal, cc = G.point(t, K.fAt(fo.deg, r.seam, r.limb), fo.at * t.slant); setAffine(g, M); g.setLineDash([2, 1.5]); g.lineWidth = 0.3; roundRect(g, cc[0] - fo.w / 2, cc[1] - fo.h / 2, fo.w, fo.h, 6); g.stroke(); g.setLineDash([]); text('Front focal point', cc[0], cc[1] + fo.h / 2 + 1.5, 2.6); }
    // the four registration targets, outside the shape: a ring and a cross, MARK_MM across
    setAffine(g, M); g.lineWidth = 0.5;
    for (const [x, y] of s.marks) { const a = P.MARK_MM / 2 - 0.25; g.beginPath(); g.arc(x, y, P.MARK_MM * 0.33, 0, Math.PI * 2); g.moveTo(x - a, y); g.lineTo(x + a, y); g.moveTo(x, y - a); g.lineTo(x, y + a); g.stroke(); }
    return;
  }
  if (key === 'landmarks') {
    for (const l of e.landmarks || []) if (l.at) { setAffine(g, M); g.fillStyle = '#d0202a'; g.beginPath(); g.arc(l.at[0], l.at[1], 1.1, 0, Math.PI * 2); g.fill(); text(l.name, l.at[0] + 2, l.at[1] + 1, 2.4, 'start', '#d0202a'); }
    return;
  }
  if (key === 'ink' || key === 'gap') {
    const m = (e.ink || e.gap) ? await masks(false) : null; if (!m) return;
    g.save(); g.imageSmoothingEnabled = true; setAffine(g, M, maskToTpl(m));
    if (key === 'ink' && m.ink && e.ink) g.drawImage(tint(m.ink, '#000000'), 0, 0);
    if (key === 'gap') { if (m.gap && e.gap) g.drawImage(tint(m.gap, '#2f7fd6'), 0, 0); if (m.ink && e.ink) { const ring = bufferRing(m, e.buffer ?? 2); if (ring) g.drawImage(ring, 0, 0); } }
    g.restore(); return;
  }
  if (key === 'cactus') {
    for (const p of e.photos || []) { if (!p.fit || p.id !== (e.active || e.photos[0].id)) continue; const pic = await warped(p); if (!pic) continue; const st = straightOf(p); g.save(); setAffine(g, M, fitAffine(p.fit, st.w, st.h)); g.drawImage(pic, 0, 0, st.w, st.h); g.restore(); }
    return;
  }
  if (key === 'garden') {
    for (const p of pieces(r)) { if (p.hidden) continue; const im = await C.loadImg(p.img); if (!im) continue; g.save(); setAffine(g, M, pieceAffine(p, im)); g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight); g.restore(); }
  }
}

// Makes the document ahead of Share, so the share sheet opens straight from the tap
async function makePackage() {
  const r = reg(), t = tpl(r); if (!t || ui.busy) return null;
  ui.busy = 'make'; renderSide(r);
  await new Promise((res) => setTimeout(res, 30));
  const s = P.makeSession(r, t, { ppi: ui.ppi, at: nowIso(), sources: pieces(r).filter((p) => !p.hidden).map((p) => p.id) });
  const ppmm = s.w / s.wMm, sy = s.h / s.hMm, M = [ppmm, 0, 0, -sy, s.originMm[0] * ppmm, s.originMm[1] * sy];
  const layers = P.psdLayers(s); // bottom first
  let blob, name;
  if (ui.pkgFormat === 'png') {
    if (s.w * s.h > P.MAX_PIXELS) throw new Error('too big for PNG layers at this resolution; use 300 PPI or the layered PSD');
    const { zipStored } = await import('./obj-export.js');
    const cnv = document.createElement('canvas'); cnv.width = s.w; cnv.height = s.h; const g = cnv.getContext('2d'), files = [];
    for (const L of P.LAYERS) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s.w, s.h); await drawLayer(L.key, g, M, r, s, ppmm);
      const b = await new Promise((res) => cnv.toBlob(res, 'image/png')); files.push({ name: P.pngName(L), data: new Uint8Array(await b.arrayBuffer()) });
    }
    files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(P.manifest(s, r), null, 2)) });
    blob = new Blob([zipStored(files)], { type: 'application/zip' }); name = s.name + ' layers.zip';
  } else {
    const { writePsd, StripPacker } = await import('./psd.js');
    const rows = Math.max(1, Math.min(2048, Math.floor(P.MAX_PIXELS / 2 / s.w)));
    const strip = document.createElement('canvas'), comp = document.createElement('canvas'); strip.width = comp.width = s.w;
    const packs = layers.map(() => new StripPacker(4)), merged = new StripPacker(3);
    for (let y0 = 0; y0 < s.h; y0 += rows) {
      const n = Math.min(rows, s.h - y0); strip.height = comp.height = n;
      const g = strip.getContext('2d', { willReadFrequently: true }), cg = comp.getContext('2d'), Ms = [M[0], M[1], M[2], M[3], M[4], M[5] - y0];
      cg.setTransform(1, 0, 0, 1, 0, 0); cg.fillStyle = '#fff'; cg.fillRect(0, 0, s.w, n);
      for (let i = 0; i < layers.length; i++) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s.w, n); await drawLayer(layers[i].key, g, Ms, r, s, ppmm);
        g.setTransform(1, 0, 0, 1, 0, 0); packs[i].add(g.getImageData(0, 0, s.w, n).data, s.w, n);
        if (!layers[i].hidden) { cg.globalAlpha = layers[i].opacity / 255; cg.drawImage(strip, 0, 0); cg.globalAlpha = 1; }
      }
      merged.add(cg.getImageData(0, 0, s.w, n).data, s.w, n);
      await new Promise((res) => setTimeout(res, 0));
    }
    blob = writePsd({ width: s.w, height: s.h, ppi: s.ppi, merged: { packed: merged.packed }, layers: layers.map((L, i) => ({ name: L.name, packed: packs[i].packed, locked: L.locked, hidden: L.hidden, opacity: L.opacity })) });
    name = s.name + '.psd';
  }
  change(() => { const x = reg(); x.sessions = [...(x.sessions || []), s].slice(-10); });
  C.markTried && C.markTried('wrapProcreate');
  ui.pkg = { blob, name, calib: r.calib, ppi: ui.ppi, format: ui.pkgFormat, session: s.id };
  ui.busy = ''; renderSide(reg());
  return { name, size: blob.size, session: s };
}
async function sendPackage() {
  if (!ui.pkg) return;
  const { shareOrDownload } = await import('./share.js');
  const how = await shareOrDownload(ui.pkg.name, ui.pkg.blob);
  if (how === 'downloaded') C.toast(`Saved ${ui.pkg.name}. Open it in Procreate.`);
}

// Reads what came back, checks it against the trip it belongs to, and shows it for review.
async function bringBack(file) {
  const r = reg(); if (!r || ui.busy) return null;
  ui.busy = 'read'; renderSide(r);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let w = 0, hgt = 0, names = [], garden = null, marksA = null, flattened = false;
  const isPsd = bytes[0] === 0x38 && bytes[1] === 0x42 && bytes[2] === 0x50 && bytes[3] === 0x53, isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isPsd) {
    const { readPsd } = await import('./psd.js');
    const d = readPsd(bytes, { merged: false, want: (L) => L.name.trim() === P.MARKS || (!isRef(L.name) && !L.hidden) });
    w = d.width; hgt = d.height; names = d.layers.map((L) => L.name);
    const full = (L) => { const lw = L.right - L.left, lh = L.bottom - L.top, a = new Uint8ClampedArray(lw * lh * 4), px = L.pixels; for (let i = 0; i < lw * lh; i++) { a[i * 4] = px[0]?.[i] ?? 0; a[i * 4 + 1] = px[1]?.[i] ?? 0; a[i * 4 + 2] = px[2]?.[i] ?? 0; a[i * 4 + 3] = px[-1] ? px[-1][i] : 255; } return { a, lw, lh }; };
    const cnv = document.createElement('canvas'); cnv.width = w; cnv.height = hgt; const g = cnv.getContext('2d'), tmp = document.createElement('canvas');
    let any = false;
    for (const L of d.layers) {
      const lw = L.right - L.left, lh = L.bottom - L.top;
      if (L.name.trim() === P.MARKS && lw && lh) { const { a } = full(L); marksA = new Uint8Array(w * hgt); for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) { const X = L.left + x, Y = L.top + y; if (X >= 0 && Y >= 0 && X < w && Y < hgt) marksA[Y * w + X] = a[(y * lw + x) * 4 + 3]; } continue; }
      if (isRef(L.name) || L.hidden || !lw || !lh) continue;
      const { a } = full(L); tmp.width = lw; tmp.height = lh; tmp.getContext('2d').putImageData(new ImageData(a, lw, lh), 0, 0);
      g.globalAlpha = (L.opacity ?? 255) / 255; g.drawImage(tmp, L.left, L.top); g.globalAlpha = 1; any = true;
    }
    if (!any) throw new Error('there is nothing drawn on Proposed garden');
    garden = cnv;
  } else if (isZip) {
    const { readProcreate } = await import('./procreate-file.js');
    const d = await readProcreate(bytes); w = d.width; hgt = d.height; names = d.layers.map((L) => L.name);
    const cnv = document.createElement('canvas'); cnv.width = w; cnv.height = hgt; const g = cnv.getContext('2d'), tmp = document.createElement('canvas'); tmp.width = w; tmp.height = hgt;
    let any = false;
    for (const L of d.layers.slice().reverse()) { // bottom first
      if ((L.name || '').trim() === P.MARKS) { const a = await L.readNative(); marksA = new Uint8Array(w * hgt); for (let i = 0; i < w * hgt; i++) marksA[i] = a[i * 4 + 3]; continue; }
      if (isRef(L.name) || L.hidden || !L.tiles) continue;
      tmp.getContext('2d').putImageData(new ImageData(await L.readNative(), w, hgt), 0, 0); g.globalAlpha = L.opacity ?? 1; g.drawImage(tmp, 0, 0); g.globalAlpha = 1; any = true;
    }
    if (!any) throw new Error('there is nothing drawn on Proposed garden');
    garden = cnv;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('not a picture')); i.src = url; });
      w = im.naturalWidth; hgt = im.naturalHeight; if (w * hgt > P.MAX_PIXELS * 1.05) throw new Error('the picture is too big to read on this device');
      const cnv = document.createElement('canvas'); cnv.width = w; cnv.height = hgt; const g = cnv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const a = g.getImageData(0, 0, w, hgt).data; marksA = new Uint8Array(w * hgt); let opaque = 0; for (let i = 0; i < w * hgt; i++) { marksA[i] = a[i * 4 + 3]; if (a[i * 4 + 3] === 255) opaque++; }
      flattened = opaque > 0.97 * w * hgt; garden = cnv;
    } finally { URL.revokeObjectURL(url); }
  }
  const match = P.matchSession(r.sessions, { w, h: hgt, names }), s = match && match.session;
  let found = null;
  if (s && marksA && !(w === s.w && hgt === s.h)) found = P.findMarks(marksA, w, hgt, (s.w / s.wMm) * (w / s.w));
  let check = P.checkReturn(s, { w, h: hgt, found });
  if (!isPsd && !isZip && (flattened || (found && check.ok))) check = { ok: false, how: 'refuse', why: 'This picture has the reference layers flattened into it (the cactus, grid or marks). In Procreate, share just the Proposed garden layer as a PNG, or bring back the PSD.' };
  ui.review = { check, session: s, stale: !!(s && P.staleSession(s, r)), w, h: hgt };
  if (check.ok) {
    const piece = P.returnedPiece(s, check, w, hgt);
    ui.review.piece = { id: uid(), img: C.putImage(garden.toDataURL('image/png')), name: 'From Procreate', from: s.id, x: piece.x, y: piece.y, w: piece.w, aspect: piece.aspect, rot: 0, flip: false, pw: w, ph: hgt, ppi: Math.round(piece.ppi) };
  }
  ui.busy = ''; ui.view = 'all'; collisions.key = ''; refresh(); scheduleCollisions();
  return { ok: check.ok, how: check.how, why: check.why };
}
function useReturn() {
  const rv = ui.review; if (!rv || !rv.check.ok || !rv.piece) return;
  change(() => {
    const x = reg(), a = x.art || (x.art = {});
    if (a.pieces && a.pieces.length) a.saved = [...(a.saved || []), { id: uid(), name: `Before Procreate ${nowIso().slice(5, 10)}`, at: nowIso(), pieces: JSON.parse(JSON.stringify(a.pieces)) }].slice(-12);
    a.pieces = [rv.piece];
    const s = (x.sessions || []).find((q) => q.id === rv.session.id); if (s) s.returned = { at: nowIso(), how: rv.check.how };
  });
  ui.review = null; ui.sel = null; collisions.key = ''; C.toast('The garden from Procreate is on the wrap. The plants before it are kept as a design version.'); refresh();
}

/* ---------------- collisions ---------------- */
const collisions = { key: '', result: null, img: null, timer: 0 };
async function checkCollisions() {
  const r = reg(); if (!r) return;
  const e = r.existing || {}, ps = shownPieces(r);
  const k = JSON.stringify([e.ink, e.gap, e.buffer ?? 2, ps, e.maskO]);
  if (collisions.key === k) return; collisions.key = k;
  if (!ps.length || (!e.ink && !e.gap)) { collisions.result = null; collisions.img = null; return; }
  const m = await masks(false); if (!m || !m.ink) { collisions.result = null; return; }
  const w = m.w, hh = m.h, art = document.createElement('canvas'); art.width = w; art.height = hh;
  const g = art.getContext('2d');
  for (const p of ps) { const im = await C.loadImg(p.img); if (!im) continue; g.save(); setAffine(g, maskAffine(m), pieceAffine(p, im)); g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight); g.restore(); }
  const A = g.getImageData(0, 0, w, hh).data, I = m.ink.getContext('2d').getImageData(0, 0, w, hh).data, P = m.gap.getContext('2d').getImageData(0, 0, w, hh).data;
  const inkBin = new Uint8Array(w * hh); for (let i = 0; i < w * hh; i++) inkBin[i] = I[i * 4 + 3] > 100 ? 1 : 0;
  if (m.distFor !== m.key) { m.dist = K.distanceField(inkBin, w, hh); m.distFor = m.key; }
  const buf = (e.buffer ?? 2) * m.ppmm, out = g.createImageData(w, hh), od = out.data, cell = 1 / (m.ppmm * m.ppmm);
  let ink = 0, buffer = 0, gap = 0;
  for (let i = 0; i < w * hh; i++) {
    if (A[i * 4 + 3] < 60) continue;
    let hit = 0; if (inkBin[i]) { ink += cell; hit = 1; } else if (m.dist[i] <= buf) { buffer += cell; hit = 1; } else if (P[i * 4 + 3] > 100) { gap += cell; hit = 1; }
    if (hit) { od[i * 4] = 255; od[i * 4 + 1] = 40; od[i * 4 + 2] = 40; od[i * 4 + 3] = 230; }
  }
  g.clearRect(0, 0, w, hh); g.putImageData(out, 0, 0);
  collisions.result = { ink, buffer, gap, total: ink + buffer + gap }; collisions.img = art;
  if (ui.step === 'design' || ui.step === 'procreate') renderSide(r); draw(); syncOverlay();
}
function scheduleCollisions() { clearTimeout(collisions.timer); collisions.timer = setTimeout(() => { checkCollisions().catch(() => {}); }, 120); }

/* ---------------- drawing the flat view ---------------- */
// affine helpers: [a, b, c, d, e, f] with X = a x + c y + e, Y = b x + d y + f (canvas order)
const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
function fitAffine(fit, w, h) {
  const r = (fit.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), m = fit.mmPerPx, f = fit.flip ? -1 : 1;
  return [c * f * m, s * f * m, s * m, -c * m, fit.x - c * f * m * w / 2 - s * m * h / 2, fit.y - s * f * m * w / 2 + c * m * h / 2];
}
const pieceAffine = (p, im) => fitAffine({ x: p.x, y: p.y, mmPerPx: p.w / im.naturalWidth, rot: p.rot, flip: p.flip }, im.naturalWidth, im.naturalHeight);
const viewAffine = () => { const d = view.dpr || 1; return [view.s * d, 0, 0, -view.s * d, (view.W / 2 - view.cx * view.s) * d, (view.H / 2 + view.cy * view.s) * d]; };
const maskAffine = (m) => [m.ppmm, 0, 0, -m.ppmm, -m.o[0] * m.ppmm, m.o[1] * m.ppmm];
const maskToTpl = (m) => [1 / m.ppmm, 0, 0, -1 / m.ppmm, m.o[0], m.o[1]];
function setAffine(g, ...ms) { const M = ms.reduce((a, b) => mul(a, b)); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); }
const toScreen = (x, y) => [(x - view.cx) * view.s + view.W / 2, (view.cy - y) * view.s + view.H / 2];
const fromScreen = (sx, sy) => [(sx - view.W / 2) / view.s + view.cx, view.cy - (sy - view.H / 2) / view.s];

let drawQueued = false;
function draw() { if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; drawNow().catch((e) => console.warn(e)); }); }
function photoMode() { return ui.step === 'existing' && (ui.sub === 'straighten' || ui.sub === 'landmarks'); }
async function drawNow() {
  if (!cv || !ui.open) return;
  const box = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(box.width * dpr) || cv.height !== Math.round(box.height * dpr)) { cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr); view.fitFor = ''; }
  view.W = box.width; view.H = box.height; view.dpr = dpr;
  const g = ctx2, r = reg(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  if (!r) return;
  const t = tpl(r); if (!t) return;
  if (photoMode()) { await drawPhotoMode(g, r); return; }
  if (view.fitFor !== 'tpl') fitView([t.bounds.minX, t.bounds.minY, t.bounds.maxX, t.bounds.maxY], 'tpl');
  const css = getComputedStyle(root), col = (n, d) => (css.getPropertyValue(n).trim() || d);
  const line = col('--line-strong', '#888'), accent = col('--stencil', '#8474ff'), muted = col('--muted', '#999');
  await drawContent(g, viewAffine(), r, { grid: true, line, accent, muted, labels: true });
  // handles and landmarks on top, in screen space
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ui.step === 'existing') for (const l of r.existing?.landmarks || []) if (l.at) pin(g, ...toScreen(...l.at), l.name, accent);
  const p = ui.step === 'design' && selPiece(r);
  if (p) { const im = await C.loadImg(p.img); if (im) { const A = pieceAffine(p, im), cs = [[0, 0], [im.naturalWidth, 0], [im.naturalWidth, im.naturalHeight], [0, im.naturalHeight]].map(([x, y]) => toScreen(A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5])); g.strokeStyle = accent; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); cs.forEach((q, i) => (i ? g.lineTo(...q) : g.moveTo(...q))); g.closePath(); g.stroke(); g.setLineDash([]); } }
}
function pin(g, x, y, label, colr) {
  g.fillStyle = colr; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.stroke();
  if (label) { g.font = '600 12px -apple-system, system-ui, sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(label, x + 10, y - 8); g.fillStyle = '#fff'; g.fillText(label, x + 10, y - 8); }
}
function fitView(b, tag) {
  // room above for the Show buttons and below for the hint line
  const pad = 20, top = 64, bottom = 36, w = b[2] - b[0], hh = b[3] - b[1];
  view.s = Math.min((view.W - pad * 2) / Math.max(1, w), (view.H - top - bottom) / Math.max(1, hh));
  view.cx = (b[0] + b[2]) / 2; const midY = (b[1] + b[3]) / 2, shift = ((top - bottom) / 2) / view.s;
  view.cy = tag === 'photo' ? midY - shift : midY + shift; view.fitFor = tag;
}
// The template and everything on it, drawn through M (template mm -> canvas pixels). Used for the
// screen and for the texture the body wears.
async function drawContent(g, M, r, o = {}) {
  const t = tpl(r), e = r.existing || {}, v = ui.holdBefore ? 'existing' : ui.view;
  const showOld = v !== 'new', showNew = v !== 'existing', prot = v === 'protected';
  // the measured shape
  const ol = G.outline(t, 96);
  setAffine(g, M); g.beginPath(); ol.forEach((q, i) => (i ? g.lineTo(...q) : g.moveTo(...q))); g.closePath();
  g.save(); g.fillStyle = o.fill || 'rgba(255,255,255,.06)'; g.fill(); g.restore();
  g.save(); g.clip();
  if (o.grid) grid(g, M, t, o.line);
  // focal point
  if (r.focal) { const fo = r.focal, c = G.point(t, K.fAt(fo.deg, r.seam, r.limb), fo.at * t.slant); g.save(); setAffine(g, M); g.strokeStyle = o.accent || '#8474ff'; g.lineWidth = 1.4 / Math.abs(M[0]); g.setLineDash([4 / Math.abs(M[0]), 3 / Math.abs(M[0])]); roundRect(g, c[0] - fo.w / 2, c[1] - fo.h / 2, fo.w, fo.h, 8); g.stroke(); g.restore(); }
  // the existing tattoo: its photo while it is being registered; once traced, the traced ink (the
  // body shows only the ink, never the photo's own skin)
  const m = (e.ink || e.gap) ? await masks(false) : null, traced = !!(m && m.ink && e.ink);
  if (showOld && !(o.body && traced)) {
    for (const p of e.photos || []) {
      if (!p.fit || (p.id !== e.active && v !== 'existing')) continue;
      const pic = await warped(p); if (!pic) continue; const st = straightOf(p);
      g.save(); g.globalAlpha = prot ? 0.35 : traced && v === 'all' ? 0.3 : (p.opacity ?? 0.85); setAffine(g, M, fitAffine(p.fit, st.w, st.h)); g.drawImage(pic, 0, 0, st.w, st.h); g.restore();
    }
  }
  if (traced && (prot || (showOld && v !== 'existing') || (o.body && showOld))) {
    g.save(); setAffine(g, M, maskToTpl(m)); g.globalAlpha = prot ? 0.9 : 0.85; g.drawImage(tint(m.ink, '#1c1c1c'), 0, 0); g.restore();
  }
  if (m && m.gap && prot) { g.save(); setAffine(g, M, maskToTpl(m)); g.globalAlpha = 0.55; g.drawImage(tint(m.gap, '#3a8dde'), 0, 0); g.restore(); }
  if (m && m.ink && prot) { const ring = bufferRing(m, e.buffer ?? 2); if (ring) { g.save(); setAffine(g, M, maskToTpl(m)); g.globalAlpha = 0.6; g.drawImage(ring, 0, 0); g.restore(); } }
  // the new plants
  if (showNew) for (const p of shownPieces(r)) {
    const im = await C.loadImg(p.img); if (!im) continue;
    g.save(); if (prot) g.globalAlpha = 0.45; setAffine(g, M, pieceAffine(p, im)); g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight); g.restore();
  }
  if (showNew && collisions.img && m) { g.save(); setAffine(g, M, maskToTpl(m)); g.drawImage(collisions.img, 0, 0); g.restore(); }
  g.restore();
  // outline, rings and the cut edges
  setAffine(g, M); g.lineWidth = 1.5 / Math.abs(M[0]); g.strokeStyle = o.accent || '#8474ff';
  g.beginPath(); ol.forEach((q, i) => (i ? g.lineTo(...q) : g.moveTo(...q))); g.closePath(); g.stroke();
  for (const sg of t.segs.slice(1)) { g.beginPath(); for (let i = 0; i <= 48; i++) { const q = G.point(t, -0.5 + i / 48, sg.u0); i ? g.lineTo(...q) : g.moveTo(...q); } g.stroke(); }
  if (o.labels) labels(g, r, t, o);
  if (o.labels && ui.step === 'print') drawJoins(g, M, r);
}
function roundRect(g, x, y, w, hh, rr) { g.beginPath(); g.moveTo(x + rr, y); g.lineTo(x + w - rr, y); g.quadraticCurveTo(x + w, y, x + w, y + rr); g.lineTo(x + w, y + hh - rr); g.quadraticCurveTo(x + w, y + hh, x + w - rr, y + hh); g.lineTo(x + rr, y + hh); g.quadraticCurveTo(x, y + hh, x, y + hh - rr); g.lineTo(x, y + rr); g.quadraticCurveTo(x, y, x + rr, y); g.closePath(); }
function grid(g, M, t, colr) {
  setAffine(g, M); g.strokeStyle = colr || 'rgba(128,128,128,.35)'; g.lineWidth = 0.6 / Math.abs(M[0]); g.globalAlpha = 0.5;
  for (let u = 10; u < t.slant; u += 10) { g.beginPath(); for (let i = 0; i <= 64; i++) { const q = G.point(t, -0.5 + i / 64, u); i ? g.lineTo(...q) : g.moveTo(...q); } g.stroke(); }
  const mid = G.circAt(t, t.slant / 2), n = Math.floor(mid / 10);
  for (let k = -Math.floor(n / 2); k <= Math.floor(n / 2); k++) { const f = k * 10 / mid; if (Math.abs(f) >= 0.5) continue; g.beginPath(); g.moveTo(...G.point(t, f, 0)); g.lineTo(...G.point(t, f, t.slant)); g.stroke(); }
  g.globalAlpha = 1;
}
function labels(g, r, t, o) {
  const d = view.dpr || 1; g.setTransform(d, 0, 0, d, 0, 0); g.font = '600 12px -apple-system, system-ui, sans-serif'; g.textAlign = 'center';
  for (const [deg, name] of [[0, 'Inside'], [90, 'Front'], [180, 'Outside'], [270, 'Back']]) {
    const f = K.fAt(deg, r.seam, r.limb); if (Math.abs(f) > 0.49) continue;
    const q = toScreen(...G.point(t, f, 0)); g.fillStyle = o.muted; g.fillText(name, q[0], q[1] + 16);
  }
  if (r.focal) { const c = G.point(t, K.fAt(r.focal.deg, r.seam, r.limb), r.focal.at * t.slant + r.focal.h / 2), q = toScreen(...c); g.fillStyle = o.accent; g.fillText('Front focal point', q[0], q[1] - 6); }
  const a = toScreen(...G.point(t, -0.5, t.slant / 2)), b = toScreen(...G.point(t, 0.5, t.slant / 2)); g.fillStyle = o.muted; g.save(); g.translate(a[0] - 10, a[1]); g.rotate(-Math.PI / 2); g.fillText('Cut', 0, 0); g.restore(); g.save(); g.translate(b[0] + 10, b[1]); g.rotate(Math.PI / 2); g.fillText('Cut', 0, 0); g.restore();
  g.textAlign = 'start';
}
const tintCache = new WeakMap();
function tint(c, colr) {
  let byCol = tintCache.get(c); if (!byCol) { byCol = {}; tintCache.set(c, byCol); }
  const k = colr + ':' + (c.version || 0); if (byCol[k]) return byCol[k];
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const g = o.getContext('2d');
  g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = colr; g.fillRect(0, 0, o.width, o.height);
  for (const kk of Object.keys(byCol)) delete byCol[kk]; byCol[k] = o; return o;
}
function bufferRing(m, bufMm) {
  const k = m.key + ':' + bufMm + ':' + (m.ink.version || 0); if (m.ringFor === k) return m.ring;
  const w = m.w, hh = m.h, a = m.ink.getContext('2d').getImageData(0, 0, w, hh).data, ink = new Uint8Array(w * hh);
  for (let i = 0; i < w * hh; i++) ink[i] = a[i * 4 + 3] > 100 ? 1 : 0;
  const d = K.distanceField(ink, w, hh), c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'), id = g.createImageData(w, hh), od = id.data, b = bufMm * m.ppmm;
  for (let i = 0; i < w * hh; i++) if (!ink[i] && d[i] <= b) { od[i * 4] = 240; od[i * 4 + 1] = 170; od[i * 4 + 2] = 40; od[i * 4 + 3] = 200; }
  g.putImageData(id, 0, 0); m.ring = c; m.ringFor = k; return c;
}
async function drawPhotoMode(g, r) {
  const p = activePhoto(r); if (!p) return;
  const dpr = view.dpr || 1, accent = getComputedStyle(root).getPropertyValue('--stencil').trim() || '#8474ff';
  if (ui.sub === 'straighten') {
    const im = await C.loadImg(p.img); if (!im) return;
    if (view.fitFor !== 'raw:' + p.id) { fitView([0, 0, p.pw, p.ph], 'photo'); view.fitFor = 'raw:' + p.id; }
    const s = view.s, M = [s * dpr, 0, 0, s * dpr, (view.W / 2 - view.cx * s) * dpr, (view.H / 2 - view.cy * s) * dpr];
    g.setTransform(...M); g.drawImage(im, 0, 0, p.pw, p.ph);
    const q = p.quad || cornersOf(p); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = q.map(([x, y]) => [(x - view.cx) * s + view.W / 2, (y - view.cy) * s + view.H / 2]);
    g.strokeStyle = accent; g.lineWidth = 2; g.beginPath(); sc.forEach((c, i) => (i ? g.lineTo(...c) : g.moveTo(...c))); g.closePath(); g.stroke();
    for (const c of sc) { g.fillStyle = accent; g.strokeStyle = '#fff'; g.beginPath(); g.arc(c[0], c[1], 12, 0, Math.PI * 2); g.fill(); g.stroke(); }
    return;
  }
  const pic = await warped(p), st = straightOf(p); if (!pic) return;
  if (view.fitFor !== 'st:' + p.id) { fitView([0, 0, st.w, st.h], 'photo'); view.fitFor = 'st:' + p.id; }
  const s = view.s; g.setTransform(s * dpr, 0, 0, s * dpr, (view.W / 2 - view.cx * s) * dpr, (view.H / 2 - view.cy * s) * dpr); g.drawImage(pic, 0, 0, st.w, st.h);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const l of r.existing?.landmarks || []) { const q = l.src && l.src[p.id]; if (q) pin(g, (q[0] - view.cx) * s + view.W / 2, (q[1] - view.cy) * s + view.H / 2, l.name, accent); }
}
// photo-mode screen <-> photo (raw or straightened) pixels
const photoFromScreen = (x, y) => [(x - view.W / 2) / view.s + view.cx, (y - view.H / 2) / view.s + view.cy];
const photoToScreen = (x, y) => [(x - view.cx) * view.s + view.W / 2, (y - view.cy) * view.s + view.H / 2];

/* ---------------- touch on the flat view ---------------- */
function bindCanvas() {
  const pts = new Map(); let gest = null, lastTap = 0;
  const local = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    pts.set(e.pointerId, local(e));
    if (pts.size === 1) gest = startOne(local(e), e); else if (pts.size === 2) gest = startTwo([...pts.values()], gest);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, local(e));
    if (!gest) return;
    if (pts.size >= 2 && gest.two) moveTwo(gest, [...pts.values()]); else if (pts.size === 1 && !gest.two) moveOne(gest, local(e));
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (pts.size === 0 && gest) {
      const g = gest; gest = null; finish(g, e);
      if (!g.moved && e.type === 'pointerup') { const now = performance.now(); if (now - lastTap < 320) { view.fitFor = ''; draw(); } lastTap = now; }
    } else if (pts.size === 1 && gest && gest.two) { finish(gest, e); gest = { kind: 'pan', start: [...pts.values()][0], v0: { ...view }, moved: true }; }
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = local(e), before = fromS(p); view.s *= Math.exp(-e.deltaY * 0.0015); const after = fromS(p); view.cx += before[0] - after[0]; view.cy += photoMode() ? before[1] - after[1] : before[1] - after[1]; draw(); }, { passive: false });
}
const fromS = (p) => (photoMode() ? photoFromScreen(...p) : fromScreen(...p));
function startOne(p, e) {
  const r = reg(); const g = { start: p, v0: { ...view }, moved: false, kind: 'pan' };
  if (!r) return g;
  const locked = !!r.existing?.locked;
  if (ui.step === 'existing' && ui.sub === 'straighten' && !locked) {
    const ph = activePhoto(r); if (ph) { const q = ph.quad || cornersOf(ph); let best = -1, bd = 30; q.forEach((c, i) => { const s = photoToScreen(...c), d = Math.hypot(s[0] - p[0], s[1] - p[1]); if (d < bd) { bd = d; best = i; } }); if (best >= 0) return { ...g, kind: 'corner', i: best, q0: q.map((c) => c.slice()) }; }
    return g;
  }
  if (ui.step === 'existing' && ui.sub === 'landmarks') {
    const ph = activePhoto(r); if (!ph || locked) return g;
    if (ui.mode && ui.mode.startsWith('lm:')) return { ...g, kind: 'lmPlace' };
    for (const l of r.existing?.landmarks || []) { const q = l.src && l.src[ph.id]; if (q) { const s = photoToScreen(...q); if (Math.hypot(s[0] - p[0], s[1] - p[1]) < 24) return { ...g, kind: 'lm', id: l.id }; } }
    return g;
  }
  if (ui.mode && ui.mode.startsWith('brush:') && !locked) return { ...g, kind: 'brush', stroke: [fromScreen(...p)], pen: e.pointerType === 'pen' };
  if (ui.step === 'design') {
    const id = pieceAt(p); if (id) { if (ui.sel !== id) { ui.sel = id; renderSide(r); } const pc = selPiece(r); return { ...g, kind: 'piece', id, p0: { x: pc.x, y: pc.y } }; }
    if (ui.sel) { ui.sel = null; renderSide(r); draw(); }
    return g;
  }
  if (ui.step === 'existing' && ui.sub === 'place' && !locked) { const ph = activePhoto(r); if (ph?.fit) return { ...g, kind: 'photo', f0: { ...ph.fit } }; }
  return g;
}
function pieceAt(p) {
  const r = reg(), q = fromScreen(...p);
  for (const pc of pieces(r).slice().reverse()) {
    if (pc.hidden) continue; const ar = pc.w / pc.aspect, a = -(pc.rot || 0) * Math.PI / 180, X = q[0] - pc.x, Y = q[1] - pc.y;
    const lx = X * Math.cos(a) - Y * Math.sin(a), ly = X * Math.sin(a) + Y * Math.cos(a);
    if (Math.abs(lx) <= pc.w / 2 + 3 && Math.abs(ly) <= ar / 2 + 3) return pc.id;
  }
  return null;
}
let dragSnap = false;
function beginEdit() { if (!dragSnap) { C.snapshot(); dragSnap = true; } }
function moveOne(g, p) {
  const dx = p[0] - g.start[0], dy = p[1] - g.start[1];
  if (!g.moved && Math.hypot(dx, dy) < 4) return; g.moved = true;
  const r = reg();
  if (g.kind === 'pan') { view.cx = g.v0.cx - dx / view.s; view.cy = photoMode() ? g.v0.cy - dy / view.s : g.v0.cy + dy / view.s; draw(); return; }
  if (g.kind === 'corner') { beginEdit(); const ph = activePhoto(r), q = g.q0.map((c) => c.slice()); q[g.i] = [Math.max(0, Math.min(ph.pw, g.q0[g.i][0] + dx / view.s)), Math.max(0, Math.min(ph.ph, g.q0[g.i][1] + dy / view.s))]; if (K.quadOk(q)) { ph.quad = q; } draw(); return; }
  if (g.kind === 'lm') { beginEdit(); const ph = activePhoto(r), l = r.existing.landmarks.find((x) => x.id === g.id); l.src[ph.id] = photoFromScreen(...p); draw(); return; }
  if (g.kind === 'brush') { g.stroke.push(fromScreen(...p)); brushPreview(g); return; }
  if (g.kind === 'piece') { beginEdit(); const pc = selPiece(r); pc.x = g.p0.x + dx / view.s; pc.y = g.p0.y - dy / view.s; draw(); syncOverlay(); return; }
  if (g.kind === 'photo') { beginEdit(); const ph = activePhoto(r); ph.fit.x = g.f0.x + dx / view.s; ph.fit.y = g.f0.y - dy / view.s; draw(); syncOverlay(); }
}
function startTwo(ps, prev) {
  const r = reg(), mid = [(ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2], d = Math.hypot(ps[1][0] - ps[0][0], ps[1][1] - ps[0][1]), a = Math.atan2(ps[1][1] - ps[0][1], ps[1][0] - ps[0][0]);
  if (prev && prev.kind === 'brush') prev.kind = 'cancelled';
  const g = { two: true, mid, d, a, v0: { ...view }, moved: true, kind: 'view' };
  if (ui.step === 'design' && prev && prev.kind === 'piece') { const pc = selPiece(r); return { ...g, kind: 'pieceTwo', w0: pc.w, r0: pc.rot || 0 }; }
  return g;
}
function moveTwo(g, ps) {
  const mid = [(ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2], d = Math.hypot(ps[1][0] - ps[0][0], ps[1][1] - ps[0][1]), a = Math.atan2(ps[1][1] - ps[0][1], ps[1][0] - ps[0][0]);
  if (g.kind === 'pieceTwo') { beginEdit(); const pc = selPiece(); pc.w = Math.max(2, Math.min(600, g.w0 * d / g.d)); pc.rot = ((g.r0 - (a - g.a) * 180 / Math.PI) + 540) % 360 - 180; draw(); syncOverlay(); return; }
  const k = d / g.d, s = Math.max(0.05, Math.min(80, g.v0.s * k));
  // keep the spot under the fingers' middle under it
  const at = photoMode() ? [(g.mid[0] - view.W / 2) / g.v0.s + g.v0.cx, (g.mid[1] - view.H / 2) / g.v0.s + g.v0.cy] : [(g.mid[0] - view.W / 2) / g.v0.s + g.v0.cx, g.v0.cy - (g.mid[1] - view.H / 2) / g.v0.s];
  view.s = s;
  if (photoMode()) { view.cx = at[0] - (mid[0] - view.W / 2) / s; view.cy = at[1] - (mid[1] - view.H / 2) / s; }
  else { view.cx = at[0] - (mid[0] - view.W / 2) / s; view.cy = at[1] + (mid[1] - view.H / 2) / s; }
  draw();
}
async function finish(g) {
  const r = reg();
  if (g.kind === 'lmPlace' && !g.moved) {
    const ph = activePhoto(r), key = ui.mode.slice(3);
    C.snapshot(); const e = ex(r); e.landmarks = e.landmarks || [];
    let l = e.landmarks.find((x) => (x.key || x.id) === key);
    if (!l) { l = { id: uid(), key, name: landmarkName(key) }; e.landmarks.push(l); }
    l.src = { ...(l.src || {}), [ph.id]: photoFromScreen(...g.start) };
    // move on to the next landmark not yet placed
    const next = K.LANDMARKS.find((L) => { const m = e.landmarks.find((x) => x.key === L.key); return !(m && m.src && m.src[ph.id]); });
    ui.mode = next ? 'lm:' + next.key : null;
    C.commit(); refresh(); return;
  }
  if (g.kind === 'brush') { await brushCommit(g); return; }
  if (dragSnap) {
    dragSnap = false;
    if (g.kind === 'lm' || g.kind === 'corner') { const ph = activePhoto(r); if (g.kind === 'corner') { const q = ph.quad; ph.quad = g.q0; setQuad(ph, q); } if (ph.fit) storeLandmarkSpots(); }
    C.commit(); refresh();
  }
}
// brushing: drawn straight onto the mask canvas while the finger moves, saved as one step
async function brushPreview(g) {
  const m = await masks(true); if (!m || g.kind === 'cancelled') return;
  const [layer, how] = [ui.mode.includes('gap') ? 'gap' : 'ink', ui.mode.endsWith('-') ? 'out' : 'in'];
  const c = m[layer].getContext('2d'), a = g.stroke[g.stroke.length - 2] || g.stroke[0], b = g.stroke[g.stroke.length - 1];
  c.save(); c.globalCompositeOperation = how === 'out' ? 'destination-out' : 'source-over'; c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineWidth = ui.brush * m.ppmm;
  c.beginPath(); c.moveTo(...toMask(m, ...a)); c.lineTo(...toMask(m, ...b)); c.stroke(); c.restore();
  m[layer].version = (m[layer].version || 0) + 1; g.dirty = layer; draw();
}
async function brushCommit(g) {
  if (!g.dirty) { if (!g.moved) { await brushPreview({ ...g, stroke: [g.stroke[0], g.stroke[0]] }); const m = await masks(true); saveMasks(m, [ui.mode.includes('gap') ? 'gap' : 'ink']); refresh(); } return; }
  const m = await masks(true); saveMasks(m, [g.dirty]); refresh();
}

/* ---------------- controls ---------------- */
function slider(min, max, step, value, on) {
  const s = document.createElement('ink-slider'); s.setAttribute('min', min); s.setAttribute('max', max); s.setAttribute('step', step); s.setAttribute('value', value);
  s.addEventListener('input', () => on(+s.value, false)); s.addEventListener('change', () => on(+s.value, true));
  return s;
}
function fileButton(id, label, multiple, disabled, onFiles) {
  const inp = h('input', { type: 'file', accept: 'image/*', hidden: true, multiple: multiple || false, id: id + 'File' });
  inp.addEventListener('change', () => { const f = [...inp.files]; inp.value = ''; if (f.length) onFiles(f); });
  return h('div', { class: 'row' }, inp, h('button', { class: 'btn primary', type: 'button', id, disabled, text: label, onclick: () => inp.click() }));
}
function thumb(key) { const im = h('img', { alt: '' }); C.loadImg(key).then((e) => { if (e) im.src = e.src; }); return im; }

/* ---------------- the body: tapping rings, and the measured area worn on the skin ---------------- */
function tapBody(hit) {
  if (!ui.open || !ui.mode || !ui.mode.startsWith('band:')) return false;
  const i = +ui.mode.slice(5), r = reg(); if (!hit || hit.faceIndex == null || !hit.barycoord) { C.toast('Tap directly on the leg.'); return true; }
  const lf = limbFrame(r); if (!lf) return true;
  const vs = [hit.face.a, hit.face.b, hit.face.c]; if (!vs.some((v) => lf.keep(v))) { C.toast(`Tap on the ${R.LIMB_NAMES[r.limb].toLowerCase()}.`); return true; }
  change(() => { reg().levels[i].pin = { tri: hit.faceIndex, w: [hit.barycoord.x, hit.barycoord.y, hit.barycoord.z] }; });
  ui.mode = null; overlayKey = ''; refresh(); C.toast('Ring placed. The flat shape still comes from your tape numbers.');
  return true;
}
function limbFrame(r) {
  const info = C.rig(); if (!info) return null;
  const side = r.limb.endsWith('L') ? 'L' : 'R', leg = r.limb.startsWith('leg');
  const at = (n) => { const b = info.bones.find((x) => x.name === `${n}.${side}`); return b ? [0, 1, 2].map((k) => info.joints[b.head * 3 + k]) : null; };
  const upper = at(leg ? 'lowerleg01' : 'lowerarm01'), lower = at(leg ? 'foot' : 'wrist'); if (!upper || !lower) return null;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
  const up = nrm(sub(upper, lower));
  let o = side === 'L' ? [1, 0, 0] : [-1, 0, 0]; o = nrm(sub(o, up.map((x) => x * dot(o, up))));
  let fr = [0, 0, 1]; fr = nrm(sub(sub(fr, up.map((x) => x * dot(fr, up))), o.map((x) => x * dot(fr, o))));
  const re = leg ? new RegExp(`^(lowerleg0[12]|upperleg02|foot)\\.${side}$`) : new RegExp(`^(lowerarm0[12]|upperarm02|wrist)\\.${side}$`);
  const topBone = new Map();
  const keep = (v) => { if (v >= info.count) return false; let k = topBone.get(v); if (k === undefined) { let best = '', w = -1; for (const [n, x] of info.vertexBones(v)) if (x > w) { w = x; best = n; } k = re.test(best); topBone.set(v, k); } return k; };
  const mmPer = 1000 * (S().heightCm || 175) / 175;
  const P = info.rest();
  const hOf = (p) => dot(sub(p, lower), up) * mmPer;
  const degOf = (p) => { const w = sub(p, lower), x = -dot(w, o), y = dot(w, fr); return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360; };
  const pinPoint = (pin) => { const I = info.index; const vs = [I[pin.tri * 3], I[pin.tri * 3 + 1], I[pin.tri * 3 + 2]]; return [0, 1, 2].map((k) => vs.reduce((s, v, j) => s + P[v * 3 + k] * pin.w[j], 0)); };
  return { up, o, fr, lower, keep, hOf, degOf, mmPer, P, pinPoint };
}
// the height of each ring above the joint (mm on the 3D body): from its pin, or spaced as measured
function ringHeights(r, lf, t) {
  const hs = r.levels.map((l) => (l.pin ? lf.hOf(lf.pinPoint(l.pin)) : null));
  if (hs[0] == null) hs[0] = r.limb.startsWith('leg') ? 30 : 40;
  for (let i = 1; i < hs.length; i++) if (hs[i] == null) hs[i] = hs[i - 1] + t.segs[i - 1].h;
  return hs;
}
let overlay = null, overlayKey = '', overlayTex = null, overlayCanvas = null, overlayFrame = null;
// The body wears the measured area as a thin layer over the leg. The leg's mesh is coarse (a few
// hundred points below the knee), so the flat shape is not pinned to its corners: every pixel works
// out its own place on the flat shape from its standing position (height up the limb and direction
// round it), so the rings, the seam and the art land exactly where the numbers put them.
const MAXSEG = 6;
const FRAG_HEAD = `
uniform sampler2D wMap; uniform vec3 wLower, wUp, wO, wFr; uniform float wMmPer, wSeam, wSign, wSlant; uniform int wN;
uniform float wRing[${MAXSEG + 1}]; uniform vec4 wSegA[${MAXSEG}]; uniform vec4 wSegB[${MAXSEG}]; uniform vec4 wFrame;
varying vec3 vRest;
`;
const FRAG_MAP = `
{
  vec3 wv = vRest - wLower; float hmm = dot(wv, wUp) * wMmPer;
  float ang = degrees(atan(dot(wv, wFr), -dot(wv, wO))); float d = mod(ang - wSeam + 1080.0, 360.0) - 180.0; float f = wSign * d / 360.0;
  // u along the measured skin: in proportion between the rings on the body
  float u = -1.0; float u0 = 0.0;
  for (int i = 0; i < ${MAXSEG}; i++) { if (i >= wN) break; float h0 = wRing[i], h1 = wRing[i + 1]; if (hmm <= h1 || i == wN - 1) { u = u0 + (hmm - h0) / max(1e-6, h1 - h0) * wSegA[i].z; break; } u0 += wSegA[i].z; }
  if (u < 0.0 || u > wSlant) discard;
  vec2 P = vec2(0.0); u0 = 0.0;
  for (int i = 0; i < ${MAXSEG}; i++) { if (i >= wN) break; vec4 A = wSegA[i], B = wSegB[i]; if (u <= u0 + A.z || i == wN - 1) {
      float v = u - u0;
      if (A.w > 0.5) { P = vec2(f * (A.x + (A.y - A.x) * v / A.z), v); }
      else { float a = f * B.y, sh = sin(a * 0.5); if (B.x > 0.0) { float R = B.z + v; P = vec2(R * sin(a), v * cos(a) - 2.0 * B.z * sh * sh); } else { float R = B.z - v; P = vec2(R * sin(a), v * cos(a) + 2.0 * B.z * sh * sh); } }
      P.y += B.w; break; }
    u0 += A.z; }
  vec2 wuv = vec2((wFrame.x + P.x) / wFrame.z, 1.0 - (wFrame.y - P.y) / wFrame.w);
  vec4 tc = texture2D(wMap, wuv); diffuseColor *= tc;
}
`;
function buildOverlay(r) {
  const THREE = C.THREE, body = C.body(), t = tpl(r), lf = limbFrame(r); if (!t || !lf) return;
  const hs = ringHeights(r, lf, t);
  const uOf = (hmm) => { let u0 = 0; for (let i = 1; i < hs.length; i++) { const s = t.segs[i - 1]; if (hmm <= hs[i] || i === hs.length - 1) return u0 + (hmm - hs[i - 1]) / Math.max(1e-6, hs[i] - hs[i - 1]) * s.s; u0 += s.s; } return 0; };
  const frame = G.canvasFor(t, { ppi: 6 * 25.4, padMm: 3 }); overlayFrame = frame;
  const info = C.rig(), I = info.index;
  // every leg triangle near the band: the shader keeps only the pixels inside it
  const near = new Map(), keepV = (v) => { if (near.has(v)) return near.get(v); let k = false; if (v < info.count && lf.keep(v)) { const p = [lf.P[v * 3], lf.P[v * 3 + 1], lf.P[v * 3 + 2]], u = uOf(lf.hOf(p)); k = u > -45 && u < t.slant + 45; } near.set(v, k); return k; };
  const map = new Map(), from = [], idx = [];
  const at = (v) => { let i = map.get(v); if (i === undefined) { i = from.length; map.set(v, i); from.push(v); } return i; };
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k], b = I[k + 1], c = I[k + 2];
    if (a >= info.count || b >= info.count || c >= info.count) continue;
    if (!(keepV(a) || keepV(b) || keepV(c)) || !(lf.keep(a) && lf.keep(b) && lf.keep(c))) continue;
    idx.push(at(a), at(b), at(c));
  }
  if (!overlay) {
    const g = new THREE.BufferGeometry();
    const mat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.62, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const U = { wMap: { value: null }, wLower: { value: new THREE.Vector3() }, wUp: { value: new THREE.Vector3() }, wO: { value: new THREE.Vector3() }, wFr: { value: new THREE.Vector3() }, wMmPer: { value: 1000 }, wSeam: { value: 0 }, wSign: { value: 1 }, wSlant: { value: 1 }, wN: { value: 1 }, wRing: { value: new Array(MAXSEG + 1).fill(0) }, wSegA: { value: Array.from({ length: MAXSEG }, () => new THREE.Vector4()) }, wSegB: { value: Array.from({ length: MAXSEG }, () => new THREE.Vector4()) }, wFrame: { value: new THREE.Vector4(0, 0, 1, 1) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute vec3 rest;\nvarying vec3 vRest;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vRest = rest;');
      sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <map_fragment>', FRAG_MAP);
    };
    mat.customProgramCacheKey = () => 'measuredWrap1';
    const mesh = new THREE.Mesh(g, mat); mesh.name = 'measuredWrap'; mesh.frustumCulled = false; mesh.renderOrder = 905; mesh.raycast = () => {}; mesh.userData.notBody = true; mesh.visible = false;
    let seen = '';
    mesh.onBeforeRender = () => {
      const src = body.geometry, k2 = src.uuid + ':' + src.attributes.position.version + ':' + mesh.userData.ver; if (k2 === seen) return; seen = k2;
      const P = src.attributes.position.array, N = src.attributes.normal.array, p = g.attributes.position.array, nn = g.attributes.normal.array, fr = mesh.userData.from;
      for (let i = 0; i < fr.length; i++) { const s = fr[i] * 3, o = i * 3; p[o] = P[s]; p[o + 1] = P[s + 1]; p[o + 2] = P[s + 2]; nn[o] = N[s]; nn[o + 1] = N[s + 1]; nn[o + 2] = N[s + 2]; }
      g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    };
    body.add(mesh);
    overlay = { mesh, mat, U, set(canvas, on) { if (canvas && overlayTex?.image !== canvas) { overlayTex?.dispose(); overlayTex = new THREE.CanvasTexture(canvas); overlayTex.colorSpace = THREE.SRGBColorSpace; overlayTex.anisotropy = 4; U.wMap.value = overlayTex; } mesh.visible = !!on && !!canvas; C.requestRender(); } };
  }
  const g = overlay.mesh.geometry, cnt = from.length, rest = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) for (let k = 0; k < 3; k++) rest[i * 3 + k] = lf.P[from[i] * 3 + k];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cnt * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cnt * 3), 3));
  g.setAttribute('rest', new THREE.BufferAttribute(rest, 3));
  g.setIndex(idx); overlay.mesh.userData.from = Uint32Array.from(from); overlay.mesh.userData.ver = (overlay.mesh.userData.ver || 0) + 1;
  const U = overlay.U;
  U.wLower.value.set(...lf.lower); U.wUp.value.set(...lf.up); U.wO.value.set(...lf.o); U.wFr.value.set(...lf.fr); U.wMmPer.value = lf.mmPer;
  U.wSeam.value = r.seam; U.wSign.value = K.limbSign(r.limb); U.wSlant.value = t.slant; U.wN.value = t.segs.length;
  for (let i = 0; i <= MAXSEG; i++) U.wRing.value[i] = hs[Math.min(i, hs.length - 1)];
  t.segs.forEach((s, i) => { U.wSegA.value[i].set(s.cb, s.ct, s.s, s.flat ? 1 : 0); U.wSegB.value[i].set(s.dir, s.angle, s.flat ? 0 : s.Rb, s.y0); });
  U.wFrame.value.set(frame.originMm[0], frame.originMm[1], frame.wMm, frame.hMm);
  overlay.tris = idx.length / 3; overlay.uOf = uOf; overlay.hs = hs;
}
let overlayQueued = false;
function syncOverlay() {
  if (overlayQueued) return; overlayQueued = true;
  requestAnimationFrame(() => { overlayQueued = false; syncOverlayNow().catch((e) => console.warn(e)); });
}
async function syncOverlayNow() {
  const r = reg(); if (!ui.open || !r || !tpl(r)) { if (overlay) overlay.set(null, false); return; }
  const k = JSON.stringify([r.limb, r.seam, r.method, r.levels, S().heightCm, C.shapeKey()]);
  if (k !== overlayKey) { overlayKey = k; buildOverlay(r); }
  if (!overlay) return;
  const f = overlayFrame;
  if (!overlayCanvas) overlayCanvas = document.createElement('canvas');
  if (overlayCanvas.width !== f.w || overlayCanvas.height !== f.h) { overlayCanvas.width = f.w; overlayCanvas.height = f.h; }
  const g = overlayCanvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, f.w, f.h);
  const k2 = f.w / f.wMm, M = [k2, 0, 0, -k2, f.originMm[0] * k2, f.originMm[1] * k2];
  await drawContent(g, M, r, { fill: 'rgba(255,255,255,.10)', accent: '#8474ff', body: true });
  if (overlayTex) overlayTex.needsUpdate = true;
  overlay.set(overlayCanvas, true);
  scheduleCollisions();
}

// turn the camera to look at the wrap from one side (degrees round the limb)
let lastAim = 270;
addEventListener('resize', () => { if (!ui.open) return; clearTimeout(aimAt.t); aimAt.t = setTimeout(() => { view.fitFor = ''; draw(); aimAt(lastAim); }, 350); });
function aimAt(deg) {
  lastAim = deg;
  const r = reg(); if (!r || !C.aim) return; const lf = limbFrame(r), t = tpl(r); if (!lf || !t) return;
  const hs = ringHeights(r, lf, t), mid = (hs[0] + hs[hs.length - 1]) / 2 / lf.mmPer, a = deg * Math.PI / 180;
  const dir = [0, 1, 2].map((k) => Math.cos(a) * -lf.o[k] + Math.sin(a) * lf.fr[k]);
  const centre = [0, 1, 2].map((k) => lf.lower[k] + lf.up[k] * mid + dir[k] * 0.045);
  C.aim(centre, dir, (hs[hs.length - 1] - hs[0]) / lf.mmPer * 2.2 + 0.08);
}

/* ---------------- for the headless checks ---------------- */
function testApi() {
  return {
    ui, view, reg, tpl: () => tpl(), invertAt: (xy) => G.invert(tpl(), xy[0], xy[1]), fAt: (deg) => K.fAt(deg, reg().seam, reg().limb), summary: () => { const t = tpl(); return t && G.summary(t); },
    overlayTris: () => (overlay ? overlay.tris : 0), overlayShown: () => !!(overlay && overlay.mesh.visible),
    collisions: async () => { collisions.key = ''; await checkCollisions(); return collisions.result; },
    masks: async () => { const m = await masks(false); if (!m || !m.ink) return null; const a = m.ink.getContext('2d').getImageData(0, 0, m.w, m.h).data, gp = m.gap.getContext('2d').getImageData(0, 0, m.w, m.h).data; let ink = 0, gap = 0; for (let i = 3; i < a.length; i += 4) { if (a[i] > 100) ink++; if (gp[i] > 100) gap++; } return { ink: ink / (m.ppmm * m.ppmm), gap: gap / (m.ppmm * m.ppmm), w: m.w, h: m.h, ppmm: m.ppmm }; },
    inkWidth: () => inkWidth(reg()), place: () => change(() => placePhoto()), findInk, findGaps,
    landmarkAt: (key) => { const m = (reg()?.existing?.landmarks || []).find((l) => l.key === key); return m && m.at; },
    toScreen, fromScreen, photoToScreen, warnings: () => warnings(reg()), aimAt,
    setLandmark: (key, xy) => change(() => { const r = reg(), p = activePhoto(r), e = ex(r); e.landmarks = e.landmarks || []; let l = e.landmarks.find((x) => x.key === key); if (!l) { l = { id: uid(), key, name: landmarkName(key) }; e.landmarks.push(l); } l.src = { ...(l.src || {}), [p.id]: xy }; }),
    addPhotoData: async (dataUrl, name) => { const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; }); const p = { id: uid(), img: C.putImage(dataUrl), pw: im.naturalWidth, ph: im.naturalHeight, name }; change(() => { const e = ex(reg()); e.photos = [...(e.photos || []), p]; e.active = e.active || p.id; if (!e.landmarks) e.landmarks = K.LANDMARKS.slice(0, 4).map((l) => ({ id: uid(), key: l.key, name: l.name })); }); return p.id; },
    makePackage: async (opts = {}) => { if (opts.ppi) ui.ppi = opts.ppi; if (opts.format) ui.pkgFormat = opts.format; const res = await makePackage(); return res && { name: res.name, size: res.size, session: res.session }; },
    packageBase64: async () => { if (!ui.pkg) return null; const u = new Uint8Array(await ui.pkg.blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); },
    bringBackBase64: async (b64, name, type = 'application/octet-stream') => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return bringBack(new File([u], name, { type })); },
    review: () => ui.review && { ok: ui.review.check.ok, how: ui.review.check.how, why: ui.review.check.why, piece: ui.review.piece ? { ...ui.review.piece } : null, stale: ui.review.stale },
    useReturn, highPpi: () => P.highPpi(tpl()),
    makePrint: async (kind = 'stencil') => { ui.printKind = kind; return makePrint(); }, printBase64: async () => { if (!ui.printOut) return null; const u = new Uint8Array(await ui.printOut.blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); }, printLayout: () => printLayout(reg()), approval: () => approval(reg()), setPrint: (o) => setPrint((x) => Object.assign(x, o)), artSig: () => artSig(reg()),
    // the visible new art rasterised on the template at ppmm pixels per mm (alpha only, base64)
    artAlpha: async (ppmm = 4) => { const t = tpl(), b = t.bounds, w = Math.ceil((b.w + 30) * ppmm), hh = Math.ceil((b.h + 30) * ppmm), c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); const M = [ppmm, 0, 0, -ppmm, (15 - b.minX) * ppmm, (b.maxY + 15) * ppmm]; for (const p of shownPieces()) { const im = await C.loadImg(p.img); if (!im) continue; g.save(); setAffine(g, M, pieceAffine(p, im)); g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight); g.restore(); } const d = g.getImageData(0, 0, w, hh).data, a = new Uint8Array(w * hh); for (let i = 0; i < w * hh; i++) a[i] = d[i * 4 + 3]; let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768)); return { w, h: hh, b64: btoa(s) }; },
    addPieceData: async (dataUrl, name, at, w) => { const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; }); const p = { id: uid(), img: C.putImage(dataUrl), pw: im.naturalWidth, ph: im.naturalHeight, x: at[0], y: at[1], w, aspect: im.naturalWidth / im.naturalHeight, rot: 0, flip: false, name }; change(() => { const x = reg(); x.art = x.art || {}; x.art.pieces = [...(x.art.pieces || []), p]; }); return p.id; },
  };
}
