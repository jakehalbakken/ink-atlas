// What's new to try: the newest features, with how to try each one and a Show me that points at
// the control. Ticks are kept on this device (not in the project), and a feature ticks itself
// the first time it is actually used.
//
// Every batch that ships adds its features at the top of this list, with the date it went live.

export const NEW_FEATURES = [
  { id: 'hair-long', date: '2026-11-13', title: 'Long hair', how: 'Body, then Hair, then Long. Parted in the middle, falling round your face to just below the shoulders, in any colour. Match my hair from a photo picks it for longer hair too. In a pose the top moves with your head and the ends with your shoulders, and it moves aside while you work on a tattoo under it. Kept on this device.', show: 'hairLong' },
  { id: 'hair-medium', date: '2026-11-13', title: 'Medium hair', how: 'Body, then Hair, then Medium. Real strands, swept back with some height at the front, in any colour. It stays on the head in every pose. Kept on this device.', show: 'hairMedium' },
  { id: 'photo-ink', date: '2026-11-13', title: 'Your tattoos from a photo', how: 'Body, then Match a photo of me, with a photo of your back, arm or chest that shows your tattoos. Each tattoo it finds gets a box: tap one to leave it out, then Add to the body. They go on as already on me, in the same spot, and undo takes them off.', show: 'photoInk' },
  { id: 'hair-photo', date: '2026-11-13', title: 'Match my hair from a photo', how: 'Body, then Hair, then Match my hair from a photo. Use a photo with your whole head in it. Your hair colour goes on the head, with the nearest length it can show. The photo is not kept.', show: 'hairPhoto' },
  { id: 'eyes', date: '2026-11-13', title: 'Eye colour', how: 'Body, then Eyes. Pick brown, hazel, green, blue, grey or dark brown. With your face on, the first colour is the one from your photo. Kept on this device.', show: 'eyes' },
  { id: 'body-photo-part', date: '2026-11-13', title: 'Match from any photo of you', how: 'Body, then Match a photo of me. A mirror selfie, an upper body shot or a photo of your back works now: it matches the parts it can see and leaves the rest. Add another photo to fill in more. A bare back also offers its skin tone.', show: 'bodyPhoto' },
  { id: 'poses-sheet', date: '2026-11-13', title: 'As you move picture', how: 'Select a tattoo, then Share, then As you move. It shows the tattoo standing and in three poses that move that part of the body, like a flexed arm or a squat.', show: 'posesSheet' },
  { id: 'aging-sheet', date: '2026-11-13', title: 'How it ages picture', how: 'Select a tattoo, then Share, then How it ages. Fresh, healed, 10 and 20 years in one picture, to send to your artist or keep.', show: 'agingSheet' },
  { id: 'hair', date: '2026-11-13', title: 'Shaved or buzz-cut hair', how: 'Body, then Hair. Pick Shaved or Buzz cut and a colour, so the head looks less like a mannequin. Kept on this device.', show: 'hair' },
  { id: 'compare-shot', date: '2026-11-13', title: 'Before and after picture', how: 'Share, then Before and after. This view now and with your planned tattoos, side by side, ready to send.', show: 'compareShot' },
  { id: 'gap', date: '2026-11-13', title: 'Space between tattoos', how: 'Select a tattoo. Under its size, the edit panel says how far it is from the nearest other tattoo, or that they touch. Handy for keeping an even gap.', show: 'gap' },
  { id: 'skin-detail', date: '2026-11-13', title: 'Eyebrows and finer skin', how: 'Zoom in on the face: every body now has eyebrows, and the skin has fine texture up close, like pores.', show: 'skinDetail' },
  { id: 'face', date: '2026-11-13', title: 'Your face on the body', how: 'Body, then Add my face. Pick a clear photo of your face, looking straight at the camera. The head takes your face and its shape. The photo stays on this device, and Hide my face or Remove take it off.', show: 'face' },
  { id: 'body-photo', date: '2026-11-13', title: 'Match a photo of me', how: 'Body, then Match a photo of me. Pick a full-length photo taken straight on and the body takes your shape: shoulders, chest, waist, hips, thighs and how long your torso and legs are.', show: 'bodyPhoto' },
  { id: 'definition', date: '2026-11-13', title: 'More defined body', how: 'Body, then slide Muscle up or Weight down. Abs, chest, shoulders, arms and legs show more, and it follows every pose.', show: 'definition' },
  { id: 'spots', date: '2026-11-13', title: 'Try other spots', how: 'Select a tattoo, open More controls, then Try other spots. One tap moves it to the forearm, calf, ribs, shoulder blade and more, on either side.', show: 'spots' },
  { id: 'try-on', date: '2026-11-13', title: 'Try on with camera', how: 'Select a tattoo, open More controls, then Try on with camera. Point at your skin, move and size it with your fingers, curve it round your arm, then take a photo to share.', show: 'tryOn' },
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
