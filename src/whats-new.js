// What's new to try: the newest features, with how to try each one and a Show me that points at
// the control. Ticks are kept on this device (not in the project), and a feature ticks itself
// the first time it is actually used.
//
// Every batch that ships adds its features at the top of this list, with the date it went live.

export const NEW_FEATURES = [
  { id: 'skin-tone', date: '2026-11-13', title: 'Your own skin tone', how: 'Body, then the + next to the skin colours. Slide lighter or deeper and cooler or warmer, or match a photo of your skin.', show: 'skinTone' },
  { id: 'light', date: '2026-11-13', title: 'Light', how: 'Preview, then Light. See your ink in daylight, a warm room or midday sun.', show: 'light' },
  { id: 'draw-new', date: '2026-11-13', title: 'Draw in Procreate on a spot you paint', how: 'Draw in Procreate under your tattoos. Paint the spot on the body, draw on the guide in Procreate, then Copy All and Paste.', show: 'drawNew' },
  { id: 'other-side', date: '2026-11-13', title: 'Copy to other side', how: 'Select a tattoo, open More controls, then Copy to other side for a mirrored twin.', show: 'otherSide' },
  { id: 'real-size', date: '2026-11-13', title: 'Real size on screen', how: 'Select a tattoo, open More controls, then Real size on screen. Hold the iPad against your skin.', show: 'realSize' },
  { id: 'handles', date: '2026-11-13', title: 'Resize and turn handles', how: 'Select a tattoo, then drag its corner to resize or the dot above it to turn.', show: 'handles' },
  { id: 'palette', date: '2026-11-13', title: 'Colour palette for Procreate', how: 'Share, then Colour palette. Your skin and ink colours as a Procreate palette.', show: 'palette' },
  { id: 'edit-procreate', date: '2026-11-13', title: 'Edit a tattoo in Procreate', how: 'Select a tattoo, then Edit in Procreate. Copy All when done and tap Paste here.', show: 'editProcreate' },
  { id: 'pan', date: '2026-11-13', title: 'Two-finger pan', how: 'Drag two fingers away from a tattoo to slide the view. Twist clearly to turn it.', show: 'pan' },
];

const KEY = 'ia-tried';
export function readTried(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(KEY) || '[]'); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []); } catch (_) { return new Set(); }
}
export function writeTried(set, storage = globalThis.localStorage) { try { storage?.setItem(KEY, JSON.stringify([...set])); } catch (_) { /* private mode: lasts until reload */ } }
export function untriedCount(tried, list = NEW_FEATURES) { return list.filter((f) => !tried.has(f.id)).length; }
// untried first, newest first within each; tried ones stay at the bottom so they can be found again
export function ordered(tried, list = NEW_FEATURES) { return [...list.filter((f) => !tried.has(f.id)), ...list.filter((f) => tried.has(f.id))]; }
