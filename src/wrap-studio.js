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

let C = null; // what the app gives the studio (see initWrapStudio)
const ui = { step: 'measure', view: 'all', sub: 'photos', sel: null, mode: null, brush: 4, holdBefore: false, open: false, fitted: false, lmKey: null };
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
    h('div', { id: 'wsTabs', role: 'tablist' }, ...[['measure', 'Measurements'], ['existing', 'Existing tattoo'], ['design', 'Design']].map(([k, label]) =>
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
  return h('div', { class: 'seg' + (items.length === 4 ? ' four' : '') + (cls ? ' ' + cls : ''), role: 'group' }, ...items.map(([v, label]) =>
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

/* ---------------- collisions ---------------- */
const collisions = { key: '', result: null, img: null, timer: 0 };
async function checkCollisions() {
  const r = reg(); if (!r) return;
  const e = r.existing || {}, ps = pieces(r).filter((p) => !p.hidden);
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
  if (ui.step === 'design') renderSide(r); draw(); syncOverlay();
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
  if (showNew) for (const p of pieces(r)) {
    if (p.hidden) continue; const im = await C.loadImg(p.img); if (!im) continue;
    g.save(); if (prot) g.globalAlpha = 0.45; setAffine(g, M, pieceAffine(p, im)); g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight); g.restore();
  }
  if (showNew && collisions.img && m) { g.save(); setAffine(g, M, maskToTpl(m)); g.drawImage(collisions.img, 0, 0); g.restore(); }
  g.restore();
  // outline, rings and the cut edges
  setAffine(g, M); g.lineWidth = 1.5 / Math.abs(M[0]); g.strokeStyle = o.accent || '#8474ff';
  g.beginPath(); ol.forEach((q, i) => (i ? g.lineTo(...q) : g.moveTo(...q))); g.closePath(); g.stroke();
  for (const sg of t.segs.slice(1)) { g.beginPath(); for (let i = 0; i <= 48; i++) { const q = G.point(t, -0.5 + i / 48, sg.u0); i ? g.lineTo(...q) : g.moveTo(...q); } g.stroke(); }
  if (o.labels) labels(g, r, t, o);
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
    addPieceData: async (dataUrl, name, at, w) => { const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; }); const p = { id: uid(), img: C.putImage(dataUrl), pw: im.naturalWidth, ph: im.naturalHeight, x: at[0], y: at[1], w, aspect: im.naturalWidth / im.naturalHeight, rot: 0, flip: false, name }; change(() => { const x = reg(); x.art = x.art || {}; x.art.pieces = [...(x.art.pieces || []), p]; }); return p.id; },
  };
}
