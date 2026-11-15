// What it shows in: whether everyday clothes hide a tattoo, from swimwear up to long sleeves and
// long pants, using the same cut lines as Preview > Clothes. Pure maths on the shares covered.

// lightest first; each is a top and a bottom from clothes.js and how to say it
export const OUTFITS = [
  { top: 'none', bottom: 'swim', say: 'swimwear' },
  { top: 'tank', bottom: 'shorts', say: 'a tank top and shorts' },
  { top: 'tee', bottom: 'shorts', say: 'a T-shirt and shorts' },
  { top: 'tee', bottom: 'pants', say: 'a T-shirt and long pants' },
  { top: 'long', bottom: 'pants', say: 'long sleeves and long pants' },
];

const HIDDEN = 0.9, SHOWS = 0.1;
const TOP = { tank: 'a tank top', tee: 'a T-shirt', long: 'long sleeves' }, BOTTOM = { shorts: 'shorts', pants: 'long pants' };
// the two outfits said by what differs: "long pants" and "shorts" when the top is the same
function pair(a, b) {
  if (a.top === b.top && BOTTOM[a.bottom] && BOTTOM[b.bottom]) return [BOTTOM[a.bottom], BOTTOM[b.bottom]];
  if (a.bottom === b.bottom && TOP[a.top] && TOP[b.top]) return [TOP[a.top], TOP[b.top]];
  return [a.say, b.say];
}

// shares: the part of the tattoo each outfit covers (0..1), in OUTFITS order. Returns the line.
export function visibilityText(shares) {
  if (!shares || shares.length !== OUTFITS.length) return '';
  const hides = shares.map((s) => s >= HIDDEN);
  if (hides[0]) return 'Hidden even in swimwear.';
  const first = hides.indexOf(true);
  const heaviest = OUTFITS.length - 1;
  if (first < 0) {
    const s = shares[heaviest];
    return s > SHOWS ? `Partly hidden by ${OUTFITS[heaviest].say}, so some of it always shows.` : `Shows even in ${OUTFITS[heaviest].say}.`;
  }
  const prev = first - 1, how = shares[prev] > SHOWS ? 'partly shows' : 'shows', [a, b] = pair(OUTFITS[first], OUTFITS[prev]);
  return `Hidden by ${a}, ${how} in ${b}.`;
}

// What to wear to the sitting: the warmest everyday top and bottom that still leave the whole
// tattoo open, said only for the part that matters. top: share covered by each top alone
// ({ tank, tee, long }); bottom: by each bottom alone ({ swim, shorts, pants }).
const TOP_WEAR = { tee: 'a T-shirt', tank: 'a tank top', none: 'a top you can take off or open, like a button-up' };
const BOTTOM_WEAR = { shorts: 'shorts', swim: 'shorts you can roll up high, or bring a pair to change into', none: 'loose clothes you can move aside' };
export function sittingWear(top, bottom) {
  if (!top || !bottom) return '';
  const open = (s) => s != null && s <= SHOWS;
  const t = ['long', 'tee', 'tank'].find((k) => open(top[k])) || 'none', b = ['pants', 'shorts', 'swim'].find((k) => open(bottom[k])) || 'none';
  const parts = [t !== 'long' && TOP_WEAR[t], b !== 'pants' && BOTTOM_WEAR[b]].filter(Boolean);
  if (!parts.length) return 'For the sitting: any clothes leave it open.';
  return `For the sitting: wear ${parts.join(parts[0].includes(',') ? ', and ' : ' and ')}, so the spot is open.`;
}
