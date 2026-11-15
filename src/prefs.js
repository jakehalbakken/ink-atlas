// Settings that follow you: the look of the body and the few choices kept per device
// (light, hair, beard, body hair, eye colour, hourly rate) gathered into one small object, so
// a signed-in person gets them on every device. Pure apart from reading and writing the
// storage it is handed. The face photo never travels: it stays on the device it was taken on.
//
// Kept in the account's user details as { at, s }: at is when they last changed (ms), s the
// settings. Kept small on purpose, since those details ride along with every sign-in.

import { LIGHTS as LIGHT_LIST } from './lighting.js';
import { HAIR_STYLES, HAIR_COLOURS as HAIR_HEX } from './hair.js';
import { BEARD_STYLES as BEARDS } from './beard.js';

const LIGHTS = LIGHT_LIST.map((l) => l.id);
const HAIR_COLOURS = [...Object.keys(HAIR_HEX), 'photo'];
const BODY_HAIR = ['none', 'light', 'full'];
const EYES = ['dark', 'brown', 'hazel', 'green', 'blue', 'grey'];
const HEX = /^#[0-9a-f]{6}$/i;

// Each setting: its storage key, how to read it from storage, and how to check a value.
const DEFS = {
  light: { key: 'ia-light', read: (v) => v, ok: (v) => LIGHTS.includes(v) },
  hair: {
    key: 'ia-hair', read: (v) => { try { return JSON.parse(v); } catch { return null; } }, write: (v) => JSON.stringify(v),
    ok: (v) => !!v && typeof v === 'object' && HAIR_STYLES.includes(v.style) && HAIR_COLOURS.includes(v.colour) && (v.colour !== 'photo' || HEX.test(v.hex || '')) && (v.hex == null || HEX.test(v.hex)),
    clean: (v) => ({ style: v.style, colour: v.colour, hex: v.hex && HEX.test(v.hex) ? v.hex.toLowerCase() : null }),
  },
  beard: { key: 'ia-beard', read: (v) => v, ok: (v) => BEARDS.includes(v) },
  bodyHair: { key: 'ia-body-hair', read: (v) => v, ok: (v) => BODY_HAIR.includes(v) },
  eyes: { key: 'ia-eyes', read: (v) => v, ok: (v) => EYES.includes(v) },
  rate: { key: 'ia-rate', read: (v) => Math.round(+v), ok: (v) => Number.isFinite(v) && v > 0 && v < 5000 },
};
export const PREF_NAMES = Object.keys(DEFS);

// Only the settings that pass their check, cleaned; anything else is dropped.
export function cleanPrefs(o) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (const [k, d] of Object.entries(DEFS)) {
    const v = o[k];
    if (v != null && d.ok(v)) out[k] = d.clean ? d.clean(v) : v;
  }
  return out;
}

export function readPrefs(storage = globalThis.localStorage) {
  const raw = {};
  for (const [k, d] of Object.entries(DEFS)) {
    let v = null; try { v = storage?.getItem(d.key); } catch { /* no storage */ }
    if (v != null) raw[k] = d.read(v);
  }
  return cleanPrefs(raw);
}

// Write settings into storage. A setting missing from p is cleared, so the device ends up
// exactly as the settings say. Returns the names that changed.
export function writePrefs(p, storage = globalThis.localStorage) {
  const want = cleanPrefs(p), have = readPrefs(storage), changed = [];
  for (const [k, d] of Object.entries(DEFS)) {
    if (same(want[k], have[k])) continue;
    try { if (want[k] == null) storage?.removeItem(d.key); else storage?.setItem(d.key, d.write ? d.write(want[k]) : String(want[k])); } catch { /* private mode */ }
    changed.push(k);
  }
  return changed;
}

export function same(a, b) { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }
export const samePrefs = (a, b) => same(cleanPrefs(a), cleanPrefs(b));

// What to do when signing in, or when the account's copy is read again:
// 'take' the account's settings, 'send' this device's, or 'none'.
// localAt is when this device's settings last changed (0 if never), remote is { at, s } or null.
export function decide(local, localAt, remote) {
  const r = remote && typeof remote === 'object' && Number.isFinite(remote.at) ? remote : null;
  if (!r) return Object.keys(cleanPrefs(local)).length ? 'send' : 'none';
  if (samePrefs(local, r.s)) return 'none';
  // a device that never changed anything takes the account's settings
  if (!localAt || r.at > localAt) return 'take';
  return 'send';
}
