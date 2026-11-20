// Measure me: one tape measurement a screen, each with a small drawing of exactly where the tape
// goes, a big number on our own number pad (num-pad.js, so the iPad keyboard never comes up),
// Back, Skip and Next. At the end the body is fitted to every number in one go and each one is
// shown as what you measured against what the model now measures, so you can see it is right.
// The sliders stay for small tweaks.
//
// measureSteps and measureDiagram are pure (unit tested); createMeasureMe builds the screens.
import { MEASURES } from './body-measure.js';
import { openPad } from './num-pad.js';

const M = Object.fromEntries(MEASURES.map((m) => [m.key, m]));
// the order a person measures themselves in: height, then top to bottom round, then the lengths
const ROUND = ['neckSize', 'shoulders', 'chest', 'waist', 'hips', 'upperArmSize', 'foreArmSize', 'wristSize', 'thighSize', 'calfSize', 'ankleSize'];
const LENGTHS = ['upperArmLen', 'foreArmLen', 'torsoLen', 'thighLen', 'shinLen'];
const TIPS = {
  height: 'Stand against a wall in bare feet, heels touching it. Mark the top of your head and measure from the floor.',
  neckSize: 'Round the middle of the neck, under the Adam\'s apple, a finger under the tape.',
  shoulders: 'Across the back, from the outside edge of one shoulder to the other. Easiest with someone helping.',
  chest: 'Round the fullest part, under the arms and across the shoulder blades. Breathe out normally.',
  waist: 'Round the narrowest part, between the ribs and the navel. Relaxed, not sucked in.',
  hips: 'Round the widest part of the hips and seat, feet together.',
  upperArmSize: 'Round the biggest part of the upper arm, halfway between shoulder and elbow, arm hanging relaxed.',
  foreArmSize: 'Round the biggest part of the forearm, about two fingers below the elbow crease, hand open.',
  wristSize: 'Round the wrist just above the wrist bone, towards the hand.',
  thighSize: 'Round the top of the thigh, just under the seat, standing with weight on both feet.',
  calfSize: 'Round the biggest part of the calf, standing.',
  ankleSize: 'Round the narrowest part of the leg, just above the ankle bone.',
  upperArmLen: 'From the point of the shoulder down to the point of the elbow, arm hanging.',
  foreArmLen: 'From the point of the elbow to the wrist bone, along the outside of the arm.',
  torsoLen: 'From the bump at the base of the back of the neck down to the level of the navel.',
  thighLen: 'From the crotch down the inside of the leg to the middle of the knee.',
  shinLen: 'From the middle of the knee down to the ankle bone.',
};

// The screens in order, for the sliders this body shows (visible(key) true). Lengths come last,
// marked optional. Height is always first.
export function measureSteps(visible = () => true) {
  const steps = [{ key: 'height', label: 'Height', kind: 'height', tip: TIPS.height }];
  for (const k of ROUND) if (M[k] && visible(k)) steps.push({ key: k, label: M[k].label, kind: M[k].kind, tip: TIPS[k] || `Tape ${M[k].how}.` });
  for (const k of LENGTHS) if (M[k] && visible(k)) steps.push({ key: k, label: M[k].label, kind: 'length', tip: TIPS[k] || `Tape ${M[k].how}.`, optional: true });
  return steps;
}

// A small front view of a body with the tape drawn where it goes: a ring round the part, or a
// line with end marks along it. Colours come from the app's variables through classes.
const BAND = {
  neckSize: [100, 72, 11, 3.5, 0], chest: [100, 122, 50, 6, 0], waist: [100, 176, 38, 5, 0], hips: [100, 214, 45, 6, 0],
  upperArmSize: [51, 130, 12, 4, -14], foreArmSize: [44, 190, 10, 3.5, -4], wristSize: [41, 233, 7, 2.6, -3],
  thighSize: [82, 250, 19, 5, 4], calfSize: [77, 340, 13, 4, 0], ankleSize: [78, 386, 8.5, 3, 0],
};
const LINE = {
  shoulders: [[57, 86], [143, 86]], upperArmLen: [[58, 92], [45, 166]], foreArmLen: [[44, 172], [40, 236]],
  torsoLen: [[112, 78], [112, 182]], thighLen: [[90, 238], [80, 318]], shinLen: [[85, 324], [84, 390]], height: [[176, 12], [176, 406]],
};
export function measureDiagram(key) {
  const limb = (pts, w) => `<path class="md-limb" d="M${pts.map((p) => p.join(' ')).join(' L')}" stroke-width="${w}"/>`;
  const sides = (f) => [f(1), f(-1)].join('');
  const mx = (x, s) => (s > 0 ? x : 200 - x);
  let s = '<svg class="mdiag" viewBox="0 0 200 420" role="img" aria-hidden="true">';
  s += sides((d) => limb([[mx(64, d), 92], [mx(51, d), 132], [mx(44, d), 172]], 21) + limb([[mx(44, d), 172], [mx(40, d), 236]], 15) + `<ellipse class="md-body" cx="${mx(39, d)}" cy="250" rx="8" ry="13"/>`);
  s += sides((d) => limb([[mx(82, d), 228], [mx(80, d), 280], [mx(77, d), 322]], 33) + limb([[mx(77, d), 322], [mx(77, d), 360], [mx(78, d), 392]], 21) + `<ellipse class="md-body" cx="${mx(80, d)}" cy="404" rx="12" ry="6"/>`);
  s += '<path class="md-body" d="M60 84 Q100 76 140 84 Q150 98 148 124 Q144 150 138 176 Q146 196 145 214 Q143 236 120 240 L100 244 L80 240 Q57 236 55 214 Q54 196 62 176 Q56 150 52 124 Q50 98 60 84 Z"/>';
  s += '<rect class="md-body" x="91" y="58" width="18" height="26" rx="6"/><circle class="md-body" cx="100" cy="38" r="24"/>';
  if (BAND[key]) {
    const [cx, cy, rx, ry, rot] = BAND[key];
    s += `<g transform="rotate(${rot} ${cx} ${cy})"><path class="md-tape back" d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}"/><path class="md-tape" d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}"/></g>`;
  } else if (LINE[key]) {
    const [[x1, y1], [x2, y2]] = LINE[key], dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 6, ny = dx / l * 6;
    s += `<path class="md-tape" d="M${x1} ${y1} L${x2} ${y2} M${x1 - nx} ${y1 - ny} L${x1 + nx} ${y1 + ny} M${x2 - nx} ${y2 - ny} L${x2 + nx} ${y2 + ny}"/>`;
  }
  return s + '</svg>';
}

// one decimal, or two for a quarter inch someone typed (6.75), so it reads back as typed
const fmt = (v) => (v == null ? "–" : `${Math.abs(v * 4 - Math.round(v * 4)) < 0.001 && Math.abs(v * 10 - Math.round(v * 10)) > 0.01 ? (+v).toFixed(2) : (+v).toFixed(1)} in`);
const ftText = (inches) => { if (!(inches > 0)) return '–'; let f = Math.floor(inches / 12), i = Math.round((inches - f * 12) * 2) / 2; if (i >= 12) { f++; i = 0; } return `${f}′ ${i}″`; };

// host: an element (the modal body) to build in. o: { steps, values (key -> inches, typed before),
// read(key) -> what the model measures now, in inches, fit(values) -> Promise of rows
// [{ key, label, target, got, reached, lo, hi }], onClose(), toast }.
export function createMeasureMe(host, o) {
  const values = { ...(o.values || {}) };
  let i = 0, pad = null, results = null;
  const h = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const wrap = h('div', 'mm'); host.append(wrap);
  function step() {
    if (pad) { pad.close(); pad = null; }
    results = null; wrap.replaceChildren(); wrap.dataset.step = String(i);
    const st = o.steps[i], left = h('div', 'mm-left'), right = h('div', 'mm-right');
    const count = h('div', 'mm-count', `${i + 1} of ${o.steps.length}${st.optional ? ', optional' : ''}`);
    const bar = h('div', 'mm-bar'); const fill = h('i'); fill.style.width = `${Math.round((i + 1) / o.steps.length * 100)}%`; bar.append(fill);
    const fig = h('div', 'mm-fig'); fig.innerHTML = measureDiagram(st.key);
    const name = h('h3', 'mm-name', st.label); name.id = 'mmName';
    const tip = h('p', 'mm-tip', st.tip);
    const now = o.read(st.key);
    const model = h('p', 'mm-model', now != null ? `The model now measures ${st.kind === 'height' ? ftText(now) : fmt(now)}.` : '');
    left.append(fig);
    right.append(count, bar, name, tip);
    const padHost = h('div', 'mm-pad'); right.append(padHost, model);
    wrap.append(left, right);
    const last = i === o.steps.length - 1;
    pad = openPad({
      inline: padHost, title: '', units: st.kind === 'height' ? ['ft', 'cm'] : ['in', 'cm'],
      inches: values[st.key], cancelLabel: 'Skip', doneLabel: last ? 'Fit my body' : 'Next',
      onBack: i > 0 ? (v) => { keep(st, v); i--; step(); } : null,
      onCancel: () => go(), // Skip leaves this one as it was; clear it and tap Next to drop it
      onDone: (v) => { if (!keep(st, v, true)) return; go(); },
    });
    pad.el.querySelector('.np-cancel').hidden = false;
  }
  function keep(st, v, strict) {
    if (v == null) { if (strict) delete values[st.key]; return true; }
    const ok = st.kind === 'height' ? v >= 47 && v <= 91 : v > 1 && v < 80;
    if (!ok) { if (strict) o.toast && o.toast(st.kind === 'height' ? 'Type your height, like 5′ 10″ or 178 cm.' : `That doesn't look like a ${st.label.toLowerCase()} measurement. Type it in inches, or switch to cm.`); return !strict; }
    values[st.key] = Math.round(v * 100) / 100; return true;
  }
  function go() { if (i < o.steps.length - 1) { i++; step(); } else finish(); }
  async function finish() {
    if (pad) { pad.close(); pad = null; }
    if (!Object.keys(values).length) { o.toast && o.toast('Type at least one measurement, or tap Back.'); i = 0; step(); return; }
    wrap.replaceChildren(h('p', 'mm-tip mm-busy', 'Fitting the body to your numbers…')); wrap.dataset.step = 'busy';
    await new Promise((r) => setTimeout(r, 30));
    let rows;
    try { rows = await o.fit({ ...values }); } catch (_) { rows = null; }
    if (!rows) { o.toast && o.toast('The body could not be fitted to those numbers.'); i = o.steps.length - 1; step(); return; }
    results = rows; showResults(rows);
  }
  function showResults(rows) {
    wrap.replaceChildren(); wrap.dataset.step = 'done';
    const good = rows.filter((r) => r.reached).length;
    const box = h('div', 'mm-done');
    box.append(h('h3', 'mm-name', good === rows.length ? 'Your body matches every measurement' : `${good} of ${rows.length} match`));
    box.append(h('p', 'mm-tip', 'What you measured beside what the model now measures. The sliders under Fine-tune are still there for small changes.'));
    const tbl = h('div', 'mm-table'); tbl.setAttribute('role', 'table');
    const head = h('div', 'mm-row mm-th'); head.setAttribute('role', 'row'); for (const t of ['', 'You', 'Model', '']) head.append(h('span', '', t)); tbl.append(head);
    for (const r of rows) {
      const row = h('div', `mm-row${r.reached ? ' ok' : ' off'}`); row.setAttribute('role', 'row'); row.dataset.key = r.key;
      const show = (v) => (r.key === 'height' ? ftText(v) : fmt(v));
      const note = r.reached ? '✓' : `${r.got < r.target ? 'goes up to' : 'goes down to'} ${show(r.got < r.target ? r.hi : r.lo)}`;
      row.append(h('span', 'mm-l', r.label), h('span', '', show(r.target)), h('span', '', show(r.got)), h('span', 'mm-n', note));
      tbl.append(row);
    }
    box.append(tbl);
    const off = rows.filter((r) => !r.reached);
    if (off.length) box.append(h('p', 'mm-tip', `${off.map((r) => r.label).join(', ')} ${off.length === 1 ? 'is' : 'are'} past what the body's shape can reach with the other numbers. More Muscle or Weight makes everything rounder; check the tape went where the drawing shows.`));
    const foot = h('div', 'mm-foot');
    const back = h('button', 'btn', 'Change a number'); back.type = 'button'; back.addEventListener('click', () => { i = 0; step(); });
    const done = h('button', 'btn primary', 'Done'); done.type = 'button'; done.id = 'mmDone'; done.addEventListener('click', () => o.onClose && o.onClose(true));
    foot.append(back, done); box.append(foot); wrap.append(box);
  }
  step();
  return { close() { if (pad) { pad.close(); pad = null; } wrap.remove(); }, values: () => ({ ...values }), results: () => results, at: () => i };
}
