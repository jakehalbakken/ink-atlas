// Find any tool by typing: plain maths, no page. Each item is { label, where, desc, words };
// the app builds the list from its own panels at the moment of the search, so a button that is
// added later is found with no change here.

export function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const toks = (s) => fold(s).split(' ').filter(Boolean);

// a few words people type that the labels don't use, keyed by a word that is in the label
export const EXTRA_WORDS = {
  clean: 'erase eraser rub background remove crop cut out photoshop fix edit',
  stencil: 'print transfer outline lines artist', print: 'stencil paper pdf',
  size: 'bigger smaller width inches resize scale', width: 'size bigger smaller inches resize scale',
  turn: 'rotate angle', warp: 'distort curve transform perspective', bend: 'distort curve transform',
  mirror: 'flip reverse', blend: 'colour color hue tint recolour recolor multiply mode', colour: 'color hue tint recolor',
  share: 'send export', back: 'backup restore', undo: 'back history', camera: 'ar live',
  photo: 'picture image', picture: 'photo image', pose: 'arms move position posture', hair: 'haircut',
  tape: 'measure ruler length distance', pain: 'hurt sore painful', aging: 'heal healed fade age old',
  procreate: 'draw drawing paint ipad', draw: 'pencil sketch paint', layers: 'list order',
  duplicate: 'copy clone', delete: 'remove bin trash', remove: 'delete bin trash', hide: 'show eye visible',
  lock: 'freeze pin', light: 'lighting sun daylight', clothes: 'outfit shirt shorts cover',
  measure: 'inches tape size', approval: 'artist client yes approve', sittings: 'session appointment calendar schedule',
  wrap: 'around sleeve band', account: 'sign in login cloud sync', saves: 'lost restore recover backup',
  skin: 'tone colour color', face: 'selfie', scan: '3d lidar polycam scaniverse', spots: 'placement where location',
};

// score one item; 0 means it does not match every typed word
export function score(item, query) {
  const q = toks(query); if (!q.length) return 0;
  const label = toks(item.label), more = toks([item.where, item.desc, item.words].join(' '));
  const lab = fold(item.label), whole = fold(query);
  let s = 0;
  for (const w of q) {
    let best = 0;
    for (const t of label) { if (t === w) best = Math.max(best, 4); else if (t.startsWith(w)) best = Math.max(best, 3); else if (w.length >= 3 && t.includes(w)) best = Math.max(best, 2); }
    if (best < 2) for (const t of more) { if (t === w || t.startsWith(w)) best = Math.max(best, 1); }
    if (!best) return 0;
    s += best;
  }
  if (lab.startsWith(whole)) s += 5; else if (lab.includes(whole)) s += 2;
  return s - label.length * 0.01; // shorter labels first when equal
}

// the best matches, one per label and place, best first
export function search(items, query, limit = 30) {
  const seen = new Set(), out = [];
  for (const it of items) { const s = score(it, query); if (s > 0) out.push([s, it]); }
  out.sort((a, b) => b[0] - a[0]);
  const res = [];
  for (const [, it] of out) { const k = fold(it.label) + '|' + fold(it.where); if (seen.has(k)) continue; seen.add(k); res.push(it); if (res.length >= limit) break; }
  return res;
}

// extra words for a label, from the words in it
export function wordsFor(label) {
  const add = [];
  for (const w of toks(label)) for (const [k, v] of Object.entries(EXTRA_WORDS)) if (w.startsWith(k)) add.push(v);
  return add.join(' ');
}
