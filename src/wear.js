// How it holds up here: a short, plain note on how a spot treats a tattoo over the years, from
// the usual artist advice: hands, fingers and feet fade fastest, sun fades open skin, creases
// blur fine lines, and skin that changes with weight can stretch a design. Keyed by the place
// names of the pain map (pain.js). Pure lookup.

const NOTES = [
  { places: ['Fingers'], level: 3, text: 'Fades fastest here: fingers are washed and used all day, so plan on touch-ups every year or two.' },
  { places: ['Hand', 'Foot'], level: 3, text: 'Fades faster here: the skin is washed, rubbed and renewed a lot, so plan on touch-ups.' },
  { places: ['Wrist', 'Ankle'], level: 2, text: 'Fades a little faster here: straps, socks and shoes rub it.' },
  { places: ['Elbow', 'Knee', 'Inner elbow', 'Back of knee', 'Armpit'], level: 2, text: 'The skin creases here, so fine lines blur sooner. Bolder lines last longer.' },
  { places: ['Face', 'Head', 'Side of neck', 'Back of neck', 'Throat', 'Forearm, outside', 'Shoulder', 'Upper arm, outside', 'Collarbone', 'Shin', 'Calf, outside'], level: 1, text: 'This spot sees a lot of sun. Sunscreen keeps it sharp for longer.' },
  { places: ['Stomach'], level: 1, text: 'Skin here changes with weight, which can stretch a design over the years.' },
];
const BY = new Map(); for (const n of NOTES) for (const p of n.places) BY.set(p, n);

// place: the pain map's place name under most of the tattoo. Returns { level, text } (level 0
// holds up well, 3 fades fastest), or null with no place.
export function wearAt(place) {
  if (!place || place === 'Body') return null;
  return BY.get(place) || { level: 0, text: 'Holds up well here: little sun, rubbing or stretch.' };
}
