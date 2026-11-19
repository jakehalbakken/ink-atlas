// Blend and colour: one tattoo's blend mode (Multiply, Screen, Overlay, Colour burn...) and its
// colour adjustments (hue, saturation, brightness, contrast, recolour, invert), seen live on the
// body. A panel at the left so the body stays in view; the Layers panel sits at the right.
// The caller owns history: live(fn) changes the tattoo for the screen (one undo step from the
// first change), done() closes that step. Nothing here touches the artwork itself.
import { BLEND_GROUPS, blendOf, blendName, blendLetter, adjustOf, cleanAdjust, ADJUST_DEFAULT, DEFAULT_BLEND } from './ink-look.js';

export const MODE_TIPS = {
  multiply: 'Darkens the skin like real ink. White paper drops out.',
  normal: 'Lays the colour over the skin, so white and light ink show.',
  darken: 'Keeps whichever is darker, the skin or the ink.',
  colorBurn: 'Deep, rich darks with more bite than Multiply.',
  linearBurn: 'Darker still, for heavy black work.',
  screen: 'Lightens the skin. Black drops out and light ink glows.',
  lighten: 'Keeps whichever is lighter, the skin or the ink.',
  colorDodge: 'Bright, punchy highlights.',
  add: 'Adds the ink to the skin for the brightest light.',
  overlay: 'Darks darken and lights lighten, with the skin showing through.',
  softLight: 'A gentle Overlay, like colour seen through the skin.',
  hardLight: 'A strong Overlay led by the ink.',
  difference: 'Shows the difference between skin and ink, for effects.',
  exclusion: 'A softer Difference.',
  subtract: 'Takes the ink away from the skin.',
  hue: 'Gives the skin the ink’s hue and keeps its light and shade.',
  saturation: 'Gives the skin the ink’s strength of colour.',
  color: 'Tints the skin with the ink’s colour, keeping its light and shade.',
  luminosity: 'Keeps the skin’s colour with the ink’s light and dark.',
};
const SLIDERS = [['hue', 'Hue', -180, 180, '°'], ['sat', 'Saturation', -100, 100, ''], ['light', 'Brightness', -100, 100, ''], ['contrast', 'Contrast', -100, 100, '']];
const SWATCHES = ['#b0413e', '#c9822b', '#d8b23c', '#3f7d4e', '#2f6c8f', '#4b3f8f', '#8a3f78', '#ffffff', '#1d1b1a'];

const CSS = `#inkLook{position:fixed;z-index:5;left:calc(12px + env(safe-area-inset-left,0px));top:var(--below,64px);width:340px;max-width:calc(100vw - 24px);display:flex;flex-direction:column;color:var(--text);font:500 15px/1.3 var(--body);border-radius:20px;overflow:hidden;box-sizing:border-box;overscroll-behavior:contain}
#inkLook *{box-sizing:border-box}#inkLook[hidden]{display:none!important}
#inkLook button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
#inkLook .lk-head{display:flex;align-items:center;gap:8px;padding:10px 10px 8px 16px;min-height:60px;border-bottom:1px solid var(--line)}
#inkLook .lk-title{flex:1;min-width:0}#inkLook .lk-title h2{margin:0;font:700 17px/1.2 var(--body);letter-spacing:-.01em}#inkLook .lk-title small{display:block;color:var(--muted);font-size:13px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#inkLook .lk-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:4px 14px 16px}
#inkLook h3{margin:16px 2px 8px;color:var(--muted);font:650 11.5px/1.2 var(--body);letter-spacing:.06em;text-transform:uppercase}
#inkLook .lk-gname{margin:10px 2px 6px;color:var(--muted);font-size:12.5px;font-weight:600}
#inkLook .lk-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
#inkLook .lk-mode{min-height:44px;padding:0 10px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;background:var(--fill);text-align:left;cursor:pointer;font-size:14.5px;font-weight:600}
#inkLook .lk-mode[aria-pressed=true]{background:var(--stencil-soft);border-color:var(--stencil)}
#inkLook .lk-mode i{font-style:normal;flex:none;min-width:26px;height:22px;padding:0 4px;border-radius:6px;background:var(--fill-strong,var(--fill));color:var(--muted);font:700 11px/22px var(--body);text-align:center}
#inkLook .lk-mode[aria-pressed=true] i{background:var(--stencil);color:var(--on-accent,#fff)}
#inkLook .lk-tip{margin:8px 2px 0;color:var(--muted);font-size:13px;min-height:2.6em}
#inkLook .lk-row{display:grid;grid-template-columns:96px minmax(0,1fr) 52px;align-items:center;gap:8px;min-height:48px}
#inkLook .lk-row label{font-weight:600;font-size:14.5px}#inkLook .lk-row output{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums;font-size:13.5px}
#inkLook .lk-swatches{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 4px 2px}
#inkLook .lk-sw{width:44px;height:44px;border-radius:50%;border:2px solid var(--line);padding:0;cursor:pointer;position:relative}
#inkLook .lk-sw[aria-pressed=true]{border-color:var(--stencil);box-shadow:0 0 0 3px var(--stencil-soft)}
#inkLook .lk-pick{width:44px;height:44px;border-radius:50%;border:2px dashed var(--line-strong,var(--line));overflow:hidden;position:relative;display:grid;place-items:center;color:var(--muted);font-size:22px}
#inkLook .lk-pick input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}
#inkLook .lk-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:0 2px;font-weight:600;font-size:14.5px;cursor:pointer}
#inkLook .lk-switch input{appearance:none;-webkit-appearance:none;width:51px;height:31px;border-radius:16px;background:var(--fill-strong,var(--line));position:relative;margin:0;cursor:pointer;flex:none;transition:background .2s}
#inkLook .lk-switch input::after{content:"";position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}
#inkLook .lk-switch input:checked{background:var(--stencil)}#inkLook .lk-switch input:checked::after{transform:translateX(20px)}
#inkLook .lk-foot{display:flex;gap:8px;margin-top:14px}#inkLook .lk-foot .btn{flex:1}
#inkLook .lk-note{margin:12px 2px 0;color:var(--muted);font-size:12.5px}
#inkLook .lk-locked{margin:10px 2px;padding:10px 12px;border-radius:12px;background:var(--fill);font-size:14px}
body.comment-only #inkLook{display:none!important}
body.hands-on #inkLook{opacity:.25;transition:opacity .12s ease}
@media (max-width:600px){#inkLook{left:0;right:0;top:auto;bottom:0;width:auto;max-width:none;max-height:62vh;border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom,0px)}}
@media (prefers-reduced-motion:no-preference){#inkLook:not([hidden]){animation:lk-in .22s cubic-bezier(.2,.9,.3,1)}@keyframes lk-in{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}}
@media (prefers-reduced-motion:no-preference) and (max-width:600px){@keyframes lk-in{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}}`;

// Options: get() the tattoo being changed (or null), live(fn) change it now, done() end the
// undo step, onClose(), onUse(kind) when a blend ('blend') or colour ('colour') is first changed.
export function createInkLook(o) {
  if (!document.getElementById('lk-css')) { const s = document.createElement('style'); s.id = 'lk-css'; s.textContent = CSS; document.head.append(s); }
  const host = document.createElement('aside'); host.id = 'inkLook'; host.className = 'glass'; host.hidden = true;
  host.setAttribute('role', 'dialog'); host.setAttribute('aria-label', 'Blend and colour');
  host.innerHTML = `<div class="lk-head"><div class="lk-title"><h2>Blend and colour</h2><small id="lkName"></small></div><button class="btn primary" id="lkDone" type="button">Done</button></div>
<div class="lk-body" data-scroll><div id="lkLocked" class="lk-locked" hidden>This tattoo is locked. Unlock it to change how its ink looks.</div>
<h3>Blend mode</h3><div id="lkModes"></div><p class="lk-tip" id="lkTip"></p>
<div class="lk-row"><label for="lkStrength">Ink strength</label><ink-slider id="lkStrength" min="15" max="100" default="92" aria-label="Ink strength"></ink-slider><output id="lkStrengthV"></output></div>
<h3>Adjust colour</h3><div id="lkSliders"></div>
<div class="lk-row"><label for="lkTintAmt">Recolour</label><ink-slider id="lkTintAmt" min="0" max="100" default="0" aria-label="Recolour amount"></ink-slider><output id="lkTintAmtV"></output></div>
<div class="lk-swatches" id="lkSwatches" role="group" aria-label="Recolour with"></div>
<label class="lk-switch">Invert colours<input type="checkbox" id="lkInvert" role="switch"></label><p class="lk-note" id="lkWhite" hidden>Multiply leaves white ink out, the way white paper drops away. To see light ink on the skin, pick Normal or Screen.</p>
<div class="lk-foot"><button class="btn" id="lkReset" type="button">Reset colours</button><button class="btn" id="lkResetAll" type="button">Back to Multiply</button></div>
<p class="lk-note">Only changes how the ink looks here and in what you share. Your artwork stays as it is.</p></div>`;
  (document.querySelector('#viewport') || document.body).append(host);
  const $ = (s) => host.querySelector(s);
  // blend modes, grouped like Procreate's list
  const modes = $('#lkModes');
  for (const g of BLEND_GROUPS) {
    const name = document.createElement('p'); name.className = 'lk-gname'; name.textContent = g.name;
    const grid = document.createElement('div'); grid.className = 'lk-modes'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', g.name);
    for (const [id, label] of g.modes) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lk-mode'; b.dataset.blend = id; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<i aria-hidden="true"></i><span></span>`; b.querySelector('i').textContent = blendLetter(id); b.querySelector('span').textContent = label;
      b.addEventListener('click', () => { const t = o.get(); if (!t || t.locked) return; o.live((x) => { if (id === DEFAULT_BLEND) delete x.blend; else x.blend = id; }); o.done(); o.onUse?.('blend'); render(); });
      grid.append(b);
    }
    modes.append(name, grid);
  }
  // the colour sliders
  const sliders = $('#lkSliders');
  for (const [key, label, min, max, unit] of SLIDERS) {
    const row = document.createElement('div'); row.className = 'lk-row';
    row.innerHTML = `<label for="lk-${key}"></label><ink-slider id="lk-${key}" min="${min}" max="${max}" default="0" aria-label="${label}"></ink-slider><output></output>`;
    row.querySelector('label').textContent = label; row.dataset.key = key; row.dataset.unit = unit; sliders.append(row);
  }
  const setAdjust = (fn) => o.live((x) => { const a = adjustOf(x); fn(a); const c = cleanAdjust(a); if (c) x.adjust = c; else delete x.adjust; });
  const slide = (el, fn, kind) => {
    el.addEventListener('input', () => { const t = o.get(); if (!t || t.locked) { render(); return; } fn(+el.value); showValues(); });
    el.addEventListener('change', () => { o.done(); o.onUse?.(kind); render(); });
  };
  for (const row of sliders.children) { const k = row.dataset.key; slide(row.querySelector('ink-slider'), (v) => setAdjust((a) => { a[k] = v; }), 'colour'); }
  slide($('#lkTintAmt'), (v) => setAdjust((a) => { a.tintAmt = v; }), 'colour');
  slide($('#lkStrength'), (v) => o.live((x) => { x.opacity = v / 100; }), 'strength');
  const sw = $('#lkSwatches');
  for (const hex of SWATCHES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lk-sw'; b.dataset.hex = hex; b.style.background = hex; b.setAttribute('aria-label', `Recolour with ${hex === '#ffffff' ? 'white' : hex === '#1d1b1a' ? 'black' : 'this colour'}`);
    b.addEventListener('click', () => pickTint(hex)); sw.append(b);
  }
  const pick = document.createElement('label'); pick.className = 'lk-pick'; pick.title = 'Any colour'; pick.innerHTML = '+<input type="color" id="lkTintAny" aria-label="Recolour with any colour">'; sw.append(pick);
  const any = pick.querySelector('input');
  any.addEventListener('input', () => { const t = o.get(); if (!t || t.locked) return; setAdjust((a) => { a.tint = any.value; if (!a.tintAmt) a.tintAmt = 100; }); showValues(); });
  any.addEventListener('change', () => { o.done(); o.onUse?.('colour'); render(); });
  function pickTint(hex) { const t = o.get(); if (!t || t.locked) return; setAdjust((a) => { a.tint = hex; if (!a.tintAmt) a.tintAmt = 100; }); o.done(); o.onUse?.('colour'); render(); }
  $('#lkInvert').addEventListener('change', (e) => { const t = o.get(); if (!t || t.locked) { render(); return; } setAdjust((a) => { a.invert = e.target.checked; }); o.done(); o.onUse?.('colour'); render(); });
  $('#lkReset').addEventListener('click', () => { const t = o.get(); if (!t || t.locked || !t.adjust) return; o.live((x) => { delete x.adjust; }); o.done(); render(); });
  $('#lkResetAll').addEventListener('click', () => { const t = o.get(); if (!t || t.locked || !t.blend) return; o.live((x) => { delete x.blend; }); o.done(); render(); });
  $('#lkDone').addEventListener('click', () => close());
  host.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  host.addEventListener('pointerdown', (e) => e.stopPropagation());

  function showValues() {
    const t = o.get(); if (!t) return; const a = adjustOf(t);
    for (const row of sliders.children) { const v = a[row.dataset.key]; row.querySelector('output').textContent = (v > 0 ? '+' : '') + v + row.dataset.unit; }
    $('#lkTintAmtV').textContent = a.tintAmt + '%';
    $('#lkStrengthV').textContent = Math.round((t.opacity ?? 0.92) * 100) + '%';
  }
  function render() {
    if (host.hidden) return;
    const t = o.get(); if (!t) { close(); return; }
    const a = adjustOf(t), mode = blendOf(t), locked = !!t.locked;
    $('#lkName').textContent = t.name || 'Tattoo';
    $('#lkLocked').hidden = !locked; host.classList.toggle('locked', locked);
    for (const b of modes.querySelectorAll('.lk-mode')) { b.setAttribute('aria-pressed', String(b.dataset.blend === mode)); b.disabled = locked; }
    $('#lkTip').textContent = `${blendName(mode)}: ${MODE_TIPS[mode] || ''}`;
    for (const row of sliders.children) { const s = row.querySelector('ink-slider'); s.value = a[row.dataset.key]; s.toggleAttribute('aria-disabled', locked); }
    $('#lkTintAmt').value = a.tintAmt; $('#lkStrength').value = Math.round((t.opacity ?? 0.92) * 100);
    for (const b of sw.querySelectorAll('.lk-sw')) b.setAttribute('aria-pressed', String(a.tintAmt > 0 && b.dataset.hex === a.tint));
    any.value = a.tint || ADJUST_DEFAULT.tint;
    $('#lkInvert').checked = !!a.invert; $('#lkInvert').disabled = locked;
    $('#lkWhite').hidden = !(a.invert || a.light > 40) || !['multiply', 'darken', 'colorBurn', 'linearBurn'].includes(mode);
    $('#lkReset').disabled = locked || !t.adjust; $('#lkResetAll').disabled = locked || !t.blend;
    showValues(); fit();
  }
  // stop above the edit sheet when there is room, so both stay readable
  function fit() {
    host.style.bottom = '';
    if (innerWidth <= 600) return;
    const sheet = document.getElementById('sheet'), r = sheet && sheet.getClientRects().length && !sheet.hidden ? sheet.getBoundingClientRect() : null;
    const top = host.getBoundingClientRect().top;
    const under = r && r.left < 12 + 340 && r.right > 12 && r.top > top + 320 ? innerHeight - r.top + 8 : 16;
    host.style.bottom = `calc(${under}px + env(safe-area-inset-bottom,0px))`;
  }
  function open() { host.hidden = false; render(); $('#lkDone').focus({ preventScroll: true }); }
  function close() { if (host.hidden) return; o.done(); host.hidden = true; o.onClose?.(); }
  addEventListener('resize', () => { if (!host.hidden) fit(); });
  return { open, close, render, isOpen: () => !host.hidden, el: host };
}
