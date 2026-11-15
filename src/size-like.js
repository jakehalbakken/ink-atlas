// How big is that? A tattoo's size said as an everyday thing of about the same size, so a number
// like 3.4 x 2.1 in reads as "about the size of a credit card". Pure maths on the two sides.

// long side x short side, in inches
export const THINGS = [
  { say: 'a fingernail', l: 0.6, s: 0.5 },
  { say: 'a postage stamp', l: 1.1, s: 0.9 },
  { say: 'a matchbox', l: 2.1, s: 1.4 },
  { say: 'a credit card', l: 3.37, s: 2.13 },
  { say: 'a playing card', l: 3.5, s: 2.5 },
  { say: 'a coaster', l: 4, s: 4 },
  { say: 'a phone', l: 6, s: 2.9 },
  { say: 'a postcard', l: 6, s: 4 },
  { say: 'a paperback book', l: 7, s: 4.3 },
  { say: 'a dinner plate', l: 10.5, s: 10.5 },
  { say: 'a sheet of letter paper', l: 11, s: 8.5 },
  { say: 'a record sleeve', l: 12.4, s: 12.4 },
  { say: 'a laptop', l: 13, s: 9 },
  { say: 'a large pizza box', l: 16, s: 16 },
  { say: 'a newspaper page', l: 22.75, s: 12 },
  { say: 'a stick of gum', l: 2.75, s: 0.75 },
  { say: 'a toothbrush', l: 7.5, s: 0.7 },
  { say: 'a banknote', l: 6.1, s: 2.6 },
  { say: 'a pen', l: 5.5, s: 0.45 },
  { say: 'a pencil', l: 7.5, s: 0.3 },
  { say: 'a ruler', l: 12, s: 1.2 },
];

// the nearest thing by both sides (on a log scale, so 2x too big counts the same as 2x too small)
export function sizeLike(w, h) {
  if (!(w > 0) || !(h > 0)) return null;
  const L = Math.max(w, h), S = Math.min(w, h);
  let best = null, bd = Infinity;
  for (const x of THINGS) {
    const d = Math.abs(Math.log(L / x.l)) + Math.abs(Math.log(S / x.s));
    if (d < bd) { bd = d; best = x; }
  }
  const area = (L * S) / (best.l * best.s);
  return { thing: best.say, off: bd, area };
}

export function sizeLikeText(w, h) {
  const r = sizeLike(w, h); if (!r) return '';
  if (Math.max(w, h) < 0.45) return 'Tiny: smaller than a fingernail.';
  if (r.off > 1.2) return '';
  const how = r.area > 1.8 ? 'Bigger than' : r.area > 1.35 ? 'A bit bigger than' : r.area < 0.55 ? 'Smaller than' : r.area < 0.74 ? 'A bit smaller than' : 'About the size of';
  return `${how} ${r.thing}.`;
}
