// Light to look at the body in. Ink reads very differently under a warm lamp, in daylight and
// in hard midday sun, so the preview can switch between them. Only the view changes; it is
// kept on this device, not in the project.

export const LIGHTS = [
  { id: 'studio', label: 'Studio',
    hemi: [0xffffff, 0x4a4652, 1.15], key: [0xfff4ea, 2.1, [-0.7, 0.9, 0.6]], rim: [0xb9c4ff, 1.0], rim2: [0xffd9c4, 0.5] },
  { id: 'day', label: 'Daylight',
    hemi: [0xdde8ff, 0x77736a, 1.55], key: [0xf6f8ff, 2.25, [-0.35, 1.3, 0.55]], rim: [0xdfe8ff, 0.55], rim2: [0xfff0e0, 0.3] },
  { id: 'warm', label: 'Warm room',
    hemi: [0xffe6cc, 0x3a2e26, 0.9], key: [0xffcf9a, 2.0, [-1.0, 0.25, 0.45]], rim: [0xffb27a, 0.3], rim2: [0xffd2a8, 0.2] },
  { id: 'sun', label: 'Midday sun',
    hemi: [0xbcd4ff, 0x4a443a, 0.38], key: [0xfff6e6, 3.9, [0.12, 1.0, 0.1]], rim: [0xffffff, 0.15], rim2: [0xffffff, 0] },
];
const KEY = 'ia-light';

export function readLight(storage = globalThis.localStorage) {
  try { const v = storage?.getItem(KEY); return LIGHTS.some((l) => l.id === v) ? v : 'studio'; } catch (_) { return 'studio'; }
}
export function writeLight(id, storage = globalThis.localStorage) { try { storage?.setItem(KEY, id); } catch (_) { /* private mode: lasts until reload */ } }

// lights: { hemi, key, rim, rim2 } three.js lights. key sits on the camera, so its position is
// in view space: x right, y up, z towards you.
export function applyLight(id, lights) {
  const L = LIGHTS.find((l) => l.id === id) || LIGHTS[0];
  lights.hemi.color.setHex(L.hemi[0]); lights.hemi.groundColor.setHex(L.hemi[1]); lights.hemi.intensity = L.hemi[2];
  lights.key.color.setHex(L.key[0]); lights.key.intensity = L.key[1]; lights.key.position.set(...L.key[2]);
  lights.rim.color.setHex(L.rim[0]); lights.rim.intensity = L.rim[1];
  lights.rim2.color.setHex(L.rim2[0]); lights.rim2.intensity = L.rim2[1];
  return L.id;
}
