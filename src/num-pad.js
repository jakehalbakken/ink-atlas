// A number pad of our own for typing measurements. The iPad's keyboard pushes and resizes the
// page under a fixed layout, and Jake lost the screen every time it came up (2026-11-19), so
// measurement boxes never focus a text field: the numbers are typed on these keys, or on a
// hardware keyboard, and nothing about the page moves.
//
// padKey and padValue are pure (unit tested); openPad builds the keys.

const FRACS = { '¼': 0.25, '½': 0.5, '¾': 0.75 };

// The text after pressing key. Fractions follow a whole number with a space (14 ½), a second
// fraction replaces the first, a decimal point and a fraction never mix, and ⌫ takes the last
// character with the space before it.
export function padKey(text, key, unit = 'in') {
  let t = String(text || '');
  if (key === '⌫') { t = t.slice(0, -1); return t.replace(/\s+$/, ''); }
  if (key === 'clear') return '';
  if (key in FRACS) {
    if (unit === 'cm') return t;
    t = t.replace(/\s*[¼½¾]$/, '');
    if (/\.\d*$/.test(t.split(/['\s]/).pop() || '')) return t;
    return t ? `${t} ${key}` : key;
  }
  if (key === "'") { if (unit !== 'ft' || t.includes("'") || !/\d$/.test(t)) return t; return `${t}' `; }
  if (key === '.') {
    const last = t.split(/['\s]/).pop() || '';
    if (last.includes('.') || /[¼½¾]$/.test(t)) return t;
    return `${t}${last ? '' : '0'}.`;
  }
  if (/^\d$/.test(key)) {
    if (/[¼½¾]$/.test(t)) return t;
    const last = t.split(/['\s]/).pop() || '';
    if (last.replace('.', '').length >= 4) return t;
    if (last === '0' && key !== '.') t = t.slice(0, -1);
    return t + key;
  }
  return t;
}

// The value in inches for what is on the pad, or null. 'ft' reads 5' 10.5 (and a bare 5 or 6 as
// feet, since nobody is 6 inches tall); 'cm' reads centimetres.
export function padValue(text, unit = 'in') {
  const t = String(text || '').trim(); if (!t) return null;
  const num = (s) => { s = s.trim(); if (!s) return 0; const m = s.match(/^(\d+(?:\.\d*)?)?\s*([¼½¾])?$/); if (!m || (!m[1] && !m[2])) return NaN; return (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? FRACS[m[2]] : 0); };
  if (unit === 'cm') { const v = num(t); return Number.isFinite(v) && v > 0 ? v / 2.54 : null; }
  if (unit === 'ft') {
    const [f, i = ''] = t.split("'");
    const ft = num(f), inch = num(i);
    if (!Number.isFinite(ft) || !Number.isFinite(inch)) return null;
    const v = t.includes("'") ? ft * 12 + inch : ft <= 8 ? ft * 12 : ft;
    return v > 0 ? v : null;
  }
  const v = num(t); return Number.isFinite(v) && v > 0 ? v : null;
}

// How the pad shows a value it opens with: one decimal in inches or cm, feet and inches for 'ft'.
export function padStart(inches, unit = 'in') {
  if (!(inches > 0)) return '';
  if (unit === 'cm') return String(+(inches * 2.54).toFixed(1));
  if (unit === 'ft') { let f = Math.floor(inches / 12), i = +(inches - f * 12).toFixed(1); if (i >= 12) { f++; i = 0; } return `${f}' ${i}`; }
  return String(+inches.toFixed(1));
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];

// Build a pad. opts: { title, hint, inches, units: ['in','cm'] or ['ft','cm'], unit, inline: host
// element (otherwise it floats at the bottom of the screen), place(el) to position a floating
// pad, onDone(inches, text, unit), onNext(inches) and onBack() (shown only when given),
// onCancel(), doneLabel }. Returns { el, close, value() }.
export function openPad(opts) {
  const units = opts.units || ['in', 'cm'];
  let unit = opts.unit && units.includes(opts.unit) ? opts.unit : units[0];
  let text = padStart(opts.inches, unit), fresh = true, closed = false;
  const h = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const root = h('div', `numpad${opts.inline ? ' inline' : ' glass'}`); root.setAttribute('role', 'group'); root.setAttribute('aria-label', `${opts.title || 'Measurement'}: number pad`);
  const head = h('div', 'np-head'), title = h('div', 'np-title', opts.title || ''), hint = h('div', 'np-hint', opts.hint || '');
  const show = h('div', 'np-show'); show.setAttribute('aria-live', 'polite'); show.dataset.np = 'show';
  const num = h('span', 'np-num'), suf = h('span', 'np-unit'); show.append(num, suf);
  const unitSeg = h('div', 'seg np-units'); unitSeg.setAttribute('role', 'group'); unitSeg.setAttribute('aria-label', 'Unit');
  const unitName = { in: 'Inches', cm: 'cm', ft: 'Feet' };
  const unitBtns = units.map((u) => { const b = h('button', 'btn', unitName[u]); b.type = 'button'; b.dataset.unit = u; b.addEventListener('click', () => setUnit(u)); return b; });
  unitSeg.append(...unitBtns);
  head.append(title); if (opts.hint) head.append(hint);
  const grid = h('div', 'np-keys');
  const press = (k) => { if (fresh && /^[\d.¼½¾]$/.test(k)) text = ''; fresh = false; text = padKey(text, k, unit); draw(); };
  for (const k of KEYS) { const b = h('button', `btn np-k${k === '⌫' ? ' np-back' : ''}`, k); b.type = 'button'; b.dataset.key = k; if (k === '⌫') b.setAttribute('aria-label', 'Delete'); if (k === '.') b.setAttribute('aria-label', 'Point'); b.addEventListener('click', () => press(k)); grid.append(b); }
  const extra = h('div', 'np-extra');
  const fracs = ['¼', '½', '¾'].map((k) => { const b = h('button', 'btn np-k np-frac', k); b.type = 'button'; b.dataset.key = k; b.addEventListener('click', () => press(k)); return b; });
  const ftKey = h('button', 'btn np-k np-ft', 'ft'); ftKey.type = 'button'; ftKey.dataset.key = "'"; ftKey.setAttribute('aria-label', 'Feet'); ftKey.addEventListener('click', () => press("'"));
  extra.append(...fracs, ftKey);
  const foot = h('div', 'np-foot');
  const mk = (label, cls, fn) => { const b = h('button', `btn ${cls || ''}`, label); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const cancel = mk(opts.cancelLabel || 'Cancel', 'quiet np-cancel', () => end('cancel'));
  const back = opts.onBack ? mk('Back', 'np-prev', () => end('back')) : null;
  const next = opts.onNext ? mk(opts.nextLabel || 'Next', 'np-next', () => end('next')) : null;
  const done = mk(opts.doneLabel || 'Done', 'primary np-done', () => end('done'));
  if (opts.hideCancel) cancel.hidden = true;
  foot.append(...[cancel, back, next, done].filter(Boolean));
  root.append(head, show, units.length > 1 ? unitSeg : h('span'), grid, extra, foot);
  if (units.length < 2) unitSeg.hidden = true;
  function setUnit(u) {
    if (u === unit) return;
    const v = padValue(text, unit); unit = u; text = v != null ? padStart(v, unit) : ''; fresh = true; draw();
  }
  function draw() {
    num.textContent = unit === 'ft' ? (text ? text.replace("'", '′') : '') : text;
    suf.textContent = unit === 'cm' ? ' cm' : unit === 'ft' ? (text.includes("'") ? '″' : text ? '′' : '') : ' in';
    show.classList.toggle('empty', !text); show.classList.toggle('fresh', fresh && !!text);
    if (!text) num.textContent = '–';
    for (const b of unitBtns) b.setAttribute('aria-pressed', b.dataset.unit === unit ? 'true' : 'false');
    for (const b of fracs) b.hidden = unit === 'cm';
    ftKey.hidden = unit !== 'ft';
    const v = padValue(text, unit);
    show.title = v != null ? `${v.toFixed(2)} in` : '';
  }
  function end(how) {
    if (closed) return;
    const v = padValue(text, unit);
    if (how === 'cancel') { close(); opts.onCancel && opts.onCancel(); return; }
    if (how === 'back') { if (opts.inline) { opts.onBack(v); return; } close(); opts.onBack(v); return; }
    if (how === 'next') { if (opts.inline) { opts.onNext(v, text, unit); return; } close(); opts.onNext(v, text, unit); return; }
    if (!opts.inline) close();
    opts.onDone && opts.onDone(v, text, unit);
  }
  // a hardware keyboard types on the same pad
  const onKey = (e) => {
    if (closed || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!opts.inline && !root.isConnected) return;
    if (opts.inline && root.closest('[hidden]')) return;
    const k = e.key;
    let used = true;
    if (/^\d$/.test(k) || k === '.') press(k);
    else if (k === ',') press('.');
    else if (k === 'Backspace') press('⌫');
    else if (k === "'" || k === '’') press("'");
    else if (k === 'Enter') { if (next && !e.shiftKey) end('next'); else end('done'); }
    else if (k === 'Tab') { if (e.shiftKey && back) end('back'); else if (next) end('next'); else end('done'); }
    else if (k === 'Escape') end('cancel');
    else if (k === 'c' && units.includes('cm')) setUnit('cm');
    else if (k === 'i' && units.includes('in')) setUnit('in');
    else if (k === 'f' && units.includes('ft')) setUnit('ft');
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  };
  document.addEventListener('keydown', onKey, true);
  function close() { if (closed) return; closed = true; document.removeEventListener('keydown', onKey, true); if (!opts.inline) root.remove(); }
  draw();
  if (opts.inline) opts.inline.append(root);
  else { (opts.host || document.body).append(root); if (opts.place) opts.place(root); }
  return {
    el: root, close, value: () => padValue(text, unit), unit: () => unit,
    set(inches, t2) { text = padStart(inches, unit); fresh = true; if (t2 != null) title.textContent = t2; draw(); },
  };
}
