// Where it sits: a tattoo's place said the way an artist measures it before the stencil goes
// on. On an arm or a leg, how far its centre is along the limb from the nearest joint ("3.2 in
// below the elbow"); on the torso, how far from the centre line and down from the base of the
// neck or from the navel. Distances are straight, on the standing body, in real size. Pure maths.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// How far along the segment a..b the point p sits (0 at a, 1 at b) and the length a..b.
export function along(p, a, b) {
  const ab = sub(b, a), L = len(ab) || 1e-9;
  return { t: dot(sub(p, a), ab) / (L * L), L };
}

// "3.2 in (8 cm)" from body units.
export function measure(units, toCm) {
  const cm = units * toCm, inches = cm / 2.54;
  return `${inches < 10 ? inches.toFixed(1) : Math.round(inches)} in (${Math.round(cm)} cm)`;
}

// The limb a place is on, with its two joints in order down the limb and the plain names of
// the ends: [upperJoint, lowerJoint, upperName, lowerName].
function limbOf(place) {
  if (/Forearm|Wrist|elbow|Elbow/.test(place)) return ['elbow', 'wrist', 'the elbow', 'the wrist bone'];
  if (/Upper arm|Bicep|Back of arm|Inner arm|Shoulder|Armpit/.test(place)) return ['shoulder', 'elbow', 'the top of the shoulder', 'the elbow'];
  if (/Thigh|Inner thigh|Back of thigh|Hip/.test(place)) return ['hip', 'knee', 'the hip joint', 'the middle of the knee'];
  if (/Calf|Shin|Knee|Ankle/.test(place)) return ['knee', 'ankle', 'the middle of the knee', 'the ankle bone'];
  return null;
}

const TORSO = /Chest|Sternum|Collarbone|Stomach|Ribs|back|Spine|Buttock/;

// p: the tattoo's centre (standing body); place: the plain place name under it; side: 'left'
// or 'right' (the person's own); j: joints for that side { shoulder, elbow, wrist, hip, knee,
// ankle } plus neck (base of the neck) and navel; toCm: centimetres per body unit.
// Returns { where, line } or null: where is the part ("Left forearm, outside"), line the full
// sentence.
export function whereItSits({ p, place, side, j, toCm }) {
  if (!place) return null;
  const Side = side === 'left' ? 'Left' : 'Right';
  const lower = place.charAt(0).toLowerCase() + place.slice(1);
  const limb = limbOf(place);
  if (limb && !/Back of neck/.test(place)) {
    const [ua, la, un, ln] = limb, a = j[ua], b = j[la]; if (!a || !b) return null;
    const { t, L } = along(p, a, b), where = `${Side} ${lower}`;
    // the nearer end, unless the centre is right at a joint
    if (t < 0.5) {
      const d = t * L;
      if (Math.abs(d) * toCm < 1) return { where, line: `${where}: centred on ${un}.` };
      return { where, line: `${where}: centre ${measure(Math.abs(d), toCm)} ${d >= 0 ? 'below' : 'above'} ${un}.` };
    }
    const d = (1 - t) * L;
    if (Math.abs(d) * toCm < 1) return { where, line: `${where}: centred on ${ln}.` };
    return { where, line: `${where}: centre ${measure(Math.abs(d), toCm)} ${d >= 0 ? 'above' : 'below'} ${ln}.` };
  }
  if (TORSO.test(place) && j.neck) {
    const x = Math.abs(p[0]), centred = x * toCm < 1.2, back = /back|Spine|Buttock/.test(place);
    const across = centred ? (back ? 'on the spine' : 'on the centre line') : `${measure(x, toCm)} ${side} of ${back ? 'the spine' : 'centre'}`;
    // from the navel on the stomach, otherwise down from the base of the neck
    let down;
    if (!back && j.navel && /Stomach/.test(place)) {
      const dy = p[1] - j.navel[1];
      down = Math.abs(dy) * toCm < 1 ? 'level with the navel' : `${measure(Math.abs(dy), toCm)} ${dy > 0 ? 'above' : 'below'} the navel`;
    } else {
      const dy = j.neck[1] - p[1];
      down = `${measure(Math.max(0, dy), toCm)} below the base of the neck`;
    }
    const part = centred ? place : `${place}, ${side} side`;
    return { where: part, line: `${part}: centre ${across}, ${down}.` };
  }
  // hands, feet, neck and head: the part and the side
  const mid = Math.abs(p[0]) * toCm < 1.2;
  const where = mid ? place : `${place}, ${side} side`;
  return { where, line: where + '.' };
}
