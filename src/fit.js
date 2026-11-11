// Every body-shape slider, in the order the Body panel shows them.
// Values run -1..1 and 0 is the standard body. `key` names the baked MakeHuman
// target pair in body.js (key0 = less, key1 = more); `cup` and `firm` drive the
// breast grid. `when` hides a slider that does nothing for the chosen body type.
export const FIT_GROUPS = [
  { title: 'Torso', items: [
    { key: 'shoulders', label: 'Shoulder width' },
    { key: 'chest', label: 'Chest size' },
    { key: 'waist', label: 'Waist' },
    { key: 'hips', label: 'Hips' },
    { key: 'torsoLen', label: 'Torso length' },
    { key: 'depth', label: 'Depth, front to back' },
    { key: 'belly', label: 'Belly' },
    { key: 'abs', label: 'Abs definition' },
    { key: 'back', label: 'Back muscle' },
    { key: 'butt', label: 'Buttocks' },
  ] },
  { title: 'Chest', items: [
    { key: 'cup', label: 'Breast size', when: 'breasts' },
    { key: 'firm', label: 'Breast firmness', when: 'breasts' },
    { key: 'breastGap', label: 'Breast spacing', when: 'breasts' },
    { key: 'pecs', label: 'Pecs', when: 'pecs' },
    { key: 'nippleSize', label: 'Nipple size' },
  ] },
  { title: 'Arms', items: [
    { key: 'upperArmLen', label: 'Upper arm length' },
    { key: 'foreArmLen', label: 'Forearm length' },
    { key: 'upperArmSize', label: 'Upper arm size' },
    { key: 'hand', label: 'Hand size' },
  ] },
  { title: 'Legs', items: [
    { key: 'thighLen', label: 'Thigh length' },
    { key: 'shinLen', label: 'Shin length' },
    { key: 'thighSize', label: 'Thigh size' },
    { key: 'calfSize', label: 'Calf size' },
    { key: 'foot', label: 'Foot size' },
  ] },
  { title: 'Neck', items: [
    { key: 'neckLen', label: 'Neck length' },
    { key: 'neckSize', label: 'Neck thickness' },
  ] },
  { title: 'Genitals', when: 'male', toggle: 'genitals', items: [
    { key: 'penisLen', label: 'Length' },
    { key: 'penisGirth', label: 'Girth' },
    { key: 'testicles', label: 'Testicles' },
  ] },
];

export function fitVisible(when, figure) {
  if (when === 'breasts') return figure !== 'male';
  if (when === 'pecs') return figure !== 'female';
  if (when === 'male') return figure === 'male';
  return true;
}

// v47 saved its body fit as multipliers around 1 (and 0..1 relief). Map onto our sliders.
export function fitFromV47(bf) {
  const fit = {}; if (!bf || typeof bf !== 'object') return fit;
  const span = { shoulders: 0.14, chest: 0.18, waist: 0.2, hips: 0.14, depth: 0.16 };
  for (const k of Object.keys(span)) if (typeof bf[k] === 'number') fit[k] = Math.max(-1, Math.min(1, (bf[k] - 1) / span[k]));
  for (const k of ['abs', 'back']) if (typeof bf[k] === 'number') fit[k] = Math.max(0, Math.min(1, bf[k]));
  for (const k of Object.keys(fit)) if (!fit[k]) delete fit[k];
  return fit;
}
