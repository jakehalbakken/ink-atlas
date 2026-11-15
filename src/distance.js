// How a tattoo reads from a distance. An eye in everyday light tells apart two lines about 1.5
// minutes of arc apart (perfect eyesight in perfect light does 1). So from d metres away, detail
// smaller than d x 0.44 mm runs together. Pure maths, so it can be checked on its own.

export const EYE_RAD = (1.5 / 60) * (Math.PI / 180);

// The everyday distances the picture shows, nearest first.
export const DISTANCES = [
  { m: 0.3, label: 'Close up', ft: '1 ft' },
  { m: 0.9, label: 'Across a table', ft: '3 ft' },
  { m: 3, label: 'Across a room', ft: '10 ft' },
  { m: 9, label: 'Across the street', ft: '30 ft' },
];

// The smallest detail (mm) that still shows from d metres.
export function detailMm(d) { return d * 1000 * EYE_RAD; }

// The farthest distance (metres) at which detail of this size (mm) still shows.
export function seenUpTo(mm) { return mm / (1000 * EYE_RAD); }

// How far to shrink a picture whose pixels are pxMm across so one pixel is the detail an eye
// sees from d metres; 1 means it stays as it is.
export function shrinkFor(pxMm, d) { return Math.min(1, pxMm / detailMm(d)); }

const metric = (m) => (m < 1 ? `${Math.round(m * 10) * 10} cm` : `${m < 10 ? Math.round(m * 10) / 10 : Math.round(m)} m`);
const feet = (m) => { const f = m / 0.3048; return f < 1 ? 'a foot' : `${f < 10 ? Math.round(f * 2) / 2 : Math.round(f)} ft`; };

// One plain line from the finest lines and gaps in the artwork at its size (mm, either may be
// null). Returns { text, upTo } with upTo in metres, or null with nothing to go on.
export function distanceText(lineMm, gapMm) {
  const f = [lineMm, gapMm].filter((v) => Number.isFinite(v) && v > 0);
  if (!f.length) return null;
  const finest = Math.min(...f), upTo = seenUpTo(finest), kind = lineMm != null && gapMm != null ? 'lines and gaps' : lineMm != null ? 'lines' : 'gaps';
  const far = DISTANCES[DISTANCES.length - 1].m;
  if (upTo >= far) return { text: `Its finest ${kind} stay clear even from across the street.`, upTo };
  const where = upTo < 0.6 ? 'past arm’s length' : `from about ${feet(upTo)} (${metric(upTo)}) away`;
  return { text: `Its finest ${kind} (about ${Math.round(finest * 10) / 10} mm) run together ${where}; further off it reads as its bolder shapes.`, upTo };
}

// Soften an RGBA picture as an eye would from further off: three box blurs in a row, which come
// close to a Gaussian, wide enough that detail of `detailPx` pixels runs together. In place.
export function softenRGBA(data, w, h, detailPx) {
  const sigma = 0.45 * detailPx; if (!(sigma > 0.5)) return data;
  const box = Math.max(1, Math.round(Math.sqrt(4 * sigma * sigma + 1))), r = box >> 1, n = 2 * r + 1;
  const tmp = new Float32Array(Math.max(w, h) * 4);
  const pass = (len, count, step, line) => {
    for (let l = 0; l < count; l++) {
      const base = l * line;
      for (let i = 0; i < len; i++) { const o = base + i * step; tmp[i * 4] = data[o]; tmp[i * 4 + 1] = data[o + 1]; tmp[i * 4 + 2] = data[o + 2]; tmp[i * 4 + 3] = data[o + 3]; }
      for (let c = 0; c < 4; c++) {
        let s = 0; for (let k = -r; k <= r; k++) s += tmp[Math.min(len - 1, Math.max(0, k)) * 4 + c];
        for (let i = 0; i < len; i++) {
          data[base + i * step + c] = s / n;
          s += tmp[Math.min(len - 1, i + r + 1) * 4 + c] - tmp[Math.max(0, i - r) * 4 + c];
        }
      }
    }
  };
  for (let k = 0; k < 3; k++) { pass(w, h, 4, w * 4); pass(h, w, w * 4, 4); }
  return data;
}
