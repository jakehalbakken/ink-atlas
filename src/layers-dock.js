// The Layers panel docked at the right, like Photoshop's: a slim rail when folded away, the full
// height of the screen when open. A line per tattoo (picture, name, an eye, a ⋯ with Move earlier,
// Move later, Lock and Take out of group), groups as folders with their own eye, and two quick
// switches at the top, Hide planned and Hide existing, that only change what this screen shows.
// Open or folded is kept per device (localStorage ia-layers-dock), never in the project.
// Since 2026-11-19 (Jake: "there's two places now to access the existing tattoos, and it just
// needs to be in the layer panel") it is the only list of tattoos: Add tattoo and Procreate sit at
// its top, it opens by default on an iPad, and the edit panel stacks under it in the same column.
// The caller owns history, persistence and decal regeneration: change(fn) wraps one undo step.
// Since 2026-11-22 (Jake: "Look at the way procreate handles layers being able to swipe or duplicate
// and merge. I want the same") it takes Procreate's gestures: swipe a line left for Lock, Duplicate and
// Delete, swipe it right to pick it (a bar then offers Merge, Group and Delete for the picked ones),
// pinch lines together to merge them, press and hold to drag a line to a new place, and tap the
// selected line for its options (name, Duplicate, Merge down, Lock, Blend and colour, Zoom to it...).
import { reorderTattoo, changeSelected, assignGroup } from './layers.js';
import { SWIPE, swipeKind, pinchMerges, rangeBetween, displayOrder, lineBelow } from './layer-ops.js';
import { sortPlan, sortIntoAreas, soloFolder, unfolder, renameFolder } from './body-areas.js';
import { blendOf, blendLetter, blendName, hasLook, describeLook, DEFAULT_BLEND } from './ink-look.js';

export const DOCK_KEY = 'ia-layers-dock';
export const FOLDED_KEY = 'ia-ld-folded'; // folders folded shut, per device (never in the project)
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
const MERGE = svg('<path d="M6 4v4a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4"/><path d="M12 14v6.5"/><path d="m8.5 17 3.5 3.5 3.5-3.5"/>', 22);
const UNGROUP = svg('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="m9.5 11 5 5M14.5 11l-5 5"/>', 22);
const LOCK = svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>', 22);
const DUP = svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', 22);
const BIN = svg('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>', 22);
const TICK = svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 22);
const TICK_S = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const FOLDER = svg('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>', 22);

// On my skin and Planned marks, the same as the edit panel's switch
const ST_SKIN = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="m8 12.5 2.6 2.6L16.2 9.5" fill="none" stroke="var(--st-tick,var(--surface-solid))" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ST_PLAN = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5" stroke-dasharray="3.2 2.6"/></svg>';
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
#layersDock.open{width:var(--ld-open-w,340px);bottom:calc(16px + var(--kb,0px) + env(safe-area-inset-bottom,0px));padding:0;gap:0;overflow:hidden}
#layersDock.open.with-sheet{bottom:calc(24px + var(--kb,0px) + env(safe-area-inset-bottom,0px) + var(--sheet-h,0px))}
#layersDock.with-sheet .ld-foot{display:none!important}
#layersDock .ld-adds{display:flex;gap:4px}#layersDock.rail .ld-adds{flex-direction:column;padding-bottom:4px}
#layersDock .ld-adds .btn{width:44px;min-width:44px;height:44px;min-height:44px;padding:0;font-size:0;gap:0;justify-content:center;border-radius:var(--r-md,14px)}
#layersDock .ld-adds .btn::before{width:22px;height:22px;margin:0}
#layersDock .ld-adds .btn:not(.primary){background:var(--fill);border-color:transparent}
#layersDock .ld-tag{font-style:normal}#layersDock .ld-tag.rv-ok{color:var(--good,#5fd39a)}#layersDock .ld-tag.rv-chg{color:var(--warn,#ffb35c)}
#layersDock .ld-thumb{position:relative;overflow:visible}#layersDock .ld-thumb img{border-radius:10px}
#layersDock .ld-thumb b{position:absolute;min-width:18px;height:18px;padding:0 4px;border-radius:9px;font:700 11px/18px var(--body);text-align:center;box-shadow:0 0 0 2px var(--surface-solid,#222)}
#layersDock .ld-thumb b.cmts{right:-5px;top:-5px;background:var(--fill-strong,#555);color:var(--text)}#layersDock .ld-thumb b.cmts.new{background:#e5484d;color:#fff}
#layersDock .ld-thumb b.peer{left:-5px;bottom:-5px;background:var(--stencil,#8b7cff);color:#fff}
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
#layersDock .ld-ghead{display:grid;grid-template-columns:44px minmax(0,1fr) 44px 44px;align-items:center;gap:4px;min-height:52px;padding:0 2px;border-radius:12px}
#layersDock .ld-ghead b{display:block;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#layersDock .ld-ghead small{display:block;color:var(--muted);font-size:12.5px}
#layersDock .ld-gname{min-height:52px;min-width:0;padding:0;border:0;background:none;text-align:left;cursor:pointer}#layersDock .ld-ghead.area .ld-gname b::before{content:'';display:inline-block;width:8px;height:8px;border-radius:4px;background:var(--stencil);margin-right:7px;vertical-align:1px}
#layersDock .ld-gacts{display:flex;flex-wrap:wrap;gap:6px;padding:0 8px 10px 48px}#layersDock .ld-gacts .btn{min-height:44px;font-size:14px;padding:0 12px}#layersDock .ld-gacts .ld-name{flex:1 1 100%;min-height:44px;font:500 16px/1.2 var(--body);color:var(--text);background:var(--fill);border:1px solid var(--line);border-radius:var(--r-md,14px);padding:0 12px}
#layersDock .ld-ghead .ld-fold svg{transition:transform .2s ease}#layersDock .ld-ghead .ld-fold[aria-expanded=true] svg{transform:rotate(90deg)}
#layersDock .ld-rest{margin:8px 8px 2px;color:var(--muted);font:650 11.5px/1.2 var(--body);letter-spacing:.06em;text-transform:uppercase}
#layersDock .ld-row{border-radius:12px}#layersDock .ld-in .ld-row{margin-left:14px}
#layersDock .ld-line{display:grid;grid-template-columns:minmax(0,1fr) 44px 44px 44px;align-items:center;gap:2px;min-height:60px;padding:2px 2px 2px 4px}
#layersDock .ld-row.on{background:var(--stencil-soft)}
#layersDock .ld-pick{display:grid;grid-template-columns:48px minmax(0,1fr);align-items:center;gap:10px;min-height:56px;padding:0;border:0;background:none;text-align:left;cursor:pointer;min-width:0}
#layersDock .ld-thumb{width:48px;height:48px;border-radius:10px;background:var(--fill);overflow:hidden;display:grid;place-items:center;color:var(--muted)}#layersDock .ld-thumb.art{background:#f4f1ec}#layersDock .ld-thumb img{width:100%;height:100%;object-fit:contain}
#layersDock .ld-pick b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#layersDock .ld-pick small{display:block;color:var(--muted);font-size:12.5px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#layersDock .ld-row.dim .ld-thumb,#layersDock .ld-row.dim .ld-pick b{opacity:.42}
#layersDock .ld-mode{font:650 13px/1 var(--body);color:var(--text)}#layersDock .ld-mode span{min-width:28px;height:28px;padding:0 4px;border-radius:8px;border:1.5px solid var(--line);display:grid;place-items:center}#layersDock .ld-mode.set span{border-color:var(--stencil,var(--accent));color:var(--stencil,var(--accent))}
#layersDock .ld-eye.off{color:var(--faint,var(--muted));opacity:.7}
#layersDock .ld-acts{display:flex;flex-wrap:wrap;gap:6px;padding:0 8px 10px 62px}#layersDock .ld-acts .btn{min-height:44px;font-size:14px;padding:0 12px}
#layersDock .ld-empty{margin:12px 8px;color:var(--muted);font-size:14px}
#layersDock .ld-foot{padding:8px 12px 12px;border-top:1px solid var(--line);display:flex;gap:6px}#layersDock .ld-foot .btn{flex:1;min-width:0;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.comment-only #layersDock .ld-eye,body.comment-only #layersDock .ld-mode,body.comment-only #layersDock .ld-more,body.comment-only #layersDock .ld-gmore,body.comment-only #layersDock .ld-foot{display:none!important}
body.hands-on #layersDock{opacity:.08;transition:opacity .12s ease}
body.painting #layersDock,body:has(#wrapStudio:not([hidden])) #layersDock{display:none!important}
@media (max-width:699px){#layersDock.open{left:12px;width:auto;z-index:7}}
@media (prefers-reduced-motion:no-preference){#layersDock.open{animation:ld-in .22s cubic-bezier(.2,.9,.3,1)}@keyframes ld-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}}
.ld-st{display:inline-flex;align-items:center;gap:4px;vertical-align:-2px}.ld-st svg{flex:none}.ld-st.skin{color:var(--text)}
.ld-stseg{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:3px;border-radius:var(--r-md,14px);background:var(--fill);width:100%;box-sizing:border-box}
.ld-acts .ld-stseg .btn{min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;color:var(--muted);box-shadow:none;padding:0 6px;border-radius:calc(var(--r-md,14px) - 3px);font-weight:600}
.ld-acts .ld-stseg .btn[aria-pressed=true]{background:var(--stencil);color:var(--on-accent);--st-tick:var(--stencil)}
.ld-acts .ld-stseg svg{width:16px;height:16px}
#layersDock.rail .ld-cap{white-space:normal;line-height:1.1;text-align:center}
#layersDock .ld-row{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
#layersDock .ld-track{position:relative;border-radius:12px;overflow:hidden}
#layersDock .ld-line{position:relative;z-index:1;border-radius:12px;will-change:transform}
#layersDock .ld-track.ld-swiped .ld-line{background:var(--surface-solid)}#layersDock .ld-row.on .ld-track.ld-swiped .ld-line{background:linear-gradient(var(--stencil-soft),var(--stencil-soft)),var(--surface-solid)}
#layersDock .ld-swipe{position:absolute;z-index:0;top:0;right:0;bottom:0;display:flex}
#layersDock .ld-swipe button{width:72px;min-height:44px;border:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font:600 12.5px/1.1 var(--body);color:var(--on-accent,#fff);cursor:pointer;padding:0}
#layersDock .ld-swipe .sw-lock{background:var(--seg-on,#4b4e5a);color:var(--text)}#layersDock .ld-swipe .sw-dup{background:var(--stencil)}#layersDock .ld-swipe .sw-del{background:var(--danger-fill,var(--danger));color:var(--on-accent,#fff)}
#layersDock .ld-pickzone{position:absolute;z-index:0;top:0;left:0;bottom:0;width:96px;display:flex;align-items:center;padding-left:18px;background:var(--stencil-soft);color:var(--stencil)}
#layersDock .ld-row.picked .ld-track{box-shadow:inset 0 0 0 2px var(--stencil)}
#layersDock .ld-pk{position:absolute;left:-5px;top:-5px;width:20px;height:20px;border-radius:10px;background:var(--stencil);color:var(--on-accent);display:grid;place-items:center;box-shadow:0 0 0 2px var(--surface-solid,#222)}
#layersDock .ld-pickbar{position:sticky;top:-6px;z-index:3;margin:-6px -8px 6px;padding:8px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:var(--surface-solid);border-bottom:1px solid var(--line)}
#layersDock .ld-pickbar b{flex:1 1 100%;font-weight:650;padding:0 4px}#layersDock .ld-pickbar .btn{min-height:44px;font-size:14px;padding:0 12px}
#layersDock .ld-acts .ld-name{flex:1 1 100%;min-height:44px;font:500 16px/1.2 var(--body);color:var(--text);background:var(--fill);border:1px solid var(--line);border-radius:var(--r-md,14px);padding:0 12px}
#layersDock .ld-row.ld-drag{position:relative;z-index:5;box-shadow:0 10px 30px rgba(0,0,0,.35);background:var(--surface-solid);opacity:.96}
#layersDock .ld-row.ld-pinch .ld-track{box-shadow:inset 0 0 0 2px var(--stencil)}
#layersDock .ld-drop{position:absolute;left:12px;right:12px;height:3px;border-radius:2px;background:var(--stencil);pointer-events:none;z-index:4}
#layersDock .ld-hint{position:absolute;left:50%;top:132px;transform:translateX(-50%);z-index:6;padding:8px 14px;border-radius:999px;background:var(--stencil);color:var(--on-accent);font:600 14px/1.2 var(--body);pointer-events:none;white-space:nowrap}
#layersDock.open .ld-list{position:relative}
body.comment-only #layersDock .ld-swipe,body.comment-only #layersDock .ld-pickbar,body.comment-only #layersDock #ldSelect{display:none!important}
#layersDock.open .ld-kinds{display:none}#layersDock.rail .ld-view{display:none}
#layersDock .ld-view{display:flex;margin:0 12px 10px;padding:2px;gap:2px;border-radius:var(--r-md,14px);background:var(--fill)}
#layersDock .ld-view button{flex:1;min-height:44px;min-width:44px;border:0;border-radius:calc(var(--r-md,14px) - 2px);background:transparent;color:var(--text);font:600 14px/1.1 var(--body);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 6px;white-space:nowrap}
#layersDock .ld-view button[aria-pressed=true]{background:var(--seg-on,var(--surface-solid));box-shadow:0 1px 4px rgba(0,0,0,.25)}
#layersDock .ld-view .ld-n{color:var(--muted);font-weight:500}
#layersDock .ld-view-note{margin:-4px 14px 8px;font-size:13px;color:var(--muted)}
#layersDock .ld-pk.off{background:transparent;border:2px solid var(--muted);box-shadow:0 0 0 2px var(--surface-solid,#222)}
#layersDock .ld-pickbar .ld-pbhead{flex:1 1 100%;display:flex;align-items:center;gap:6px}#layersDock .ld-pickbar .ld-pbhead b{flex:1;padding:0 4px}
#layersDock .ld-pickbar .btn.link{background:transparent;border-color:transparent;color:var(--stencil);padding:0 8px}
#layersDock .ld-tiles{flex:1 1 100%;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
#layersDock .ld-tiles button{min-height:56px;min-width:44px;border:1px solid var(--line);border-radius:var(--r-md,14px);background:var(--fill);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font:600 12.5px/1.1 var(--body);cursor:pointer;padding:4px 2px}
#layersDock .ld-tiles button:disabled{opacity:.4;cursor:default}#layersDock .ld-tiles button.primary{background:var(--stencil);border-color:var(--stencil);color:var(--on-accent)}#layersDock .ld-tiles button.danger{color:var(--danger)}
#layersDock .ld-ask{flex:1 1 100%;margin:0 4px;font-weight:600}#layersDock .ld-pickbar .btn.danger-fill{background:var(--danger-fill,var(--danger));border-color:transparent;color:var(--on-accent,#fff)}
@media (prefers-reduced-motion:no-preference){#layersDock .ld-line.ease{transition:transform .22s cubic-bezier(.2,.9,.3,1)}#layersDock .ld-row.ease{transition:transform .22s cubic-bezier(.2,.9,.3,1)}}`;

// Options: getState, getImages, selectedId(), pick(id) (select it the way a tray chip does),
// change(fn) (one undo step), kinds (the {planned, existing} view switches, owned by the caller),
// onKinds(kind) after a switch, openSheet() for Layers and groups, onPaint() for Paint on skin,
// onLayout() whenever its width changes, onOpen(open), openLook(id) for Blend and colour,
// adds: [Add tattoo, Procreate] buttons moved into its top, badges(t) for the marks a line carries
// (review, who is looking, open comments), sheetShown() while the edit panel stacks under it,
// duplicate(id), remove(ids), merge(ids) (may be async), rename(id, name), move(id, {before, group}),
// zoom(id) to bring the selected tattoo into view.
export const WIDE = 700; // from here up (an iPad, either way round) the layers and the edit panel are a column at the right
export const COL_W = 340;
export function createLayersDock(o) {
  if (!document.getElementById('ld-css')) { const s = document.createElement('style'); s.id = 'ld-css'; s.textContent = CSS; document.head.append(s); }
  // open on an iPad unless it was folded away on this device; a phone starts folded
  let open = innerWidth >= WIDE; try { const v = localStorage.getItem(DOCK_KEY); if (v === 'open' || v === 'rail') open = v === 'open'; } catch { /* private mode */ }
  let openMore = null, lastKey = '', openSwipe = null, selecting = false, askDelete = false;
  const picked = new Set(); // lines picked with a swipe right, on this screen only (never saved)
  // folders folded shut, kept on this device so a long list stays short after a reload
  const folded = new Set(); try { const v = JSON.parse(localStorage.getItem(FOLDED_KEY) || '[]'); if (Array.isArray(v)) for (const id of v) if (typeof id === 'string') folded.add(id); } catch { /* private mode */ }
  const keepFolded = () => { try { const ids = new Set((o.getState().groups || []).map((g) => g && g.id)); localStorage.setItem(FOLDED_KEY, JSON.stringify([...folded].filter((id) => ids.has(id)).slice(0, 200))); } catch { /* private mode */ } };
  let openGroupMore = null;
  const host = document.createElement('aside'); host.id = 'layersDock'; host.className = 'glass holds-scroll'; host.setAttribute('aria-label', 'Layers');
  host.innerHTML = `<div class="ld-head"><div class="ld-title"><h2>Layers</h2><small id="ldCount"></small></div><div class="ld-adds" id="ldAdds" role="group" aria-label="Add"></div><button class="ld-ib ld-toggle" id="ldToggle" type="button"></button></div>
<div class="ld-kinds" id="ldKinds" role="group" aria-label="Quick hide"><button class="ld-kind" id="ldPlanned" type="button" data-kind="planned" aria-pressed="false"></button><button class="ld-kind" id="ldExisting" type="button" data-kind="existing" aria-pressed="false"></button></div>
<div class="ld-view" id="ldView" role="group" aria-label="Show"></div>
<div class="ld-list" id="ldList" data-scroll></div>
<div class="ld-foot"><button class="btn" id="ldAreas" type="button">Sort by area</button><button class="btn" id="ldFoldAll" type="button">Fold all</button><button class="btn" id="ldSelect" type="button" aria-pressed="false">Select</button></div>`;
  (document.querySelector('#viewport') || document.body).append(host);
  const $ = (s) => host.querySelector(s);
  for (const b of o.adds || []) if (b) { b.title = b.textContent.trim(); if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', b.title); $('#ldAdds').append(b); }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ib = (html, label, fn, cls = '') => { const b = el('button', 'ld-ib ' + cls); b.type = 'button'; b.innerHTML = html; b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b; };
  const btn = (text, fn) => { const b = el('button', 'btn', text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const wide = () => innerWidth >= WIDE;
  let lastW = null;
  function layout() {
    const sheet = !!o.sheetShown?.() && wide();
    host.classList.toggle('open', open); host.classList.toggle('rail', !open); host.classList.toggle('with-sheet', sheet && open);
    const shown = getComputedStyle(host).display !== 'none';
    // the room the right-hand column takes: the open panel (with the edit panel under it), or the
    // rail, with the edit panel beside it while a tattoo is selected
    let w = 0;
    if (wide()) w = shown ? (open ? COL_W + 12 : 60 + 12 + (sheet ? COL_W + 8 : 0)) : (sheet ? COL_W + 12 : 0);
    document.documentElement.style.setProperty('--layers-w', w + 'px');
    document.documentElement.style.setProperty('--rail-w', shown && !open && wide() ? '68px' : '0px');
    document.documentElement.style.setProperty('--ld-open-w', COL_W + 'px');
    document.body.classList.toggle('ld-open', open && wide() && shown);
    if (w !== lastW) { lastW = w; o.onLayout?.(); }
  }
  function setOpen(v, quiet) {
    open = !!v; try { localStorage.setItem(DOCK_KEY, open ? 'open' : 'rail'); } catch { /* private mode */ }
    lastKey = ''; render(); layout(); if (!quiet) o.onOpen?.(open);
  }
  $('#ldToggle').addEventListener('click', () => setOpen(!open));
  // Select: tap lines to pick several, then act on them all from the bar (Procreate's own way too)
  $('#ldSelect').addEventListener('click', () => { setSelecting(!(selecting || picked.size)); });
  function setSelecting(v) { selecting = !!v; askDelete = false; if (!selecting) picked.clear(); if (openSwipe) openSwipe = null; openMore = null; lastKey = ''; render(); if (selecting) o.onPick?.(picked.size, true); }
  // the views at the top: everything, only what is on my skin, or only the plans (this screen only)
  const VIEWS = [['all', 'All'], ['existing', 'On my skin'], ['planned', 'Planned']];
  const viewNow = () => (o.kinds.planned && !o.kinds.existing ? 'existing' : o.kinds.existing && !o.kinds.planned ? 'planned' : !o.kinds.planned && !o.kinds.existing ? 'all' : 'none');
  function setView(v) {
    o.kinds.planned = v === 'existing'; o.kinds.existing = v === 'planned';
    lastKey = ''; render(); o.onView?.(v);
  }
  for (const b of host.querySelectorAll('.ld-kind')) b.addEventListener('click', () => { const k = b.dataset.kind; o.kinds[k] = !o.kinds[k]; lastKey = ''; render(); o.onKinds?.(k); });
  function rowFor(t, state, images, selId, index) {
    const offByKind = !kindShown(t, o.kinds), row = el('div', 'ld-row' + (t.id === selId ? ' on' : '') + (t.hidden || offByKind ? ' dim' : '') + (picked.has(t.id) ? ' picked' : '')), line = el('div', 'ld-line');
    row.dataset.id = t.id; row.setAttribute('role', 'listitem');
    const pick = el('button', 'ld-pick'); pick.type = 'button';
    const thumb = el('span', 'ld-thumb'); const src = images[t.img]; if (typeof src === 'string' && src) { thumb.classList.add('art'); const im = el('img'); im.src = src; im.alt = ''; thumb.append(im); }
    const mark = o.badges?.(t) || {};
    const onSkin = t.status === 'existing', bits = [onSkin ? 'On my skin' : 'Planned']; if (t.locked && t.status !== 'existing') bits.push('Locked'); if (t.hidden) bits.push('Hidden'); else if (offByKind) bits.push('Off for now');
    if (mark.peer) { const p = el('b', 'peer', mark.peer.letter); p.title = mark.peer.names + ' looking'; thumb.append(p); }
    if (mark.cmts) { const c = el('b', 'cmts' + (mark.cmts.fresh ? ' new' : ''), String(mark.cmts.n)); c.title = `${mark.cmts.n} open comment${mark.cmts.n === 1 ? '' : 's'}`; thumb.append(c); }
    if (picked.has(t.id)) { const k = el('i', 'ld-pk'); k.innerHTML = TICK_S; thumb.append(k); } else if (selecting) thumb.append(el('i', 'ld-pk off'));
    if (hasLook(t)) bits.push(describeLook(t));
    // the same mark as the switch in the edit panel: a filled tick for On my skin, a dashed ring for Planned
    const text = el('span'), sm = el('small'), st = el('span', 'ld-st ' + (onSkin ? 'skin' : 'plan')); st.innerHTML = onSkin ? ST_SKIN : ST_PLAN; st.append(bits[0]);
    sm.append(st); if (bits.length > 1) sm.append(' · ' + bits.slice(1).join(' · '));
    if (mark.tag) sm.append(' · ', el('i', 'ld-tag ' + (mark.tag.cls || ''), mark.tag.text));
    text.append(el('b', '', t.name || 'Tattoo'), sm);
    pick.append(thumb, text);
    pick.setAttribute('aria-label', `${t.name || 'Tattoo'}, ${picked.has(t.id) ? 'picked, ' : ''}${bits.join(', ')}${mark.tag ? ', ' + mark.tag.text : ''}${mark.peer ? `, ${mark.peer.names} looking at it` : ''}${mark.cmts ? `, ${mark.cmts.n} open comment${mark.cmts.n === 1 ? '' : 's'}${mark.cmts.fresh ? ', new' : ''}` : ''}`); if (t.id === selId) pick.setAttribute('aria-current', 'true');
    pick.classList.add('ld-tat'); pick.dataset.id = t.id;
    pick.addEventListener('click', () => {
      if (openSwipe) { closeSwipe(); return; }
      if (selecting && !commentOnly()) { askDelete = false; togglePick(t.id, true); return; }
      // the selected line again opens its options, as in Procreate (Zoom to it is the first of them)
      if (t.id === o.selectedId() && !offByKind && !commentOnly()) { openMore = openMore === t.id ? null : t.id; lastKey = ''; render(); return; }
      if (offByKind) { o.kinds[kindOf(t)] = false; o.onKinds?.(kindOf(t)); } o.pick(t.id); if (!wide() && open) setOpen(false, true);
    });
    const eye = ib(t.hidden ? EYE_OFF : EYE, `${t.hidden ? 'Show' : 'Hide'} ${t.name || 'tattoo'}`, () => o.change((s) => changeSelected(s, [t.id], { hidden: !t.hidden })), 'ld-eye' + (t.hidden ? ' off' : ''));
    const more = ib(DOTS, `More for ${t.name || 'tattoo'}`, () => { openMore = openMore === t.id ? null : t.id; lastKey = ''; render(); }, 'ld-more'); more.setAttribute('aria-expanded', String(openMore === t.id));
    const mode = blendOf(t), look = ib(`<span>${blendLetter(mode)}</span>`, `Blend and colour for ${t.name || 'tattoo'}: ${blendName(mode)}`, () => o.openLook?.(t.id), 'ld-mode' + (hasLook(t) ? ' set' : ''));
    look.title = hasLook(t) ? describeLook(t) : blendName(DEFAULT_BLEND);
    line.append(pick, look, eye, more); const track = el('div', 'ld-track'); track.append(line); row.append(track);
    if (openSwipe === t.id) { track.classList.add('ld-swiped'); track.prepend(swipeActs(t)); line.style.transform = `translateX(${-SWIPE.actions}px)`; }
    if (openMore === t.id) {
      const acts = el('div', 'ld-acts');
      // the name, typed in place; one undo step when it is changed
      const nm = el('input', 'ld-name'); nm.type = 'text'; nm.value = t.name || ''; nm.maxLength = 60; nm.setAttribute('aria-label', 'Name'); nm.autocomplete = 'off'; nm.spellcheck = false;
      nm.addEventListener('change', () => { const v = nm.value.trim(); if (v && v !== t.name) o.rename?.(t.id, v); else nm.value = t.name || ''; });
      nm.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); });
      acts.append(nm);
      const up = btn('Move earlier', () => o.change((s) => reorderTattoo(s, t.id, -1))); up.disabled = index === 0;
      const down = btn('Move later', () => o.change((s) => reorderTattoo(s, t.id, 1))); down.disabled = index === state.tattoos.length - 1;
      // On my skin or Planned, the same two-way switch as the edit panel's (marking it on my skin locks it, as there)
      const seg = el('div', 'ld-stseg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', `${t.name || 'Tattoo'} is`);
      for (const [want, word, icon] of [['existing', 'On my skin', ST_SKIN], ['planned', 'Planned', ST_PLAN]]) {
        const on = (onSkin ? 'existing' : 'planned') === want, b = el('button', 'btn'); b.type = 'button'; b.dataset.status = want; b.innerHTML = icon; b.append(word); b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', () => { if (on) return; o.change((s) => { const x = s.tattoos.find((v) => v.id === t.id); if (x) { x.status = want; x.locked = want === 'existing'; } }); o.onStatus?.(t.id); });
        seg.append(b);
      }
      acts.append(seg);
      const below = lineBelow(state, t.id), merge = btn('Merge down', () => { openMore = null; o.merge?.([t.id, below]); }); merge.disabled = !below;
      if (below) merge.setAttribute('aria-label', `Merge ${t.name || 'tattoo'} down into ${(state.tattoos.find((x) => x.id === below) || {}).name || 'the tattoo below it'}`);
      acts.append(btn('Zoom to it', () => { openMore = null; lastKey = ''; render(); o.zoom ? o.zoom(t.id) : o.pick(t.id); }), btn('Duplicate', () => { openMore = null; o.duplicate?.(t.id); }), merge,
        btn('Blend and colour', () => { openMore = null; lastKey = ''; render(); o.openLook?.(t.id); }));
      acts.append(up, down, btn(t.locked ? 'Unlock' : 'Lock', () => o.change((s) => changeSelected(s, [t.id], { locked: !t.locked }))));
      if (t.group) acts.append(btn('Take out of group', () => o.change((s) => { const x = s.tattoos.find((v) => v.id === t.id); if (x) delete x.group; })));
      const del = btn('Delete', () => { openMore = null; o.remove?.([t.id]); }); del.classList.add('danger'); acts.append(del);
      row.append(acts);
    }
    return row;
  }
  function render() {
    const state = o.getState(), images = o.getImages() || {}, selId = o.selectedId(), k = o.kinds;
    for (const id of [...picked]) if (!state.tattoos.some((t) => t.id === id)) picked.delete(id);
    if (openSwipe && !state.tattoos.some((t) => t.id === openSwipe)) openSwipe = null;
    const key = JSON.stringify([open, selId, k, openMore, openGroupMore, openSwipe, selecting, askDelete, [...picked], [...folded], state.groups || [], state.paint ? !!state.paint.hidden : null,
      state.tattoos.map((t) => [t.id, t.name, t.hidden, t.status, t.locked, t.group, t.img, !!images[t.img], t.blend || '', t.adjust || null, o.badges?.(t) || null])]);
    if (key === lastKey) return; lastKey = key;
    const all = state.tattoos, planned = all.filter((t) => kindOf(t) === 'planned').length, existing = all.length - planned;
    $('#ldCount').textContent = all.length ? `${all.length} on the body` + (k.planned || k.existing ? ', some hidden' : '') : 'Nothing placed yet';
    const tg = $('#ldToggle'); tg.innerHTML = open ? FOLD : STACK + (all.length ? `<span class="ld-badge">${all.length}</span>` : '');
    tg.setAttribute('aria-label', open ? 'Fold the layers away' : `Show layers, ${all.length} ${all.length === 1 ? 'tattoo' : 'tattoos'}`); tg.setAttribute('aria-expanded', String(open)); tg.title = open ? 'Fold away' : 'Layers';
    for (const [b, kind, n, word] of [[$('#ldPlanned'), 'planned', planned, 'planned'], [$('#ldExisting'), 'existing', existing, 'on my skin']]) {
      const off = !!k[kind]; b.setAttribute('aria-pressed', String(off)); b.disabled = !n && !off;
      b.innerHTML = (off ? EYE_OFF : EYE) + `<span class="ld-word">${off ? 'Show' : 'Hide'} ${word}</span><span class="ld-cap">${kind === 'planned' ? 'Planned' : 'On my skin'}</span>` ;
      b.setAttribute('aria-label', `${off ? 'Show' : 'Hide'} ${word} tattoos, ${n}`); b.title = `${off ? 'Show' : 'Hide'} ${word}`;
    }
    const list = $('#ldList');
    if (!open) { list.replaceChildren(); return; }
    const keep = list.scrollTop; list.replaceChildren(); list.setAttribute('role', 'list');
    const index = new Map(all.map((t, i) => [t.id, i]));
    const sections = dockSections(state);
    if ((picked.size || selecting) && !commentOnly()) list.append(pickBar(state));
    for (const sec of sections) {
      const box = el('div', 'ld-sec' + (sec.group ? ' ld-in' : '')); box.dataset.group = sec.group ? sec.group.id : '';
      if (sec.group) {
        const g = sec.group, shut = folded.has(g.id), head = el('div', 'ld-ghead' + (g.area ? ' area' : '')); head.dataset.group = g.id;
        const toggleFold = () => { const opening = folded.has(g.id); if (opening) folded.delete(g.id); else folded.add(g.id); keepFolded(); lastKey = ''; render(); if (opening) o.frameFolder?.(g.id); o.onFolder?.(opening); };
        const fold = ib(CHEV, `${shut ? 'Open' : 'Fold'} ${g.name}`, toggleFold, 'ld-fold'); fold.setAttribute('aria-expanded', String(!shut));
        // the folder's name: a tap opens it and turns the view to everything in it (or folds it again)
        const n = sec.items.length, inView = sec.items.filter((t) => kindShown(t, o.kinds)).length, hid = sec.items.filter((t) => t.hidden).length;
        const words = !n ? 'Empty folder' : `${n} ${n === 1 ? 'tattoo' : 'tattoos'}` + (inView < n ? `, ${inView} in this view` : '') + (hid ? `, ${hid} hidden` : '');
        const name = el('button', 'ld-gname'); name.type = 'button'; name.append(el('b', '', g.name), el('small', '', words));
        name.setAttribute('aria-label', `${g.name}, ${words}. ${shut ? 'Open it and show it on the body' : 'Fold it'}`); name.setAttribute('aria-expanded', String(!shut)); name.addEventListener('click', toggleFold);
        const anyShown = sec.items.some((t) => !t.hidden);
        const eye = ib(anyShown ? EYE : EYE_OFF, `${anyShown ? 'Hide' : 'Show'} everything in ${g.name}`, () => o.change((s) => groupEye(s, g.id)), 'ld-eye' + (anyShown ? '' : ' off')); eye.disabled = !n;
        const more = ib(DOTS, `More for the ${g.name} folder`, () => { openGroupMore = openGroupMore === g.id ? null : g.id; lastKey = ''; render(); }, 'ld-gmore'); more.setAttribute('aria-expanded', String(openGroupMore === g.id));
        head.append(fold, name, eye, more); box.append(head);
        if (openGroupMore === g.id && !commentOnly()) box.append(folderActs(g, sec.items, state));
        if (!shut) for (const t of sec.items) box.append(rowFor(t, state, images, selId, index.get(t.id)));
      } else {
        if (sections.length > 1 && sec.items.length) box.append(el('p', 'ld-rest', 'Not in a folder'));
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
    if (!all.length && !state.paint) list.append(el('p', 'ld-empty', 'Tap + to add a picture of a tattoo, or the pencil to draw one in Procreate. Each one shows here as a layer.'));
    list.scrollTop = keep;
    $('#ldSelect').hidden = !all.length && !selecting; const picking = selecting || picked.size > 0; $('#ldSelect').textContent = picking ? 'Done' : 'Select'; $('#ldSelect').setAttribute('aria-pressed', String(picking)); $('#ldSelect').classList.toggle('primary', picking);
    host.classList.toggle('selecting', selecting);
    // the foot: Sort into areas with two or more tattoos, Fold all with two or more folders
    const nFolders = sections.filter((x) => x.group).length, allShut = nFolders > 0 && sections.every((x) => !x.group || folded.has(x.group.id));
    $('#ldAreas').hidden = !o.areaOf || all.length < 2 || picking || commentOnly();
    $('#ldFoldAll').hidden = nFolders < 2 || picking; $('#ldFoldAll').textContent = allShut ? 'Open all' : 'Fold all';
    $('#ldFoldAll').setAttribute('aria-label', allShut ? 'Open every folder' : 'Fold every folder shut');
    const vNow = viewNow(), counts = { all: all.length, existing, planned }, vb = $('#ldView');
    vb.replaceChildren(...VIEWS.map(([v, word]) => { const b = el('button'); b.type = 'button'; b.dataset.view = v; b.setAttribute('aria-pressed', String(vNow === v)); b.append(word, el('span', 'ld-n', String(counts[v]))); b.setAttribute('aria-label', `Show ${v === 'all' ? 'all tattoos' : v === 'existing' ? 'only the tattoos on my skin' : 'only the planned tattoos'}, ${counts[v]}`); b.addEventListener('click', () => setView(v)); return b; }));
    vb.hidden = !all.length;
  }
  // A folder's ⋯: its name typed in place, Show only this folder, Show everything, Zoom to them,
  // Pick them (for the bar's actions) and Take them out of the folder. Each change is one undo step.
  function folderActs(g, items, state) {
    const acts = el('div', 'ld-gacts'); acts.dataset.group = g.id;
    const nm = el('input', 'ld-name'); nm.type = 'text'; nm.value = g.name; nm.maxLength = 60; nm.setAttribute('aria-label', 'Folder name'); nm.autocomplete = 'off'; nm.spellcheck = false;
    nm.addEventListener('change', () => { const v = nm.value.trim(); if (v && v !== g.name) o.change((s) => renameFolder(s, g.id, v)); else nm.value = g.name; });
    nm.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); });
    acts.append(nm);
    const ids = items.map((t) => t.id), others = state.tattoos.filter((t) => t.group !== g.id);
    const solo = items.length && items.every((t) => !t.hidden) && others.length && others.every((t) => t.hidden);
    const only = btn('Show only this folder', () => { o.change((s) => soloFolder(s, g.id)); o.onFolderSolo?.(g.id); }); only.disabled = !items.length || solo;
    const every = btn('Show everything', () => o.change((s) => changeSelected(s, s.tattoos.map((t) => t.id), { hidden: false }))); every.disabled = !state.tattoos.some((t) => t.hidden);
    const zoom = btn('Zoom to them', () => { openGroupMore = null; if (folded.has(g.id)) { folded.delete(g.id); keepFolded(); } lastKey = ''; render(); o.frameFolder?.(g.id); }); zoom.disabled = !items.length;
    const pickThem = btn('Pick them', () => { openGroupMore = null; selecting = true; picked.clear(); for (const id of ids) picked.add(id); if (folded.has(g.id)) { folded.delete(g.id); keepFolded(); } lastKey = ''; render(); o.onPick?.(picked.size, true); }); pickThem.disabled = !items.length;
    const out = btn('Take them out of the folder', () => { openGroupMore = null; folded.delete(g.id); keepFolded(); o.change((s) => unfolder(s, g.id)); o.onGroup?.(false); });
    acts.append(only, every, zoom, pickThem, out);
    return acts;
  }
  // Sort into areas: every tattoo not in a folder of your own goes into a folder for where it sits
  // on the body, one undo step; the folders start folded, except the one holding the selected tattoo
  function sortAreas() {
    if (!o.areaOf || commentOnly()) return;
    const state = o.getState(), plan = sortPlan(state, o.areaOf);
    if (!plan.move) { o.onSorted?.({ moved: 0, folders: plan.folders }); return; }
    let r = null; o.change((s) => { r = sortIntoAreas(s, o.areaOf); });
    const after = o.getState(), sel = after.tattoos.find((t) => t.id === o.selectedId());
    if (r) for (const id of r.ids) if (!sel || sel.group !== id) folded.add(id); else folded.delete(id);
    keepFolded(); openGroupMore = null; lastKey = ''; render(); o.onSorted?.(r);
  }
  $('#ldAreas').addEventListener('click', sortAreas);
  // Fold all, or Open all when every folder is folded
  $('#ldFoldAll').addEventListener('click', () => {
    const ids = dockSections(o.getState()).filter((x) => x.group).map((x) => x.group.id), allShut = ids.length && ids.every((id) => folded.has(id));
    for (const id of ids) if (allShut) folded.delete(id); else folded.add(id);
    keepFolded(); lastKey = ''; render(); o.onFolder?.(allShut);
  });
  // The bar over the list while lines are picked (a swipe right picks one, as in Procreate, or Select
  // and tap): what to do with all of them at once. Each change is one undo step.
  function pickBar(state) {
    const list = state.tattoos.filter((t) => picked.has(t.id)), ids = list.map((t) => t.id), n = ids.length, bar = el('div', 'ld-pickbar'); bar.id = 'ldPickBar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Picked layers');
    const clear = () => { picked.clear(); askDelete = false; lastKey = ''; render(); };
    const onSkin = list.filter((t) => t.status === 'existing').length;
    if (askDelete && n) {
      // tattoos already on my skin are a record of real ink: ask once before they go
      bar.append(el('p', 'ld-ask', `Delete ${n === 1 ? 'this tattoo' : `these ${n} tattoos`}? ${onSkin === n ? (n === 1 ? 'It is on your skin.' : 'They are all on your skin.') : `${onSkin} of them ${onSkin === 1 ? 'is' : 'are'} on your skin.`} Undo brings them back.`));
      const yes = btn(`Delete ${n}`, () => { const x = [...ids]; askDelete = false; picked.clear(); o.remove?.(x); lastKey = ''; render(); }); yes.classList.add('danger-fill');
      bar.append(yes, btn('Cancel', () => { askDelete = false; lastKey = ''; render(); }));
      return bar;
    }
    const head = el('div', 'ld-pbhead'); head.append(el('b', '', n ? `${n} picked` : 'Tap lines to pick them'));
    const allIds = state.tattoos.map((t) => t.id), allPicked = n === allIds.length && n > 0;
    const sa = btn(allPicked ? 'Clear' : 'Pick all', () => { if (allPicked) picked.clear(); else for (const id of allIds) picked.add(id); askDelete = false; lastKey = ''; render(); }); sa.classList.add('link');
    head.append(sa); bar.append(head); // Done is the button at the foot, where Select was
    if (!n) return bar;
    const tiles = el('div', 'ld-tiles'), tile = (icon, word, label, fn, cls = '') => { const b = el('button', cls); b.type = 'button'; b.innerHTML = icon; b.append(el('span', '', word)); b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b; };
    const allHidden = list.every((t) => t.hidden), planned = list.filter((t) => t.status !== 'existing'), allLocked = planned.length > 0 && planned.every((t) => t.locked);
    const groups = new Set((state.groups || []).map((g) => g.id)), inGroup = list.filter((t) => t.group && groups.has(t.group)).length;
    const them = n === 1 ? 'it' : `the ${n}`;
    tiles.append(
      tile(allHidden ? EYE : EYE_OFF, allHidden ? 'Show' : 'Hide', `${allHidden ? 'Show' : 'Hide'} ${them}`, () => o.change((s) => changeSelected(s, ids, { hidden: !allHidden }))),
      tile(DUP, 'Duplicate', `Duplicate ${them}`, () => { const x = [...ids]; picked.clear(); o.duplicate?.(x); lastKey = ''; render(); }),
      inGroup === n
        ? tile(UNGROUP, 'Ungroup', `Take ${them} out of ${n === 1 ? 'its group' : 'their groups'}`, () => { const x = new Set(ids); o.change((s) => { for (const t of s.tattoos) if (x.has(t.id)) delete t.group; s.groups = (s.groups || []).filter((g) => s.tattoos.some((t) => t.group === g.id)); }); o.onGroup?.(false); })
        : tile(FOLDER, 'Group', `Group ${them}`, () => { const x = [...ids]; o.change((s) => assignGroup(s, x, `Group ${(s.groups || []).length + 1}`)); o.onGroup?.(true); }),
      tile(LOCK, allLocked ? 'Unlock' : 'Lock', `${allLocked ? 'Unlock' : 'Lock'} ${them}`, () => o.change((s) => changeSelected(s, planned.map((t) => t.id), { locked: !allLocked }))),
      tile(MERGE, 'Merge', `Merge ${them} into one`, () => { const x = [...ids]; picked.clear(); selecting = false; lastKey = ''; render(); o.merge?.(x); }, 'primary'),
      tile(DOTS, 'More', `More for ${them}: move together, ink strength, solo`, () => o.openSheet?.([...ids])),
      tile(BIN, 'Delete', `Delete ${them}`, () => { if (onSkin) { askDelete = true; lastKey = ''; render(); return; } const x = [...ids]; picked.clear(); o.remove?.(x); lastKey = ''; render(); }, 'danger'),
    );
    tiles.children[3].disabled = !planned.length; tiles.children[4].disabled = n < 2;
    bar.append(tiles);
    return bar;
  }
  // Lock, Duplicate and Delete behind a line swiped left
  function swipeActs(t) {
    const box = el('div', 'ld-swipe'), mk = (cls, icon, word, label, fn) => { const b = el('button', cls); b.type = 'button'; b.innerHTML = icon; b.append(el('span', '', word)); b.setAttribute('aria-label', label); b.addEventListener('click', (e) => { e.stopPropagation(); openSwipe = null; lastKey = ''; fn(); render(); }); return b; };
    const nm = t.name || 'tattoo';
    box.append(mk('sw-lock', LOCK, t.locked ? 'Unlock' : 'Lock', `${t.locked ? 'Unlock' : 'Lock'} ${nm}`, () => o.change((s) => changeSelected(s, [t.id], { locked: !t.locked }))),
      mk('sw-dup', DUP, 'Duplicate', `Duplicate ${nm}`, () => o.duplicate?.(t.id)), mk('sw-del', BIN, 'Delete', `Delete ${nm}`, () => o.remove?.([t.id])));
    return box;
  }
  const commentOnly = () => document.body.classList.contains('comment-only');
  const rowEl = (id) => host.querySelector(`.ld-row[data-id="${String(id).replace(/["\\]/g, '\\$&')}"]`);
  function closeSwipe(quick) {
    const id = openSwipe; openSwipe = null; const row = id && rowEl(id), line = row && row.querySelector('.ld-line');
    if (!line || quick) { lastKey = ''; render(); return; }
    line.classList.add('ease'); line.style.transform = '';
    setTimeout(() => { lastKey = ''; render(); }, 230);
  }
  function togglePick(id, plain) {
    askDelete = false;
    if (picked.has(id)) picked.delete(id);
    else { const sel = o.selectedId(); if (!plain && !picked.size && sel && sel !== id && o.getState().tattoos.some((t) => t.id === sel)) picked.add(sel); picked.add(id); }
    lastKey = ''; render(); o.onPick?.(picked.size);
  }
  /* ---------- the gestures on the list ---------- */
  const listEl = $('#ldList'); let g = null, quietUntil = 0, hint = null;
  const now = () => performance.now();
  const quiet = () => { quietUntil = now() + 320; };
  // a tap that ends a gesture must not also pick the line under it
  listEl.addEventListener('click', (e) => {
    if (now() < quietUntil) { e.preventDefault(); e.stopPropagation(); return; }
    // a tap on a line swiped open only closes it, as on the iPad, and never presses the eye or the
    // other buttons that slid along with it (2026-11-23: tapping it to close it hid the tattoo)
    const r = openSwipe && e.target.closest ? e.target.closest('.ld-row[data-id]') : null;
    if (r && r.dataset.id === openSwipe && !e.target.closest('.ld-swipe')) { e.preventDefault(); e.stopPropagation(); closeSwipe(); o.onSwipeClosed?.(); }
  }, true);
  const setHint = (text) => { if (!text) { if (hint) { hint.remove(); hint = null; } return; } if (!hint) { hint = el('div', 'ld-hint'); hint.setAttribute('role', 'status'); host.append(hint); } hint.textContent = text; };
  const touchRow = (tt) => { const e = document.elementFromPoint(tt.clientX, tt.clientY) || tt.target; return e && e.closest && !e.closest('.ld-acts,.ld-swipe,.ld-pickbar,input') ? e.closest('.ld-row[data-id]') : null; };
  function reset() {
    if (!g) return;
    clearTimeout(g.timer);
    if (g.kind === 'pinch') { for (const r of host.querySelectorAll('.ld-row.ld-pinch')) { r.classList.remove('ld-pinch'); r.classList.add('ease'); r.style.transform = ''; } setHint(''); }
    if (g.kind === 'drag') { g.row.classList.remove('ld-drag'); g.row.style.transform = ''; if (g.drop) g.drop.remove(); setHint(''); }
    g = null;
  }
  function startPinch(a, b) {
    reset(); if (openSwipe) closeSwipe(true);
    const ra = rowEl(a.id), rb = rowEl(b.id); if (!ra || !rb) return;
    g = { kind: 'pinch', a, b, gap0: Math.abs(a.y - b.y), gap: Math.abs(a.y - b.y) };
  }
  function pinchIds() {
    const state = o.getState();
    if (picked.size >= 2 && picked.has(g.a.id) && picked.has(g.b.id)) return state.tattoos.filter((t) => picked.has(t.id)).map((t) => t.id);
    return rangeBetween(displayOrder(state), g.a.id, g.b.id);
  }
  function onStart(e) {
    if (!open || commentOnly()) return;
    const ts = [...e.touches];
    if (ts.length === 2) {
      const ra = touchRow(ts[0]), rb = touchRow(ts[1]);
      if (ra && rb) { startPinch({ id: ra.dataset.id, t: ts[0].identifier, y: ts[0].clientY }, { id: rb.dataset.id, t: ts[1].identifier, y: ts[1].clientY }); e.preventDefault(); }
      else reset();
      return;
    }
    if (ts.length !== 1) { reset(); return; }
    const tt = ts[0], row = touchRow(tt);
    if (tt.target && tt.target.closest && tt.target.closest('.ld-swipe')) return; // its own buttons take the tap
    if (openSwipe && (!row || row.dataset.id !== openSwipe)) { closeSwipe(); if (!row) return; quiet(); }
    if (!row) return;
    const id = row.dataset.id, base = openSwipe === id ? -SWIPE.actions : 0;
    g = { kind: 'maybe', id, row, line: row.querySelector('.ld-line'), track: row.querySelector('.ld-track'), x0: tt.clientX, y0: tt.clientY, base, t: tt.identifier };
    g.timer = setTimeout(() => { if (g && g.kind === 'maybe' && g.id === id) startDrag(); }, 380);
  }
  function startDrag() {
    g.kind = 'drag'; g.row.classList.add('ld-drag'); quiet();
    g.drop = el('div', 'ld-drop'); listEl.append(g.drop); g.drop.hidden = true;
    setHint('Drag to a new place');
  }
  const tById = (e, id) => [...e.touches].find((x) => x.identifier === id) || [...e.changedTouches].find((x) => x.identifier === id);
  function onMove(e) {
    if (!g) return;
    if (g.kind === 'pinch') {
      const a = tById(e, g.a.t), b = tById(e, g.b.t); if (!a || !b) return; e.preventDefault();
      g.gap = Math.abs(a.clientY - b.clientY); const ids = pinchIds(), mid = (a.clientY + b.clientY) / 2, close = Math.max(0, Math.min(1, 1 - g.gap / Math.max(1, g.gap0)));
      for (const r of host.querySelectorAll('.ld-row[data-id]')) {
        const inIt = ids.includes(r.dataset.id); r.classList.toggle('ld-pinch', inIt && ids.length > 1); r.classList.remove('ease');
        if (!inIt) { r.style.transform = ''; continue; }
        const rc = r.getBoundingClientRect(); r.style.transform = `translateY(${((mid - (rc.top + rc.height / 2)) * close * 0.6).toFixed(1)}px)`;
      }
      setHint(ids.length < 2 ? '' : pinchMerges(g.gap0, g.gap) ? `Let go to merge ${ids.length}` : `Pinch together to merge ${ids.length}`);
      return;
    }
    const tt = tById(e, g.t); if (!tt) return;
    const dx = tt.clientX - g.x0, dy = tt.clientY - g.y0;
    if (g.kind === 'maybe') {
      const k = swipeKind(dx, dy); if (!k) return;
      clearTimeout(g.timer);
      if (k === 'scroll' || !g.line) { g = null; return; }
      g.kind = 'swipe'; g.track.classList.add('ld-swiped');
      if (!g.track.querySelector('.ld-swipe')) { const t = o.getState().tattoos.find((x) => x.id === g.id); if (t) g.track.prepend(swipeActs(t)); }
      if (!g.track.querySelector('.ld-pickzone')) { const z = el('div', 'ld-pickzone'); z.innerHTML = TICK; z.append(el('span', '', picked.has(g.id) ? ' Unpick' : ' Pick')); g.track.prepend(z); }
      g.line.classList.remove('ease');
    }
    if (g.kind === 'swipe') {
      e.preventDefault();
      let x = g.base + dx; const max = SWIPE.actions;
      if (x < -max) x = -max - (Math.sqrt(-x - max) * 4); if (x > 96) x = 96 + Math.sqrt(x - 96) * 4;
      g.x = x; g.line.style.transform = `translateX(${x.toFixed(1)}px)`;
      const z = g.track.querySelector('.ld-pickzone'), a = g.track.querySelector('.ld-swipe'); if (z) z.style.visibility = x > 0 ? 'visible' : 'hidden'; if (a) a.style.visibility = x < 0 ? 'visible' : 'hidden';
      return;
    }
    if (g.kind === 'drag') {
      e.preventDefault(); g.row.style.transform = `translateY(${dy.toFixed(1)}px)`;
      const l = listEl.getBoundingClientRect(); if (tt.clientY < l.top + 36) listEl.scrollTop -= 8; else if (tt.clientY > l.bottom - 36) listEl.scrollTop += 8;
      g.where = dropAt(tt.clientY);
    }
  }
  // Where a dragged line would land: above a line (its top half), after it (its bottom half), or at
  // the end of a group (its heading)
  function dropAt(y) {
    const items = [...listEl.querySelectorAll('.ld-row[data-id], .ld-ghead')].filter((x) => x !== g.row && x.id !== 'ldPaint');
    const l = listEl.getBoundingClientRect(); let where = null, lineY = null;
    for (const it of items) {
      const r = it.getBoundingClientRect();
      if (y < r.top || y > r.bottom) continue;
      if (it.classList.contains('ld-ghead')) { where = { group: it.dataset.group }; lineY = r.bottom; break; }
      if (y < r.top + r.height / 2) { where = { before: it.dataset.id }; lineY = r.top; break; }
      let nx = it.nextElementSibling; while (nx && (nx === g.row || !nx.matches('.ld-row[data-id]'))) nx = nx.nextElementSibling;
      const sec = it.closest('.ld-sec'); where = nx ? { before: nx.dataset.id } : { group: sec && sec.dataset.group ? sec.dataset.group : null }; lineY = r.bottom; break;
    }
    if (!where && items.length) {
      const rows = items.filter((x) => x.matches('.ld-row[data-id]'));
      if (rows.length && y < rows[0].getBoundingClientRect().top) { where = { before: rows[0].dataset.id }; lineY = rows[0].getBoundingClientRect().top; }
      else if (rows.length) { const last = rows[rows.length - 1], sec = last.closest('.ld-sec'); where = { group: sec && sec.dataset.group ? sec.dataset.group : null }; lineY = last.getBoundingClientRect().bottom; }
    }
    if (g.drop) { g.drop.hidden = lineY == null; if (lineY != null) g.drop.style.top = (lineY - l.top + listEl.scrollTop - 1.5).toFixed(1) + 'px'; }
    return where;
  }
  function onEnd(e) {
    if (!g) return;
    if (g.kind === 'pinch') {
      const ids = pinchIds(), merge = ids.length > 1 && pinchMerges(g.gap0, g.gap); reset(); quiet();
      if (merge) { picked.clear(); lastKey = ''; render(); o.merge?.(ids); }
      return;
    }
    if (![...e.changedTouches].some((x) => x.identifier === g.t)) return;
    if (g.kind === 'maybe') { clearTimeout(g.timer); g = null; return; }
    if (g.kind === 'swipe') {
      const x = g.x || 0, id = g.id, line = g.line; g = null; quiet();
      line.classList.add('ease');
      if (x < -SWIPE.open) { openSwipe = id; line.style.transform = `translateX(${-SWIPE.actions}px)`; lastKey = ''; o.onSwipe?.(); return; }
      if (openSwipe === id) openSwipe = null;
      line.style.transform = '';
      setTimeout(() => { if (x > SWIPE.pick) togglePick(id); else { lastKey = ''; render(); } }, 200);
      return;
    }
    if (g.kind === 'drag') {
      const id = g.id, where = g.where; reset(); quiet();
      if (where) o.move?.(id, where);
      lastKey = ''; render();
    }
  }
  listEl.addEventListener('touchstart', onStart, { passive: false });
  listEl.addEventListener('touchmove', onMove, { passive: false });
  listEl.addEventListener('touchend', onEnd);
  listEl.addEventListener('touchcancel', () => { reset(); lastKey = ''; render(); });
  // A tattoo picked on the body: open the panel on an iPad (2026-11-19, Jake: "when I select a
  // tattoo on the body, I want that to be opened up in the layer panel"), unfold its group and
  // bring its line into view. On a phone the panel would cover the body, so it only marks the line.
  function reveal(id) {
    const state = o.getState(), t = state.tattoos.find((x) => x.id === id); if (!t) return;
    if (t.group && folded.has(t.group)) { folded.delete(t.group); keepFolded(); lastKey = ''; }
    if (!open && wide()) setOpen(true, true); else render();
    requestAnimationFrame(() => {
      const row = host.querySelector(`.ld-row[data-id="${String(id).replace(/["\\]/g, "\\$&")}"]`), list = $('#ldList'); if (!row || !list || !open) return;
      const r = row.getBoundingClientRect(), l = list.getBoundingClientRect();
      if (r.top < l.top + 4 || r.bottom > l.bottom - 4) list.scrollTop += (r.top + r.height / 2) - (l.top + l.height / 2);
    });
  }
  // a tattoo that moved into another folder stays in sight in the panel: its folder opens, and
  // nothing else changes (the panel is not opened)
  function unfoldFor(id) {
    const t = o.getState().tattoos.find((x) => x.id === id);
    if (t && t.group && folded.has(t.group)) { folded.delete(t.group); keepFolded(); lastKey = ''; render(); }
  }
  addEventListener('resize', () => layout());
  render(); layout();
  return { render, layout, setOpen, reveal, unfoldFor, sortAreas, folded: () => [...folded], isOpen: () => open, el: host, wide, picked: () => [...picked], openOptions: (id) => { openMore = id; lastKey = ''; render(); } };
}
