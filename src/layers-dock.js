// The Layers panel docked at the right, like Photoshop's: a slim rail when folded away, the full
// height of the screen when open. A line per tattoo (picture, name, an eye, a ⋯ with Move earlier,
// Move later, Lock and Take out of group), groups as folders with their own eye, and two quick
// switches at the top, Hide planned and Hide existing, that only change what this screen shows.
// Open or folded is kept per device (localStorage ia-layers-dock), never in the project.
// The caller owns history, persistence and decal regeneration: change(fn) wraps one undo step.
import { reorderTattoo, changeSelected } from './layers.js';

export const DOCK_KEY = 'ia-layers-dock';
export const kindOf = (t) => (t && t.status === 'existing' ? 'existing' : 'planned');
// what the quick switches leave on screen (pure, for tests)
export function kindShown(t, off) { return !off || !off[kindOf(t)]; }
// one tap on a group's eye: hide all of them while any shows, otherwise show all of them
export function groupEye(state, groupId) {
  const members = state.tattoos.filter((t) => t.group === groupId); if (!members.length) return false;
  const hide = members.some((t) => !t.hidden); changeSelected(state, members.map((t) => t.id), { hidden: hide }); return hide;
}
// the lines in the order the panel shows them: each group with its tattoos, then the rest
export function dockSections(state) {
  const groups = (state.groups || []).filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string');
  const known = new Set(groups.map((g) => g.id));
  const out = groups.map((g) => ({ group: g, items: state.tattoos.filter((t) => t.group === g.id) }));
  const rest = state.tattoos.filter((t) => !t.group || !known.has(t.group));
  if (rest.length || !out.length) out.push({ group: null, items: rest });
  return out;
}

const svg = (body, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const EYE = svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>');
const EYE_OFF = svg('<path d="M4 4l16 16M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.3 7.6C3.9 9.3 2.5 12 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>');
const DOTS = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';
const STACK = svg('<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16 9 4.5 9-4.5"/>', 24);
const FOLD = svg('<path d="m9 5 7 7-7 7"/>', 22);
const CHEV = svg('<path d="m9 6 6 6-6 6"/>', 18);
const FOLDER = svg('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>', 22);

const CSS = `#layersDock{position:fixed;z-index:2;right:calc(12px + env(safe-area-inset-right,0px));top:var(--below,64px);display:flex;flex-direction:column;color:var(--text);font:500 15px/1.3 var(--body);overscroll-behavior:contain;box-sizing:border-box;transition:opacity .25s ease}
#layersDock *{box-sizing:border-box}#layersDock svg{flex:none}#layersDock [hidden]{display:none!important}
#layersDock button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
#layersDock .ld-ib{width:44px;height:44px;min-width:44px;padding:0;display:grid;place-items:center;border:0;border-radius:var(--r-md,14px);background:transparent;color:var(--muted);cursor:pointer}
#layersDock .ld-ib:active{background:var(--fill)}#layersDock .ld-ib[aria-expanded=true]{background:var(--fill);color:var(--text)}
#layersDock.rail{width:60px;padding:8px;gap:4px;align-items:center;border-radius:20px}
#layersDock.rail .ld-title,#layersDock.rail .ld-list,#layersDock.rail .ld-foot,#layersDock.rail .ld-word{display:none!important}
#layersDock.rail .ld-head{flex-direction:column}
#layersDock.rail .ld-kinds{flex-direction:column;gap:4px;padding:6px 0 0;margin-top:2px;border-top:1px solid var(--line);width:100%;align-items:center}
#layersDock.rail .ld-kind{width:44px;min-height:52px;flex-direction:column;gap:1px;padding:4px 0;font-size:10.5px;font-weight:600}
#layersDock .ld-toggle{position:relative;color:var(--text)}#layersDock .ld-badge{position:absolute;right:1px;top:1px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--fill-strong,var(--fill));color:var(--text);font:700 11px/18px var(--body);text-align:center}
#layersDock.open{width:var(--ld-open-w,320px);bottom:calc(16px + var(--kb,0px) + env(safe-area-inset-bottom,0px));padding:0;gap:0;overflow:hidden}
#layersDock.open .ld-badge,#layersDock.open .ld-cap{display:none}
#layersDock .ld-head{display:flex;align-items:center;gap:4px}
#layersDock.open .ld-head{padding:8px 8px 6px 16px;min-height:60px}
#layersDock .ld-title{flex:1;min-width:0}#layersDock .ld-title h2{margin:0;font:700 17px/1.2 var(--body);letter-spacing:-.01em}#layersDock .ld-title small{display:block;color:var(--muted);font-size:13px;margin-top:1px}
#layersDock .ld-kinds{display:flex;gap:6px}
#layersDock.open .ld-kinds{padding:0 12px 10px;border-bottom:1px solid var(--line)}
#layersDock .ld-kind{flex:1;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 6px;border:1px solid var(--line);border-radius:var(--r-md,14px);background:var(--fill);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}
#layersDock .ld-kind[aria-pressed=true]{background:var(--stencil-soft);border-color:var(--stencil)}
#layersDock .ld-kind:disabled{opacity:.4;cursor:default}
#layersDock .ld-kind .ld-n{color:var(--muted);font-weight:500}
#layersDock .ld-list{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:6px 8px}
#layersDock .ld-sec+.ld-sec{margin-top:6px}
#layersDock .ld-ghead{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:4px;min-height:52px;padding:0 2px;border-radius:12px}
#layersDock .ld-ghead b{display:block;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#layersDock .ld-ghead small{display:block;color:var(--muted);font-size:12.5px}
#layersDock .ld-ghead .ld-fold svg{transition:transform .2s ease}#layersDock .ld-ghead .ld-fold[aria-expanded=true] svg{transform:rotate(90deg)}
#layersDock .ld-rest{margin:8px 8px 2px;color:var(--muted);font:650 11.5px/1.2 var(--body);letter-spacing:.06em;text-transform:uppercase}
#layersDock .ld-row{border-radius:12px}#layersDock .ld-in .ld-row{margin-left:14px}
#layersDock .ld-line{display:grid;grid-template-columns:minmax(0,1fr) 44px 44px;align-items:center;gap:2px;min-height:60px;padding:2px 2px 2px 4px}
#layersDock .ld-row.on{background:var(--stencil-soft)}
#layersDock .ld-pick{display:grid;grid-template-columns:48px minmax(0,1fr);align-items:center;gap:10px;min-height:56px;padding:0;border:0;background:none;text-align:left;cursor:pointer;min-width:0}
#layersDock .ld-thumb{width:48px;height:48px;border-radius:10px;background:var(--fill);overflow:hidden;display:grid;place-items:center;color:var(--muted)}#layersDock .ld-thumb.art{background:#f4f1ec}#layersDock .ld-thumb img{width:100%;height:100%;object-fit:contain}
#layersDock .ld-pick b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#layersDock .ld-pick small{display:block;color:var(--muted);font-size:12.5px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#layersDock .ld-row.dim .ld-thumb,#layersDock .ld-row.dim .ld-pick b{opacity:.42}
#layersDock .ld-eye.off{color:var(--faint,var(--muted));opacity:.7}
#layersDock .ld-acts{display:flex;flex-wrap:wrap;gap:6px;padding:0 8px 10px 62px}#layersDock .ld-acts .btn{min-height:44px;font-size:14px;padding:0 12px}
#layersDock .ld-empty{margin:12px 8px;color:var(--muted);font-size:14px}
#layersDock .ld-foot{padding:8px 12px 12px;border-top:1px solid var(--line);display:flex}#layersDock .ld-foot .btn{flex:1}
body.comment-only #layersDock .ld-eye,body.comment-only #layersDock .ld-more,body.comment-only #layersDock .ld-foot{display:none!important}
body.hands-on #layersDock{opacity:.08;transition:opacity .12s ease}
body.painting #layersDock,body:has(#wrapStudio:not([hidden])) #layersDock{display:none!important}
@media (max-width:600px){#layersDock.open{left:12px;width:auto;z-index:7}}
@media (prefers-reduced-motion:no-preference){#layersDock.open{animation:ld-in .22s cubic-bezier(.2,.9,.3,1)}@keyframes ld-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}}`;

// Options: getState, getImages, selectedId(), pick(id) (select it the way a tray chip does),
// change(fn) (one undo step), kinds (the {planned, existing} view switches, owned by the caller),
// onKinds(kind) after a switch, openSheet() for Layers and groups, onPaint() for Paint on skin,
// onLayout() whenever its width changes, onOpen(open).
export function createLayersDock(o) {
  if (!document.getElementById('ld-css')) { const s = document.createElement('style'); s.id = 'ld-css'; s.textContent = CSS; document.head.append(s); }
  let open = false; try { open = localStorage.getItem(DOCK_KEY) === 'open'; } catch { /* private mode: folded */ }
  let openMore = null, lastKey = '';
  const folded = new Set(); // groups folded shut on this screen only
  const host = document.createElement('aside'); host.id = 'layersDock'; host.className = 'glass'; host.setAttribute('aria-label', 'Layers');
  host.innerHTML = `<div class="ld-head"><div class="ld-title"><h2>Layers</h2><small id="ldCount"></small></div><button class="ld-ib ld-toggle" id="ldToggle" type="button"></button></div>
<div class="ld-kinds" id="ldKinds" role="group" aria-label="Quick hide"><button class="ld-kind" id="ldPlanned" type="button" data-kind="planned" aria-pressed="false"></button><button class="ld-kind" id="ldExisting" type="button" data-kind="existing" aria-pressed="false"></button></div>
<div class="ld-list" id="ldList" data-scroll></div>
<div class="ld-foot"><button class="btn" id="ldMore" type="button" aria-haspopup="dialog">Select several</button></div>`;
  (document.querySelector('#viewport') || document.body).append(host);
  const $ = (s) => host.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ib = (html, label, fn, cls = '') => { const b = el('button', 'ld-ib ' + cls); b.type = 'button'; b.innerHTML = html; b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b; };
  const btn = (text, fn) => { const b = el('button', 'btn', text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const wide = () => innerWidth > 600;
  function layout() {
    host.classList.toggle('open', open); host.classList.toggle('rail', !open);
    const w = open ? (wide() ? 320 : 0) : (wide() ? 60 : 0), shown = getComputedStyle(host).display !== 'none';
    document.documentElement.style.setProperty('--layers-w', (shown && w ? w + 12 : 0) + 'px');
    document.documentElement.style.setProperty('--ld-open-w', '320px');
    o.onLayout?.();
  }
  function setOpen(v, quiet) {
    open = !!v; try { localStorage.setItem(DOCK_KEY, open ? 'open' : 'rail'); } catch { /* private mode */ }
    lastKey = ''; render(); layout(); if (!quiet) o.onOpen?.(open);
  }
  $('#ldToggle').addEventListener('click', () => setOpen(!open));
  $('#ldMore').addEventListener('click', () => o.openSheet?.());
  for (const b of host.querySelectorAll('.ld-kind')) b.addEventListener('click', () => { const k = b.dataset.kind; o.kinds[k] = !o.kinds[k]; lastKey = ''; render(); o.onKinds?.(k); });
  function rowFor(t, state, images, selId, index) {
    const offByKind = !kindShown(t, o.kinds), row = el('div', 'ld-row' + (t.id === selId ? ' on' : '') + (t.hidden || offByKind ? ' dim' : '')), line = el('div', 'ld-line');
    row.dataset.id = t.id; row.setAttribute('role', 'listitem');
    const pick = el('button', 'ld-pick'); pick.type = 'button';
    const thumb = el('span', 'ld-thumb'); const src = images[t.img]; if (typeof src === 'string' && src) { thumb.classList.add('art'); const im = el('img'); im.src = src; im.alt = ''; thumb.append(im); }
    const bits = [t.status === 'existing' ? 'On me' : 'Planned']; if (t.locked && t.status !== 'existing') bits.push('Locked'); if (t.hidden) bits.push('Hidden'); else if (offByKind) bits.push('Off for now');
    const text = el('span'); text.append(el('b', '', t.name || 'Tattoo'), el('small', '', bits.join(' · ')));
    pick.append(thumb, text); pick.setAttribute('aria-label', `${t.name || 'Tattoo'}, ${bits.join(', ')}`); if (t.id === selId) pick.setAttribute('aria-current', 'true');
    pick.addEventListener('click', () => { if (offByKind) { o.kinds[kindOf(t)] = false; o.onKinds?.(kindOf(t)); } o.pick(t.id); });
    const eye = ib(t.hidden ? EYE_OFF : EYE, `${t.hidden ? 'Show' : 'Hide'} ${t.name || 'tattoo'}`, () => o.change((s) => changeSelected(s, [t.id], { hidden: !t.hidden })), 'ld-eye' + (t.hidden ? ' off' : ''));
    const more = ib(DOTS, `More for ${t.name || 'tattoo'}`, () => { openMore = openMore === t.id ? null : t.id; lastKey = ''; render(); }, 'ld-more'); more.setAttribute('aria-expanded', String(openMore === t.id));
    line.append(pick, eye, more); row.append(line);
    if (openMore === t.id) {
      const acts = el('div', 'ld-acts');
      const up = btn('Move earlier', () => o.change((s) => reorderTattoo(s, t.id, -1))); up.disabled = index === 0;
      const down = btn('Move later', () => o.change((s) => reorderTattoo(s, t.id, 1))); down.disabled = index === state.tattoos.length - 1;
      acts.append(up, down, btn(t.locked ? 'Unlock' : 'Lock', () => o.change((s) => changeSelected(s, [t.id], { locked: !t.locked }))));
      if (t.group) acts.append(btn('Take out of group', () => o.change((s) => { const x = s.tattoos.find((v) => v.id === t.id); if (x) delete x.group; })));
      row.append(acts);
    }
    return row;
  }
  function render() {
    const state = o.getState(), images = o.getImages() || {}, selId = o.selectedId(), k = o.kinds;
    const key = JSON.stringify([open, selId, k, openMore, [...folded], state.groups || [], state.paint ? !!state.paint.hidden : null,
      state.tattoos.map((t) => [t.id, t.name, t.hidden, t.status, t.locked, t.group, t.img, !!images[t.img]])]);
    if (key === lastKey) return; lastKey = key;
    const all = state.tattoos, planned = all.filter((t) => kindOf(t) === 'planned').length, existing = all.length - planned;
    $('#ldCount').textContent = all.length ? `${all.length} on the body` + (k.planned || k.existing ? ', some hidden' : '') : 'Nothing placed yet';
    const tg = $('#ldToggle'); tg.innerHTML = open ? FOLD : STACK + (all.length ? `<span class="ld-badge">${all.length}</span>` : '');
    tg.setAttribute('aria-label', open ? 'Fold the layers away' : `Show layers, ${all.length} ${all.length === 1 ? 'tattoo' : 'tattoos'}`); tg.setAttribute('aria-expanded', String(open)); tg.title = open ? 'Fold away' : 'Layers';
    for (const [b, kind, n, word] of [[$('#ldPlanned'), 'planned', planned, 'planned'], [$('#ldExisting'), 'existing', existing, 'existing']]) {
      const off = !!k[kind]; b.setAttribute('aria-pressed', String(off)); b.disabled = !n && !off;
      b.innerHTML = (off ? EYE_OFF : EYE) + `<span class="ld-word">${off ? 'Show' : 'Hide'} ${word}</span><span class="ld-cap">${word === 'planned' ? 'Planned' : 'Existing'}</span>` ;
      b.setAttribute('aria-label', `${off ? 'Show' : 'Hide'} ${word} tattoos, ${n}`); b.title = `${off ? 'Show' : 'Hide'} ${word}`;
    }
    const list = $('#ldList');
    if (!open) { list.replaceChildren(); return; }
    const keep = list.scrollTop; list.replaceChildren(); list.setAttribute('role', 'list');
    const index = new Map(all.map((t, i) => [t.id, i]));
    const sections = dockSections(state);
    for (const sec of sections) {
      const box = el('div', 'ld-sec' + (sec.group ? ' ld-in' : ''));
      if (sec.group) {
        const g = sec.group, shut = folded.has(g.id), head = el('div', 'ld-ghead'); head.dataset.group = g.id;
        const fold = ib(CHEV, `${shut ? 'Open' : 'Fold'} ${g.name}`, () => { if (folded.has(g.id)) folded.delete(g.id); else folded.add(g.id); lastKey = ''; render(); }, 'ld-fold'); fold.setAttribute('aria-expanded', String(!shut));
        const name = el('span'); name.append(el('b', '', g.name), el('small', '', sec.items.length ? `Group, ${sec.items.length} ${sec.items.length === 1 ? 'tattoo' : 'tattoos'}` : 'Empty group'));
        const anyShown = sec.items.some((t) => !t.hidden);
        const eye = ib(anyShown ? EYE : EYE_OFF, `${anyShown ? 'Hide' : 'Show'} the ${g.name} group`, () => o.change((s) => groupEye(s, g.id)), 'ld-eye' + (anyShown ? '' : ' off')); eye.disabled = !sec.items.length;
        head.prepend(fold); head.append(name, eye); box.append(head);
        if (!shut) for (const t of sec.items) box.append(rowFor(t, state, images, selId, index.get(t.id)));
      } else {
        if (sections.length > 1 && sec.items.length) box.append(el('p', 'ld-rest', 'Not in a group'));
        for (const t of sec.items) box.append(rowFor(t, state, images, selId, index.get(t.id)));
      }
      list.append(box);
    }
    if (state.paint) {
      const p = state.paint, row = el('div', 'ld-row' + (p.hidden ? ' dim' : '')), line = el('div', 'ld-line'), pick = el('button', 'ld-pick'); pick.type = 'button';
      const thumb = el('span', 'ld-thumb'); thumb.innerHTML = FOLDER; const text = el('span'); text.append(el('b', '', 'Paint on skin'), el('small', '', p.hidden ? 'From Procreate · Hidden' : 'From Procreate'));
      pick.append(thumb, text); pick.addEventListener('click', () => o.onPaint?.());
      const eye = ib(p.hidden ? EYE_OFF : EYE, `${p.hidden ? 'Show' : 'Hide'} paint on skin`, () => o.change((s) => { if (s.paint) s.paint.hidden = !s.paint.hidden; }), 'ld-eye' + (p.hidden ? ' off' : ''));
      line.append(pick, eye, el('span')); row.append(line); row.id = 'ldPaint'; list.append(row);
    }
    if (!all.length && !state.paint) list.append(el('p', 'ld-empty', 'Add a tattoo from the tray and it shows here as a layer.'));
    list.scrollTop = keep;
    $('#ldMore').hidden = !all.length;
  }
  addEventListener('resize', () => layout());
  render(); layout();
  return { render, layout, setOpen, isOpen: () => open, el: host };
}
