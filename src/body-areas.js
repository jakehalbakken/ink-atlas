// Folders by body area for the Layers panel (2026-11-22, Jake: "group artwork layers into, I guess,
// subfolders. So for example, if I have a bunch of pieces that I want to look at on my thigh and be
// able to see them all, like I can click on like the thigh folder"). Pure maths and state changes:
// the place under each tattoo comes from the pain map's plain names (pain.js), the caller says which
// side it is on, and Sort into areas files every tattoo that is not in a folder of your own into a
// folder for its area. A folder made this way carries `area` (its area's own name, kept when the
// folder is renamed), an optional field on the existing groups list, so no migration.

// The areas in the order the panel lists them, head to foot, left before right.
const SIDED = ['upper arm', 'forearm', 'hand', 'ribs', 'thigh', 'lower leg', 'foot'];
export const AREA_ORDER = ['Head', 'Neck', 'Chest', 'Stomach', 'Back',
  ...SIDED.slice(0, 4).flatMap((a) => [`Left ${a}`, `Right ${a}`]), 'Buttocks',
  ...SIDED.slice(4).flatMap((a) => [`Left ${a}`, `Right ${a}`])];

// The area a place name from the pain map belongs to, for one side of the body ('left' or 'right',
// the person's own). Returns a name from AREA_ORDER, or null when the place is unknown.
export function areaFor(place, side) {
  if (typeof place !== 'string' || !place) return null;
  const S = side === 'right' ? 'Right' : 'Left';
  const p = place.toLowerCase();
  if (p === 'face' || p === 'head') return 'Head';
  if (/neck|throat/.test(p)) return 'Neck';
  if (/finger|hand/.test(p)) return `${S} hand`;
  if (/forearm|wrist|elbow/.test(p)) return `${S} forearm`;
  if (/shoulder|bicep|upper arm|back of arm|inner arm|armpit/.test(p)) return `${S} upper arm`;
  if (/rib/.test(p)) return `${S} ribs`;
  if (/chest|sternum|collarbone/.test(p)) return 'Chest';
  if (/stomach|groin/.test(p)) return 'Stomach';
  if (/buttock/.test(p)) return 'Buttocks';
  if (/thigh|hip/.test(p)) return `${S} thigh`;
  if (/calf|shin|knee|ankle/.test(p)) return `${S} lower leg`;
  if (/back|spine/.test(p)) return 'Back';
  if (/foot|toe/.test(p)) return `${S} foot`;
  return null;
}
const rank = (area) => { const i = AREA_ORDER.indexOf(area); return i < 0 ? AREA_ORDER.length : i; };
const newId = () => `group-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
const validGroups = (state) => (Array.isArray(state.groups) ? state.groups : []).filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string');

// What Sort into areas would do, without doing it: { move: n tattoos that would change folder,
// folders: n area folders there would be }. areaOf(t) gives each tattoo's area name, or null.
export function sortPlan(state, areaOf) {
  const groups = validGroups(state), own = new Set(groups.filter((g) => !g.area).map((g) => g.id)), byId = new Map(groups.map((g) => [g.id, g]));
  let move = 0; const areas = new Set();
  for (const t of state.tattoos) {
    if (t.group && own.has(t.group)) continue; // a folder of your own keeps what you put in it
    const a = areaOf(t); if (!a) continue;
    areas.add(a); const now = t.group && byId.get(t.group); if (!now || now.area !== a) move++;
  }
  return { move, folders: areas.size };
}

// File every tattoo that is loose or in an area folder into the folder for its area (an area folder
// already there is used, even renamed), drop area folders left empty, and list the area folders
// head to foot after your own folders. The tattoos' own order (which is drawn over which) is left
// exactly as it was. Returns { moved, folders, ids: the area folders' ids head to foot }.
export function sortIntoAreas(state, areaOf) {
  const groups = validGroups(state), own = groups.filter((g) => !g.area), ownIds = new Set(own.map((g) => g.id));
  const areaGroups = new Map(); for (const g of groups) if (g.area && !areaGroups.has(g.area)) areaGroups.set(g.area, g);
  const byId = new Map(groups.map((g) => [g.id, g]));
  let moved = 0;
  for (const t of state.tattoos) {
    if (t.group && ownIds.has(t.group)) continue;
    const a = areaOf(t); if (!a) continue;
    let g = areaGroups.get(a); if (!g) { g = { id: newId(), name: a, area: a }; areaGroups.set(a, g); byId.set(g.id, g); }
    const before = t.group && byId.get(t.group); if (!before || before.id !== g.id) moved++;
    t.group = g.id;
  }
  const used = new Set(state.tattoos.map((t) => t.group).filter(Boolean));
  const areaList = [...areaGroups.values()].filter((g) => used.has(g.id)).sort((x, y) => rank(x.area) - rank(y.area));
  // keep anything odd in the list (a group without a usable id or name) untouched, after the rest
  const odd = (Array.isArray(state.groups) ? state.groups : []).filter((g) => !(g && typeof g.id === 'string' && typeof g.name === 'string'));
  const dropped = new Set(groups.filter((g) => g.area && !areaList.includes(g)).map((g) => g.id));
  for (const t of state.tattoos) if (t.group && dropped.has(t.group)) delete t.group;
  state.groups = [...own, ...areaList, ...odd];
  return { moved, folders: areaList.length, ids: areaList.map((g) => g.id) };
}

// Show only this folder: every tattoo in it shown, every other tattoo hidden. Returns how many changed.
export function soloFolder(state, groupId) {
  let n = 0; for (const t of state.tattoos) { const want = t.group !== groupId; if (!!t.hidden !== want) { t.hidden = want; n++; } } return n;
}
// Take every tattoo out of a folder and drop the folder; the tattoos stay where they are on the body.
export function unfolder(state, groupId) {
  for (const t of state.tattoos) if (t.group === groupId) delete t.group;
  state.groups = (Array.isArray(state.groups) ? state.groups : []).filter((g) => !(g && g.id === groupId));
}
// Rename a folder (60 characters at most). Its area, if it has one, stays, so a later sort still uses it.
export function renameFolder(state, groupId, name) {
  const label = String(name || '').trim().slice(0, 60); if (!label) return false;
  const g = (state.groups || []).find((x) => x && x.id === groupId); if (!g || g.name === label) return false;
  g.name = label; return true;
}

// The spot and size to frame for several tattoos at once: their middle, the way they face on
// average, and how much body to show round them. spots: [{ pos, normal, ext }] from the app.
export function frameFor(spots) {
  const s = spots.filter((x) => x && Array.isArray(x.pos) && Array.isArray(x.normal)); if (!s.length) return null;
  const c = [0, 0, 0], n = [0, 0, 0];
  for (const x of s) for (let i = 0; i < 3; i++) { c[i] += x.pos[i] / s.length; n[i] += x.normal[i]; }
  let L = Math.hypot(n[0], n[1], n[2]);
  // pieces on opposite sides (front and back of a thigh) cancel out: face the first one's way
  if (L < 0.35 * s.length) { n.splice(0, 3, ...s[0].normal); L = Math.hypot(n[0], n[1], n[2]) || 1; }
  let ext = 0; for (const x of s) ext = Math.max(ext, Math.hypot(x.pos[0] - c[0], x.pos[1] - c[1], x.pos[2] - c[2]) * 2 + (x.ext || 0));
  return { pos: c, normal: n.map((v) => v / L), ext };
}

// A tattoo filed by where it sits follows itself to the right folder when it moves to another area
// (dragged, Try other spots, Copy to other side...). moves: [{ id, was }], `was` the area its old
// place was in. Only a tattoo in an area folder for that old area moves, so one you put in another
// folder by hand stays there. A missing area folder is made, placed head to foot among the area
// folders. Returns the ids of the tattoos that changed folder.
export function followAreas(state, moves, areaOf) {
  const groups = validGroups(state), byId = new Map(groups.map((g) => [g.id, g])), out = [];
  for (const { id, was } of moves) {
    const t = state.tattoos.find((x) => x.id === id), g = t && t.group && byId.get(t.group);
    if (!g || !g.area || g.area !== was) continue;
    const now = areaOf(t); if (!now || now === g.area) continue;
    let to = groups.find((x) => x.area === now);
    if (!to) {
      to = { id: newId(), name: now, area: now }; groups.push(to); byId.set(to.id, to);
      const list = Array.isArray(state.groups) ? state.groups : (state.groups = []);
      const at = list.findIndex((x) => x && x.area && rank(x.area) > rank(now));
      list.splice(at < 0 ? list.length : at, 0, to);
    }
    t.group = to.id; out.push(id);
  }
  return out;
}

// Area folders are made by Sort by area, so one left empty (its last tattoo deleted, merged or moved
// away) goes; a folder of your own stays even when empty. Returns how many went.
export function dropEmptyAreas(state) {
  if (!Array.isArray(state.groups)) return 0;
  const used = new Set(state.tattoos.map((t) => t.group).filter(Boolean)), n = state.groups.length;
  state.groups = state.groups.filter((g) => !(g && g.area && typeof g.id === 'string' && !used.has(g.id)));
  return n - state.groups.length;
}
