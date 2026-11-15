// Design versions: each tattoo keeps the artwork it had before every change (an edit in Procreate,
// a cleanup), so two versions can be compared on the body and an earlier one brought back.
// Stored on the tattoo as optional fields: versions = [{ img, aspect, flip, top, name }] (the
// earlier ones, oldest first, at most MAX) and vName, the current one's name ("v3"). Names stay
// with their artwork, so bringing v1 back keeps calling it v1. Pure maths on plain objects.

export const MAX_VERSIONS = 12;
const num = (n) => { const m = /^v(\d{1,3})$/.exec(n || ''); return m ? +m[1] : 0; };

// the current artwork's name: its own, or one more than the versions before it
export function currentName(t) { return t.vName || 'v' + (Math.max(0, ...(t.versions || []).map((v) => num(v.name))) + 1); }

function entryOf(t) { return { img: t.img, aspect: t.aspect, flip: !!t.flip, top: !!t.imageTopDown, name: currentName(t) }; }

// before: the tattoo as it was; after: the same tattoo once its artwork changed. Keeps the old
// artwork as a version on after and names the new one. Nothing happens if the picture is the same.
export function keepVersion(before, after) {
  if (!before || !after || before.img === after.img) return after;
  const list = (before.versions || []).filter((v) => v.img !== after.img), old = entryOf(before);
  if (!list.some((v) => v.img === old.img)) list.push(old);
  while (list.length > MAX_VERSIONS) list.shift();
  const top = Math.max(num(old.name), ...list.map((v) => num(v.name)), ...(before.versions || []).map((v) => num(v.name)));
  after.versions = list; after.vName = 'v' + (top + 1);
  return after;
}

// bring version i back: it becomes the current artwork and the current one joins the list
export function useVersion(t, i) {
  const list = t.versions || [], v = list[i]; if (!v) return false;
  const now = entryOf(t), rest = list.filter((_, k) => k !== i);
  rest.push(now);
  t.versions = rest.slice(-MAX_VERSIONS);
  t.img = v.img; t.aspect = v.aspect; t.flip = !!v.flip; t.imageTopDown = !!v.top; t.vName = v.name;
  return true;
}

// every version, oldest first by name, with the current one marked
export function versionList(t) {
  const all = [...(t.versions || []).map((v, i) => ({ ...v, index: i, now: false })), { ...entryOf(t), index: -1, now: true }];
  return all.sort((a, b) => num(a.name) - num(b.name));
}

// for a saved project: good entries kept (with a picture that exists), bad ones dropped
export function cleanVersions(t, hasImage) {
  if (t.versions !== undefined) {
    const ok = Array.isArray(t.versions) ? t.versions.filter((v) => v && typeof v === 'object' && typeof v.img === 'string' && hasImage(v.img) && Number.isFinite(v.aspect) && v.aspect >= 0.05 && v.aspect <= 20).slice(-MAX_VERSIONS)
      .map((v) => ({ img: v.img, aspect: v.aspect, flip: !!v.flip, top: !!v.top, name: num(v.name) ? v.name : '' })) : [];
    // a version with no good name gets the lowest free one
    const used = new Set(ok.map((v) => v.name).filter(Boolean)); let n = 1;
    for (const v of ok) if (!v.name) { while (used.has('v' + n)) n++; v.name = 'v' + n; used.add(v.name); }
    if (ok.length) t.versions = ok; else delete t.versions;
  }
  if (t.vName !== undefined && (!num(t.vName) || (t.versions || []).some((v) => v.name === t.vName))) delete t.vName;
  return t;
}
