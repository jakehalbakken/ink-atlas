// Edit a tattoo's artwork in Procreate and bring it back to the same tattoo.
//
// What a web app on iPad can do: hand the picture to the share sheet (pick Procreate there),
// remember which tattoo it belongs to, and take the edited picture back from the clipboard
// or from Photos/Files. What it cannot do: open Procreate by itself, or receive a picture that
// Procreate shares (iPadOS does not list web apps in the share sheet). So the way back is
// "Copy All" in Procreate, then one tap on Paste in Ink Atlas.
//
// The pending edit lives in this device's local storage, outside the project, so it survives
// iPadOS closing Ink Atlas while you draw, and it needs no change to the saved project format.

const KEY = 'ia-procreate-edit';

export function readPending(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(KEY) || 'null');
    if (!v || typeof v.tattooId !== 'string' || typeof v.name !== 'string') return null;
    const out = { tattooId: v.tattooId, name: v.name.slice(0, 100), at: Number(v.at) || 0, width: Number(v.width) || 0, height: Number(v.height) || 0 };
    if (v.kind === 'new') {
      // a new drawing: where the guide square sits on the body
      const p = v.patch, nums = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
      if (!p || !nums(p.pos) || !nums(p.normal) || !(p.width > 0 && p.width < 1) || ![1, -1].includes(p.sx) || ![1, -1].includes(p.sy)) return null;
      out.kind = 'new'; out.patch = { pos: p.pos, normal: p.normal, width: p.width, sx: p.sx, sy: p.sy };
    }
    return out;
  } catch (_) { return null; }
}
export function writePending(p, storage = globalThis.localStorage) {
  try { if (p) storage?.setItem(KEY, JSON.stringify(p)); else storage?.removeItem(KEY); } catch (_) { /* private mode: the bar still works until reload */ }
}

// A file name Procreate shows as the canvas name.
export function editFileName(name) {
  const base = String(name || 'Tattoo').replace(/\(sample\)/i, '').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Tattoo';
  return base + '.png';
}

// The artwork as it looks on the body (mirror and vertical flip applied), on a clear
// background, at the size it is stored. Returns a PNG data URL. Synchronous on purpose: the
// share sheet only opens straight from a tap, so nothing slow may run before it.
export function artworkAsSeen(img, { mirror = false, upsideDown = false } = {}) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.translate(mirror ? c.width : 0, upsideDown ? c.height : 0); g.scale(mirror ? -1 : 1, upsideDown ? -1 : 1);
  g.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

// The first picture on the clipboard, as a Blob, or null. Safari asks the person to confirm
// with its own small Paste button; that is the second and last tap.
export async function clipboardImage(clip = globalThis.navigator?.clipboard) {
  if (!clip?.read) return null;
  const items = await clip.read();
  for (const item of items) {
    const type = item.types.find((t) => /^image\/(png|jpeg|webp|heic|tiff)$/.test(t)) || item.types.find((t) => t.startsWith('image/'));
    if (type) return await item.getType(type);
  }
  return null;
}

export function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('Could not read the picture')); r.readAsDataURL(blob); });
}

// Fit a returned picture into the size the app stores artwork at, keeping transparency.
export async function normalisePicture(blob, max = 1600) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be opened.')); i.src = url; });
    const w = im.naturalWidth, h = im.naturalHeight, ratio = w / h;
    if (!(w > 0 && h > 0) || w * h > 24e6 || ratio < 0.05 || ratio > 20) throw new Error('Use a picture under 24 megapixels with an aspect ratio between 1:20 and 20:1.');
    const s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL('image/png'), aspect: c.width / c.height, width: c.width, height: c.height };
  } finally { URL.revokeObjectURL(url); }
}
