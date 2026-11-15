// Your account: sign in, the projects kept in it, keeping the project on screen saved there,
// opening it on another device, and sending a copy to someone by link.
//
// The project on screen always lives on this device first (src/store.js); the account is a
// second copy kept in step with it. Rules that keep work safe:
// - A project is tied to one project in the account ("bound"). After every save on this device
//   the change goes up, but only if nobody changed that project elsewhere since: otherwise
//   this device's version goes up as a separate project and both are kept.
// - Coming back to the app, a newer version from another device opens by itself, but only
//   when this device has nothing unsent. The version it replaces is kept as a recovery copy.
// - Opening a different project keeps the one on screen (in Projects on this device, unless it
//   is already safe in the account), and work from this device goes into an account only when
//   its owner says so.
// - A project worked on together (shared) is checked every few seconds while it is open, and
//   someone else's changes come in by themselves when this device has nothing unsent. When
//   both changed it, the two are put together (src/merge.js) instead of making a copy.
// - Signed out, or with accounts not set up, nothing here runs and the app is as it was.
import { cloudConfigured, emailCodes, openCloud, openShare, plainError } from './cloud.js';
import { mergeStates, commentsOnto, withoutComments } from './merge.js';
import { changesBetween } from './changes.js';
import { readPrefs, cleanPrefs, decide } from './prefs.js';

const BIND = 'ia-cloud-bind', BASE = 'ia-cloud-base', SEEN = 'ia-cloud-seen', CHANGES = 'ia-cloud-changes', LIVE_MS = 4000;
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } },
};
const sigOf = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; };
function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
  return n;
}
const when = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const now = new Date(); const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); return (d.toDateString() === now.toDateString() ? 'Today' : d.toLocaleDateString([], { month: 'short', day: 'numeric' })) + ', ' + t; };
const deviceName = () => { const u = navigator.userAgent || ''; if (/iPad|Macintosh/.test(u) && navigator.maxTouchPoints > 1) return 'iPad'; if (/iPhone/.test(u)) return 'iPhone'; if (/Android/.test(u)) return 'phone'; if (/Mac/.test(u)) return 'Mac'; return 'this device'; };

// api: { snapshot() -> {state, images}, open(state, images, name, {keepCopy, reason}) -> {dropped}, newProject(name),
//        projectName(), setSaved(text, bad), toast(msg, action, fn), saveNow() }
export function createAccount(api) {
  const btn = document.getElementById('accountBtn');
  const shareCard = document.getElementById('cLink');
  if (!cloudConfigured) { if (btn) btn.hidden = true; if (shareCard) shareCard.hidden = true; return { configured: false, saved() {}, start() {}, unbind() {}, open() {}, sendLink() {}, status: () => ({ configured: false }) }; }
  btn.hidden = false; shareCard.hidden = false;

  let cloud = null, cloudReady = null, bind = ls.get(BIND), pushing = false, again = false, timer = 0, retry = 0, lastStatus = '';
  const user = () => cloud && cloud.user;
  // artwork known to be up already, per folder: this person's own, or a shared project's
  const upKey = (folder) => 'ia-cloud-up:' + user().id + (folder ? ':' + folder : '');
  const doneSet = (folder) => { const s = new Set(ls.get(upKey(folder)) || []); return { has: (k) => s.has(k), add: (k) => { s.add(k); ls.set(upKey(folder), [...s].slice(-5000)); } }; };
  const doneFor = (b) => doneSet(b && b.shared ? 'p/' + b.id : '');
  // artwork that came down from the account is already up there
  const markUp = (p) => { const f = p.shared ? 'p/' + p.id : '', s = new Set(ls.get(upKey(f)) || []); for (const k of p.keys) if (p.images[k]) s.add(k); ls.set(upKey(f), [...s].slice(-5000)); };
  // the project as it was when this device last matched the account, for putting changes together
  const setBase = (id, json) => { try { localStorage.setItem(BASE, JSON.stringify({ id, json })); } catch (e) { ls.set(BASE, null); } };
  const baseFor = (id) => { const b = ls.get(BASE); try { return b && b.id === id ? JSON.parse(b.json) : null; } catch (e) { return null; } };
  const stateJson = () => JSON.stringify(api.snapshot().state);
  // Whether new work on this device goes into this person's account, and whether they were
  // asked yet. Both are cleared on sign out, so the next person to sign in here is asked again.
  const FOLLOW = 'ia-cloud-follow', ASKED = 'ia-cloud-asked';
  const following = () => !!(user() && ls.get(FOLLOW) === user().id);
  const follow = (on) => ls.set(FOLLOW, on && user() ? user().id : null);
  const asked = () => !!(user() && ls.get(ASKED) === user().id);
  const setBind = (b) => { bind = b; ls.set(BIND, b); renderBtn(); tellRole(); if (typeof liveTrack === 'function') { if (!b || !b.shared) liveLeave(); else liveTrack(); } };
  // someone who joined with a comment-only invite: the app hides moving and changing tattoos
  let roleShown = null;
  const tellRole = () => { const c = !!(myBind() && myBind().role === 'comment'); if (c !== roleShown) { roleShown = c; if (api.setCommentOnly) api.setCommentOnly(c); } };
  const myBind = () => (bind && user() && bind.uid === user().id ? bind : null);
  const currentSig = () => sigOf(JSON.stringify(api.snapshot().state));
  const status = (text, bad) => { lastStatus = text; api.setSaved(text, bad); };

  function ready() {
    if (!cloudReady) cloudReady = openCloud().then((c) => {
      cloud = c;
      c.onChange((u, event) => { renderBtn(); if (event === 'USER_UPDATED') return; if (u) afterSignIn(event); else { setBind(null); ls.set(FOLLOW, null); ls.set(ASKED, null); if (!root.hidden) show('signin'); } });
      renderBtn(); return c;
    }).catch((e) => { cloudReady = null; throw e; });
    return cloudReady;
  }

  /* ---------- settings that follow you ---------- */
  // Hair, beard, body hair, eye colour, light and hourly rate are kept per device; signed in, they
  // also go into the account's user details (prefs.js), so every device shows the same body. The
  // newest change wins. Turned off per device with ia-prefs-off. The face photo never leaves.
  const PREFS_AT = 'ia-prefs-at', PREFS_OFF = 'ia-prefs-off';
  let prefsSent = null, prefsBusy = false;
  const prefsOn = () => !!(cloud && user()) && !ls.get(PREFS_OFF);
  async function syncPrefs(fresh) {
    if (!prefsOn() || prefsBusy) return;
    prefsBusy = true;
    try {
      if (fresh) await cloud.refreshUser();
      if (!prefsOn()) return;
      const local = readPrefs(), remote = cloud.prefs(), d = decide(local, +ls.get(PREFS_AT) || 0, remote);
      if (d === 'take') { api.applyPrefs(remote.s); ls.set(PREFS_AT, remote.at); prefsSent = JSON.stringify(readPrefs()); }
      else if (d === 'send') { const v = { at: Math.max(Date.now(), ((remote && +remote.at) || 0) + 1), s: local }; await cloud.setPrefs(v); ls.set(PREFS_AT, v.at); prefsSent = JSON.stringify(local); }
      else prefsSent = JSON.stringify(local);
    } catch (e) { /* tried again on the next change or return to the app */ } finally { prefsBusy = false; }
  }
  // a change made on this device goes to the account a moment later
  setInterval(() => {
    if (!prefsOn() || prefsBusy || prefsSent == null || document.hidden) return;
    if (JSON.stringify(readPrefs()) !== prefsSent) { ls.set(PREFS_AT, Date.now()); syncPrefs(false); }
  }, 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncPrefs(true); });
  function setPrefsOn(on) {
    ls.set(PREFS_OFF, on ? null : true); prefsSent = null;
    if (on) { api.tried && api.tried('prefsSync'); syncPrefs(true); }
  }

  // how many projects wait on this person, as a small count on the account button
  let badgeN = 0;
  let live = null, liveFor = null, liveJoining = false, liveFailedUntil = 0, liveOthers = [], lastTrack = '', liveSeenOnce = false;
  function setBadge(n) { badgeN = n || 0; renderBtn(); }
  async function refreshBadge() {
    if (!user()) return;
    try { const me = cloud.displayName(), rows = await cloud.list(); setBadge(rows.filter((r) => { const t = turnOf(r, me); return t && t.yours; }).length); } catch (e) { /* a nicety */ }
  }
  function renderBtn() {
    const u = user();
    let badge = btn.querySelector('.acct-badge');
    if (!badge) { badge = document.createElement('i'); badge.className = 'acct-badge'; badge.setAttribute('aria-hidden', 'true'); btn.append(badge); }
    badge.hidden = !(u && badgeN); badge.textContent = !badgeN ? '' : badgeN > 9 ? '9+' : String(badgeN);
    btn.classList.toggle('signed', !!u);
    const label = btn.querySelector('span');
    if (u) { const n = cloud.displayName(u) || '?'; label.textContent = n.slice(0, 1).toUpperCase(); btn.setAttribute('aria-label', 'Your account: ' + n + (badgeN ? `, ${badgeN} project${badgeN === 1 ? '' : 's'} waiting on you` : '')); btn.title = 'Signed in as ' + (u.email || n); }
    else { label.textContent = 'Sign in'; btn.setAttribute('aria-label', 'Sign in'); btn.title = 'Sign in'; }
  }

  /* ---------- keeping the account copy in step ---------- */
  // Called after every successful save on this device.
  function saved() {
    if (!user()) return;
    if (!myBind() && !following()) { status('Saved on this device only'); return; }
    clearTimeout(timer); timer = setTimeout(push, 1500);
  }
  async function push() {
    clearTimeout(timer); timer = 0;
    if (!user()) return;
    if (pushing) { again = true; return; }
    if (api.holding && api.holding()) { clearTimeout(retry); retry = setTimeout(push, 1500); return; } // trying something out on this screen: nothing goes up until it is done
    if (!myBind() && !following()) return;
    if (myBind() && myBind().sig === currentSig()) { status('Saved to your account'); return; }
    pushing = true; status('Saving to your account');
    try {
      for (let tries = 0; ; tries++) {
        const snap = api.snapshot(), json = JSON.stringify(snap.state), sig = sigOf(json), b = myBind();
        if (b && b.sig === sig) break;
        const state = JSON.parse(json), name = api.projectName();
        if (!b) {
          const r = await cloud.create(state, snap.images, name, doneSet());
          setBind({ uid: user().id, id: r.id, rev: r.rev, sig, name: r.name, shared: false, mine: true }); setBase(r.id, json);
          break;
        }
        if (b.role === 'comment') { const r = await pushComments(b, json, snap.images); if (r === 'again') continue; break; }
        const r = await cloud.save(b.id, b.rev, state, snap.images, name, doneFor(b), { shared: !!b.shared, mine: b.mine !== false });
        if (!r.conflict) {
          setBind({ ...b, rev: r.rev, sig, name: r.name || b.name, shared: !!(b.shared || r.shared) }); setBase(b.id, json);
          // sharing was switched on from another device: the artwork goes where everyone can see it
          if (r.shared && !b.shared && b.mine !== false) await cloud.startSharing(b.id, snap.images, doneSet('p/' + b.id));
          break;
        }
        // someone saved it elsewhere since this device last did
        const p = await cloud.load(b.id);
        markUp(p);
        if (!p.shared) {
          // changed on another of this person's devices as well: keep both, this one as its own project
          const copyName = (name + ' (' + deviceName() + ')').slice(0, 80);
          const c = await cloud.create(state, snap.images, copyName, doneSet());
          setBind({ uid: user().id, id: c.id, rev: c.rev, sig, name: c.name, shared: false, mine: true }); setBase(c.id, json);
          api.toast(`This project was also changed on another device. Both are in your account: this one is "${c.name}".`);
          break;
        }
        // worked on together: put both people's changes together and save that
        if (tries >= 3) throw new Error('Still changing elsewhere');
        if (api.busy && api.busy()) { pushing = false; clearTimeout(retry); retry = setTimeout(push, 1500); return; }
        if (myBind() !== b || currentSig() !== sig) continue; // changed while loading: start again
        const merged = mergeStates(baseFor(b.id), state, p.state);
        const said = await api.open(merged, { ...p.images, ...snap.images }, p.name, { live: true });
        setBind({ ...b, rev: p.rev, sig: '', name: p.name, shared: true, mine: p.mine }); setBase(b.id, JSON.stringify(p.state));
        if (!(said && said.toasted)) liveNote(`Your changes and ${p.editedBy || 'the other person'}'s are both in "${p.name}".`, true);
      }
      retry = 0;
      status(myBind() && myBind().sig === currentSig() ? 'Saved to your account' : 'Saving to your account');
    } catch (e) {
      status('Saved on this device. Not in your account yet', true);
      clearTimeout(retry); retry = setTimeout(push, 30000);
    } finally { if (pushing) { pushing = false; if (again) { again = false; push(); } } }
  }
  // Someone who can only comment: what goes up is the account's project with their comments,
  // answers and reference pictures on it, and what is on screen becomes exactly that.
  async function pushComments(b, json, images) {
    const local = JSON.parse(json), have = (k) => typeof images[k] === 'string';
    const p = await cloud.load(b.id, have);
    markUp(p);
    if (myBind() !== b) return 'again';
    if (p.role !== 'comment') { setBind({ ...b, role: p.role }); return 'again'; } // the owner let them edit meanwhile
    const out = commentsOnto(baseFor(b.id), local, p.state);
    let rev = p.rev;
    if (JSON.stringify(out) !== JSON.stringify(p.state)) {
      const r = await cloud.saveComments(b.id, p.rev, out, p.keys, images, doneFor(b));
      if (r.conflict) return 'again';
      rev = r.rev;
    }
    if (myBind() !== b || currentSig() !== sigOf(json)) return 'again'; // changed while saving: start again
    const base = baseFor(b.id);
    if (p.rev !== b.rev || !base || JSON.stringify(withoutComments(local)) !== JSON.stringify(withoutComments(base))) {
      const said = await api.open(out, { ...p.images, ...images }, p.name, { live: true });
      if (p.rev !== b.rev && !(said && said.toasted)) liveNote(`${p.editedBy || 'Someone'} changed "${p.name}".`);
    }
    setBind({ ...b, rev, sig: currentSig(), name: p.name, shared: true, mine: false, role: 'comment' }); setBase(b.id, stateJson());
    return 'done';
  }
  // a short note when someone else's changes come in, at most once a minute unless it matters
  let lastNote = 0;
  function liveNote(text, always) { const now = Date.now(); if (!always && now - lastNote < 60000) return; lastNote = now; api.toast(text); }
  // Coming back to the app, and every few seconds while a shared project is open: a newer
  // version saved on another device, or by someone else on the project, opens here.
  let pulling = false;
  async function pull(look) {
    if (look) lookPending = true;
    const b = myBind(); if (!b || pushing || pulling) return;
    pulling = true;
    try {
      let meta; try { meta = await cloud.meta(b.id); } catch (e) { return; }
      if (bind !== b) return;
      if (!meta) { // removed from the account on another device, or this person was taken off it
        setBind(null); follow(false);
        if (b.mine === false) { status('Saved on this device'); api.toast(`You are no longer on "${b.name}". It stays on this device.`); }
        else status('Removed from your account. Still saved on this device');
        return;
      }
      if (!!meta.shared !== !!b.shared || meta.mine !== (b.mine !== false) || (meta.role || 'edit') !== (b.role || 'edit')) {
        if ((meta.role || 'edit') !== (b.role || 'edit') && b.mine === false) api.toast(meta.role === 'comment' ? `You can now comment and answer on "${b.name}", but not change the tattoos.` : `You can now change the tattoos in "${b.name}".`);
        setBind({ ...b, shared: !!meta.shared, mine: meta.mine, role: meta.role || 'edit' });
      }
      const now = myBind();
      if (meta.rev <= now.rev) { if (lookPending) { lookPending = false; lookForChanges(); } return; }
      if (currentSig() !== now.sig) { pulling = false; push(); return; } // both changed: push keeps both, or puts them together
      if (now.shared && api.busy && api.busy()) return; // in the middle of something: the next check brings it in
      const p = await cloud.load(now.id);
      markUp(p);
      if (bind !== now || currentSig() !== now.sig) return;
      if (p.shared) {
        const said = await api.open(p.state, p.images, p.name, { live: true });
        setBind({ ...now, rev: p.rev, sig: currentSig(), name: p.name, shared: true, mine: p.mine, role: p.role }); setBase(now.id, stateJson());
        api.saveNow(); status('Saved to your account');
        if (lookPending) { lookPending = false; if (lookForChanges(said && said.toasted)) return; }
        if (!(said && said.toasted)) liveNote(`${p.editedBy || 'Someone'} changed "${p.name}".` + (p.missing.length ? ` ${p.missing.length} artwork file${p.missing.length === 1 ? ' is' : 's are'} still on the way.` : ''));
        return;
      }
      await api.open(p.state, p.images, p.name, { keepCopy: false, reason: 'Before the newer version from your account' });
      setBind({ ...now, rev: p.rev, sig: currentSig(), name: p.name }); setBase(now.id, stateJson());
      api.saveNow(); status('Saved to your account');
      api.toast('Opened the newest version from your account.' + (p.missing.length ? ` ${p.missing.length} artwork file${p.missing.length === 1 ? ' is' : 's are'} still missing.` : ''));
    } catch (e) { /* stay as we are; the next check tries again */ } finally { pulling = false; }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) markSeen(); else if (user()) { pull(true); refreshBadge(); } });
  window.addEventListener('pagehide', () => markSeen());

  /* ---------- what changed since you last looked ---------- */
  // The shared project as it was when this person last had it on screen (when the app last
  // went to the background, or they last looked at the list), kept for a few projects.
  let lookPending = false;
  const seenAll = () => { const v = ls.get(SEEN); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  function markSeen(id) {
    const b = myBind(); if (!b || !b.shared || (id && id !== b.id)) return;
    const all = seenAll(); delete all[b.id];
    const keep = Object.keys(all).slice(-2), next = {}; for (const k of keep) next[k] = all[k];
    next[b.id] = stateJson();
    try { localStorage.setItem(SEEN, JSON.stringify(next)); } catch (e) { try { localStorage.setItem(SEEN, JSON.stringify({ [b.id]: next[b.id] })); } catch (e2) { /* storage full: no list next time */ } }
  }
  // returns true when it told the person about the changes
  function lookForChanges(alreadyToasted) {
    const b = myBind(); if (!b || !b.shared) return false;
    const was = seenAll()[b.id];
    let before = null; try { before = was ? JSON.parse(was) : null; } catch (e) { before = null; }
    markSeen();
    if (!before) return false;
    const items = changesBetween(before, api.snapshot().state, { me: cloud.displayName(), inches: api.inches });
    if (!items.length) return false;
    ls.set(CHANGES, { uid: user().id, id: b.id, at: new Date().toISOString(), items: items.slice(0, 40) });
    if (items.length === 1 && alreadyToasted) return true;
    api.toast(items.length === 1 ? 'Since you last looked: ' + items[0].text + '.' : `${items.length} changes to "${b.name}" since you last looked.`, 'Show', () => { open(); show('changes'); });
    return true;
  }
  const lastChanges = () => { const c = ls.get(CHANGES), b = myBind(); return c && b && user() && c.uid === user().id && c.id === b.id && Array.isArray(c.items) ? c : null; };
  function changesView() {
    const c = lastChanges();
    const rows = h('div', { class: 'acct-list' });
    if (!c) rows.append(h('p', { class: 'muted', text: 'Nothing has changed since you last looked.' }));
    else for (const it of c.items) {
      const go = it.tattooId || it.noteId || it.refId;
      rows.append(h('div', { class: 'acct-item' }, h('div', { class: 'acct-name' }, h('span', { text: it.text })),
        go ? h('div', { class: 'acct-actions' }, h('button', { class: 'btn', type: 'button', text: 'Show', onclick: () => { close(); if (api.showChange) api.showChange(it); } })) : null));
    }
    put(header('What changed'), c ? h('p', { class: 'muted', text: `In "${myBind().name}" since you last looked, seen ${when(c.at)}.` }) : null, rows, msgEl,
      h('button', { class: 'btn quiet', type: 'button', text: 'Back', onclick: () => show('home') }));
  }
  setInterval(() => { const b = myBind(); if (b && b.shared && !document.hidden && navigator.onLine !== false) pull(); liveSync(); }, LIVE_MS);

  /* ---------- who else has it open right now ---------- */
  // Realtime presence on the shared project's own channel: who is here, and which tattoo each
  // has selected. Nothing is stored. When Realtime is not there, this stays quiet and the
  // check every few seconds above does the work as before.
  const hereBtn = document.getElementById('hereNow');
  const nameOfLook = (id) => (id && api.tattooName ? api.tattooName(id) : '');
  function renderHere() {
    if (api.setPeers) api.setPeers(liveOthers);
    if (liveOthers.length && api.tried) api.tried('hereNow');
    if (!hereBtn) return;
    const list = liveOthers.slice(0, 3);
    hereBtn.hidden = !list.length;
    hereBtn.replaceChildren(...list.map((o) => { const i = document.createElement('i'); i.textContent = (o.name || '?').slice(0, 1).toUpperCase(); return i; }));
    if (liveOthers.length > 3) { const i = document.createElement('i'); i.className = 'more'; i.textContent = '+' + (liveOthers.length - 3); hereBtn.append(i); }
    const names = liveOthers.map((o) => o.name || 'Someone');
    const label = names.length ? `${names.length === 1 ? names[0] + ' is' : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ' are'} here now` : '';
    hereBtn.setAttribute('aria-label', label); hereBtn.title = label;
    const rowsKey = liveOthers.map((o) => [o.id, o.look, !!o.view].join()).join('|');
    if (view === 'home' && !root.hidden && rowsKey !== hereRowsKey) { hereRowsKey = rowsKey; renderHereRows(); }
  }
  // "here now · looking at Rose" on the people in Work on it together
  // shown on each person's own row once the list of people is in, on their own row until then
  let hereRowsKey = '';
  function renderHereRows() {
    hereRowsKey = liveOthers.map((o) => [o.id, o.look, !!o.view].join()).join('|');
    const box = document.getElementById('acctHereNow'); if (!box) return;
    const together = document.getElementById('acctTogether');
    for (const e of together.querySelectorAll('.acct-here-line')) e.remove();
    const loose = [];
    for (const o of liveOthers) {
      const n = nameOfLook(o.look), text = 'Here now' + (n ? ` · looking at ${n}` : '');
      const row = [...together.querySelectorAll('[data-uid]')].find((e) => e.dataset.uid === o.id) || together.querySelector('[data-owner]');
      const follow = o.view && api.follow ? h('button', { class: 'btn acct-here-line acct-follow', type: 'button', text: 'Follow their view', onclick: () => { close(); api.follow(o.id); } }) : null;
      if (row) {
        row.querySelector('.acct-name').append(h('small', { class: 'acct-turn yours acct-here-line', text }));
        if (follow) { let acts = row.querySelector('.acct-actions'); if (!acts) { acts = h('div', { class: 'acct-actions' }); row.append(acts); } acts.prepend(follow); }
      } else loose.push(h('div', { class: 'acct-item' }, h('div', { class: 'acct-name' }, h('b', { text: o.name || 'Someone' }), h('small', { class: 'acct-turn yours acct-here-line', text })), follow ? h('div', { class: 'acct-actions' }, follow) : null));
    }
    box.replaceChildren(...loose); box.hidden = !loose.length;
  }
  function liveLeave() {
    if (live) { try { live.leave(); } catch (e) { /* gone already */ } }
    live = null; liveFor = null; lastTrack = ''; liveSeenOnce = false;
    if (liveOthers.length) { liveOthers = []; renderHere(); }
  }
  async function liveSync() {
    const b = myBind(), want = b && b.shared && !document.hidden && navigator.onLine !== false && cloud && cloud.presence ? b.id : null;
    if (liveFor && liveFor !== want) liveLeave();
    if (!want || live || liveJoining || Date.now() < liveFailedUntil) { if (live) liveTrack(); return; }
    liveJoining = true;
    try {
      const ch = await cloud.presence(want, (others) => {
        if (liveFor !== want) return;
        const had = new Set(liveOthers.map((o) => o.id));
        liveOthers = others; renderHere();
        const came = others.filter((o) => !had.has(o.id));
        if (came.length && liveSeenOnce && !(api.busy && api.busy())) api.toast(`${came.map((o) => o.name || 'Someone').join(' and ')} opened "${(myBind() || b).name}".`);
        liveSeenOnce = true;
        peersAhead();
      });
      if (myBind() !== b && (!myBind() || myBind().id !== want)) { ch.leave(); return; }
      live = ch; liveFor = want; liveTrack(true);
    } catch (e) { liveFailedUntil = Date.now() + 60000; } finally { liveJoining = false; }
  }
  // what this person has open, told to the others when it changes
  function liveTrack(force) {
    const b = myBind(); if (!live || !b) return;
    const meta = { name: cloud.displayName() || 'Someone', look: api.looking ? api.looking() : null, rev: b.rev || 0, view: api.view ? api.view() : null, point: api.point ? api.point() : null, typing: api.typing ? api.typing() : null };
    const key = JSON.stringify(meta);
    if (!force && key === lastTrack) return;
    lastTrack = key;
    Promise.resolve(live.track(meta)).catch(() => { lastTrack = ''; });
  }
  // someone here already has a newer version: bring it in now instead of at the next check
  function peersAhead() { const b = myBind(); if (b && liveOthers.some((o) => o.rev > (b.rev || 0))) pull(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) liveLeave(); else liveSync(); });
  if (hereBtn) hereBtn.addEventListener('click', async () => { try { await ready(); } catch (e) { return; } open(); show('home'); const box = document.getElementById('acctHereNow'); if (box) box.scrollIntoView({ block: 'center' }); });
  window.addEventListener('online', () => { if (user()) { if (myBind() || following()) push(); } });

  // Replacing the project on screen another way (Projects on this device, a backup file,
  // a new project): it is no longer the one in the account.
  function unbind() {
    if (!myBind()) return;
    setBind(null);
    if (following()) { clearTimeout(timer); timer = setTimeout(push, 1500); }
  }

  async function openFromAccount(id, said) {
    const b = myBind();
    if (b && b.id === id) { close(); if (said) api.toast(said); return; }
    if (b) await push(); // make sure what is on screen is safe in the account first
    const safe = myBind() && myBind().sig === currentSig();
    const p = await cloud.load(id);
    markUp(p);
    await api.open(p.state, p.images, p.name, { keepCopy: !safe, reason: 'Before opening a project from your account' });
    setBind({ uid: user().id, id: p.id, rev: p.rev, sig: currentSig(), name: p.name, shared: p.shared, mine: p.mine, ownerName: p.ownerName, role: p.role }); setBase(p.id, stateJson());
    follow(true);
    const told = p.shared && lookForChanges();
    api.saveNow(); status('Saved to your account');
    close();
    if (told && safe && !p.missing.length) return;
    api.toast((said || `Opened "${p.name}" from your account.`) + (p.missing.length ? ` ${p.missing.length} artwork file${p.missing.length === 1 ? ' is' : 's are'} missing.` : '') + (safe ? '' : ' What was on screen is kept in Projects on this device.'));
  }

  /* ---------- working on a project together ---------- */
  async function joinWith(token) {
    open(); view = 'busy'; panel.replaceChildren(header('Join a project'), h('p', { text: 'Joining…' }));
    try {
      const j = await cloud.acceptInvite(token);
      if (api.tried) api.tried('together');
      const role = await cloud.roleIn(j.id);
      await openFromAccount(j.id, role === 'comment'
        ? `You joined "${j.name}"${j.ownerName ? ' with ' + j.ownerName : ''} to comment and answer. Tap a tattoo to say yes or ask for a change.`
        : `You joined "${j.name}"${j.ownerName ? ' with ' + j.ownerName : ''}. You both see changes as they happen.`);
    } catch (e) { show('home'); msg(plainError(e)); }
  }
  async function makeInvite(role = 'edit') {
    if (!myBind()) { follow(true); ls.set(ASKED, user().id); await push(); }
    let b = myBind();
    if (!b) throw new Error('Could not reach your account. Try again in a moment.');
    if (b.mine === false) throw new Error('Only the person who owns this project can invite people.');
    if (!b.shared) {
      await push();
      b = myBind();
      await cloud.startSharing(b.id, api.snapshot().images, doneSet('p/' + b.id));
      setBind({ ...myBind(), shared: true });
    }
    const token = await cloud.invite(b.id, role);
    if (api.tried) api.tried(role === 'comment' ? 'comment-invite' : 'together');
    show('invite', { url: location.origin + location.pathname + '?join=' + token, role });
  }

  /* ---------- after signing in ---------- */
  async function afterSignIn() {
    const u = user();
    if (api.tried) api.tried();
    syncPrefs(false);
    if (bind && bind.uid !== u.id) setBind(null);
    refreshBadge();
    if (pendingJoin) { const t = pendingJoin; pendingJoin = null; await joinWith(t); return; }
    if (myBind()) { pull(true); status(myBind().sig === currentSig() ? 'Saved to your account' : 'Saving to your account'); if (myBind().sig !== currentSig()) push(); if (!root.hidden && view === 'signin') show('home'); return; }
    if (following()) { push(); if (!root.hidden && view === 'signin') show('home'); return; }
    if (pendingShare) { const s = pendingShare; pendingShare = null; follow(true); ls.set(ASKED, u.id); await push(); close(); api.toast(myBind() ? `"${s}" is saved to your account.` : 'Signed in. Your account could not be reached just now; it will try again.'); return; }
    if (!asked()) { if (!resetting) { open(); show('move'); } return; }
    status('Saved on this device only');
    if (!root.hidden && view === 'signin') show('home');
  }

  /* ---------- the panel ---------- */
  const root = h('div', { id: 'account', class: 'scrim', hidden: true });
  const panel = h('div', { class: 'modal glass acct', role: 'dialog', 'aria-labelledby': 'acctTitle' });
  root.append(panel);
  (document.getElementById('viewport') || document.body).append(root);
  root.addEventListener('click', (e) => { if (e.target === root && !busy) close(); });
  root.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && !busy) close(); });
  let homeFilter = 'all';
  let view = 'home', busy = false, mode = 'create', msgEl = null, codeEmail = '', codeMode = 'signup', resetting = false, pendingShare = null, pendingJoin = null;
  // focus the first field, unless the person is already typing in one
  const focusSoon = (el) => setTimeout(() => { const a = document.activeElement; if (!(a && a.tagName === 'INPUT' && panel.contains(a))) el.focus(); }, 60);
  const put = (...kids) => panel.append(...kids.flat().filter((k) => k != null && k !== false));
  const header = (title) => h('header', {}, h('h2', { id: 'acctTitle', text: title }), h('button', { class: 'btn', type: 'button', text: 'Close', onclick: () => { if (!busy) close(); } }));
  const msg = (text, good) => { if (msgEl) { msgEl.textContent = text || ''; msgEl.classList.toggle('good', !!good); } };
  const run = async (fn, buttons) => {
    if (busy) return; busy = true; msg('');
    panel.querySelectorAll('button,input').forEach((b) => { b.disabled = true; });
    try { await fn(); } catch (e) { msg(plainError(e)); }
    finally { busy = false; panel.querySelectorAll('button,input').forEach((b) => { b.disabled = false; }); }
  };
  function open() { root.hidden = false; }
  function close() { root.hidden = true; }

  function show(v, extra) {
    view = v; panel.replaceChildren(); msgEl = h('p', { class: 'acct-msg', role: 'status', 'aria-live': 'polite' });
    if (v === 'signin') signInView(extra);
    else if (v === 'code') codeView();
    else if (v === 'move') moveView();
    else if (v === 'home') homeView();
    else if (v === 'link') linkView(extra);
    else if (v === 'shared') sharedView(extra);
    else if (v === 'invite') inviteView(extra);
    else if (v === 'inviteRole') inviteRoleView();
    else if (v === 'changes') changesView();
    panel.scrollTop = 0;
  }

  function signInView(note) {
    const name = h('input', { type: 'text', autocomplete: 'name', placeholder: 'Your name', maxlength: '60', 'aria-label': 'Your name' });
    const email = h('input', { type: 'email', autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false', placeholder: 'Email', 'aria-label': 'Email', inputmode: 'email' });
    const pass = h('input', { type: 'password', autocomplete: mode === 'create' ? 'new-password' : 'current-password', placeholder: mode === 'create' ? 'Make a password (6 or more characters)' : 'Password', 'aria-label': 'Password', minlength: '6' });
    const go = h('button', { class: 'btn primary', type: 'submit', text: mode === 'create' ? 'Create account' : 'Sign in' });
    const tabs = h('div', { class: 'acct-tabs', role: 'group' },
      h('button', { class: 'btn', type: 'button', 'aria-pressed': mode === 'create' ? 'true' : 'false', text: 'New here', onclick: () => { mode = 'create'; show('signin', note); } }),
      h('button', { class: 'btn', type: 'button', 'aria-pressed': mode === 'signin' ? 'true' : 'false', text: 'I have an account', onclick: () => { mode = 'signin'; show('signin', note); } }));
    const form = h('form', { class: 'acct-form', onsubmit: (e) => {
      e.preventDefault();
      const em = email.value.trim(), pw = pass.value;
      if (!/^\S+@\S+\.\S+$/.test(em)) { msg('Type your email address.'); email.focus(); return; }
      if (pw.length < 6) { msg(mode === 'create' ? 'Make a password of at least 6 characters.' : 'Type your password.'); pass.focus(); return; }
      run(async () => {
        if (mode === 'create') {
          const r = await cloud.signUp(em, pw, name.value.trim());
          if (r.needsConfirm) { mode = 'signin'; show('signin'); msg('Account made. Open the link in the email we sent to ' + em + ', then sign in here.', true); }
        } else await cloud.signIn(em, pw);
      });
    } }, mode === 'create' ? name : null, email, pass, go);
    put(header(mode === 'create' ? 'Make your account' : 'Sign in'),
      h('p', { class: 'muted', text: note || 'Keep your projects in your account and open them on any device. Ink Atlas still works without one, on this device only.' }),
      tabs, form, msgEl,
      !emailCodes ? null : h('button', { class: 'btn quiet', type: 'button', id: mode === 'create' ? 'acctCodeSignup' : 'acctForgot', text: mode === 'create' ? 'Sign up with an emailed code instead' : 'Forgot your password? Email me a code', onclick: () => {
        const em = email.value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { msg('Type your email address first.'); email.focus(); return; }
        run(async () => { codeMode = mode === 'create' ? 'signup' : 'reset'; await cloud.sendCode(em, mode === 'create'); codeEmail = em; show('code'); });
      } }));
    focusSoon(mode === 'create' ? name : email);
  }

  function codeView() {
    const code = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', placeholder: '6-digit code', 'aria-label': 'Code from the email', maxlength: '10' });
    put(header('Check your email'),
      h('p', { text: `We sent a code to ${codeEmail}. Type it here. It can take a minute to arrive.` }),
      h('form', { class: 'acct-form', onsubmit: (e) => { e.preventDefault(); const c = code.value.replace(/\D/g, ''); if (c.length < 6) { msg('Type the code from the email.'); return; } run(async () => {
        if (codeMode === 'reset') resetting = true;
        try { await cloud.verifyCode(codeEmail, c); } catch (err) { resetting = false; throw err; }
        if (codeMode === 'reset') passwordView(true);
      }); } }, code, h('button', { class: 'btn primary', type: 'submit', text: codeMode === 'reset' ? 'Next' : 'Sign in' })),
      msgEl,
      h('div', { class: 'acct-row' }, h('button', { class: 'btn quiet', type: 'button', text: 'Send a new code', onclick: () => run(async () => { await cloud.sendCode(codeEmail, codeMode !== 'reset'); msg('A new code is on its way.', true); }) }), h('button', { class: 'btn quiet', type: 'button', text: 'Back', onclick: () => show('signin') })));
    focusSoon(code);
  }

  function moveView() {
    const snap = api.snapshot(), n = snap.state.tattoos.length, name = api.projectName();
    const shelfBox = h('input', { type: 'checkbox', id: 'acctShelf' });
    const shelfRow = h('label', { class: 'acct-check', for: 'acctShelf', hidden: true }, shelfBox, h('span', { text: '' }));
    import('./shelf.js').then(async ({ openProjectShelf }) => { try { const s = await openProjectShelf(); const rows = await s.list(); s.close(); if (rows.length) { shelfRow.hidden = false; shelfRow.querySelector('span').textContent = `Also add the ${rows.length} project${rows.length === 1 ? '' : 's'} saved in Projects on this device`; shelfRow.dataset.n = rows.length; } } catch (e) { /* no shelf */ } });
    const done = () => { ls.set(ASKED, user().id); };
    put(header('Signed in'),
      h('p', { text: `Add what is on this device to your account? "${name}" has ${n} tattoo${n === 1 ? '' : 's'}.` }),
      h('p', { class: 'muted', text: 'If this is someone else\'s iPad, choose Not now. Their work stays here and nothing goes into your account.' }),
      shelfRow, msgEl,
      h('div', { class: 'acct-row' },
        h('button', { class: 'btn primary', type: 'button', text: 'Add to my account', onclick: () => run(async () => {
          follow(true);
          await push();
          if (!myBind()) throw new Error('Could not reach your account. Your work is still saved on this device. Try again in a moment.');
          if (shelfBox.checked) {
            const { openProjectShelf } = await import('./shelf.js'); const s = await openProjectShelf();
            try { for (const r of await s.list()) { const row = await s.get(r.id); if (row) await cloud.create(row.state, row.images, row.name, doneSet()); } } finally { s.close(); }
          }
          done(); show('home'); msg('Added to your account.', true);
        }) }),
        h('button', { class: 'btn', type: 'button', text: 'Not now', onclick: () => { done(); status('Saved on this device only'); show('home'); } })));
  }

  // A copy of the project on screen, as this person's own project in their account: theirs to
  // change freely (also for someone who can only comment on the shared one). The shared project
  // stays as it is for everyone else; this screen moves to the copy.
  const copyBtn = () => h('button', { class: 'btn', type: 'button', id: 'acctCopy', text: 'Make my own copy', onclick: () => run(makeCopy) });
  // the names of the people on the shared project on screen, for @mentions; fetched now and then
  let knownPeople = { id: null, names: [], at: 0 }, peopleAsking = false;
  function people() {
    const b = myBind(); if (!b || !(b.shared || b.mine === false)) return [];
    if ((knownPeople.id !== b.id || Date.now() - knownPeople.at > 60000) && !peopleAsking && cloud) {
      peopleAsking = true;
      cloud.members(b.id).then((ms) => { if (myBind() && myBind().id === b.id) knownPeople = { id: b.id, names: [b.mine === false ? b.ownerName : '', ...ms.map((m) => m.name)].filter(Boolean), at: Date.now() }; })
        .catch(() => { knownPeople = { id: b.id, names: knownPeople.id === b.id ? knownPeople.names : [], at: Date.now() }; }).finally(() => { peopleAsking = false; });
    }
    return knownPeople.id === b.id ? knownPeople.names : [];
  }
  async function makeCopy() {
    const b = myBind(); if (!b) return;
    // bring in the newest shared version first, and send this screen's own changes, so the copy has everything
    for (let i = 0; i < 100 && (pushing || pulling); i++) await new Promise((r) => setTimeout(r, 100));
    await pull();
    for (let i = 0; i < 100 && (pushing || pulling); i++) await new Promise((r) => setTimeout(r, 100));
    if (b.role !== 'comment' && myBind() && myBind().sig !== currentSig()) await push();
    const from = myBind() || b, snap = api.snapshot(), json = JSON.stringify(snap.state);
    const name = (from.name.replace(/ \(my copy\)$/, '') + ' (my copy)').slice(0, 80);
    const r = await cloud.create(JSON.parse(json), snap.images, name, doneSet());
    markSeen();
    setBind({ uid: user().id, id: r.id, rev: r.rev, sig: sigOf(json), name: r.name, shared: false, mine: true }); setBase(r.id, json); follow(true);
    api.rename(r.name); // its own name inside too; saved with the next push
    close(); api.toast(`"${r.name}" is your own copy, in your account. "${from.name}" stays as it is for everyone on it.`);
    if (api.tried) api.tried('ownCopy');
  }
  const hereRows = () => { const box = h('div', { class: 'acct-list acct-here-now', id: 'acctHereNow' }); box.hidden = true; queueMicrotask(renderHereRows); return box; };
  async function homeView() {
    const u = user(), b = myBind(), safe = b && b.sig === currentSig();
    const list = h('div', { class: 'acct-list' }, h('p', { class: 'muted', text: 'Loading your projects…' }));
    const here = b
      ? h('p', { class: 'acct-here good', text: safe ? `"${b.name}" is saved to your account.` : `"${b.name}" is saving to your account.` })
      : h('div', { class: 'acct-here' }, h('p', { text: `"${api.projectName()}" is only on this device.` }), h('button', { class: 'btn primary', type: 'button', text: 'Save it to my account', onclick: () => run(async () => { follow(true); ls.set(ASKED, u.id); await push(); if (!myBind()) throw new Error('Could not reach your account. Try again in a moment.'); show('home'); msg('Saved to your account.', true); }) }));
    // working on the project on screen together with someone
    const people = h('div', { class: 'acct-list' });
    const changed = lastChanges();
    const changedBtn = changed ? h('button', { class: 'btn', type: 'button', id: 'acctChanges', text: `What changed (${changed.items.length})`, onclick: () => show('changes') }) : null;
    const together = b && b.mine === false
      ? h('div', { class: 'acct-together', id: 'acctTogether' },
          h('h3', { class: 'shHead', text: 'Working on it together' }),
          h('p', { class: 'muted', text: b.role === 'comment' ? 'You can pin comments, say yes or ask for a change on each tattoo, and add reference pictures. Only the people who can edit move the tattoos.' : 'You see each other\'s changes as they happen.' }), hereRows(), people,
          changedBtn ? h('div', { class: 'acct-row' }, changedBtn) : null,
          h('div', { class: 'acct-row' }, copyBtn(), h('button', { class: 'btn quiet danger', type: 'button', text: 'Leave this project', onclick: () => leaveRow(people, b) })))
      : h('div', { class: 'acct-together', id: 'acctTogether' },
          h('h3', { class: 'shHead', text: 'Work on it together' }),
          h('p', { class: 'muted', text: b && b.shared ? 'Everyone here sees the same tattoos, and each other\'s changes as they happen.' : 'Invite Liv or your artist into this project. You both see the same tattoos and each other\'s changes as they happen.' }),
          hereRows(), people,
          h('div', { class: 'acct-row' }, h('button', { class: 'btn primary', type: 'button', id: 'acctInvite', text: 'Invite someone', onclick: () => show('inviteRole') }), changedBtn, b && b.shared ? copyBtn() : null));
    put(header('Your account'),
      h('p', { class: 'muted', text: `Signed in as ${cloud.displayName(u)}${u.email ? ' (' + u.email + ')' : ''}` }),
      here, together, h('h3', { class: 'shHead', text: 'Your projects' }), list,
      h('div', { class: 'acct-row' }, h('button', { class: 'btn', type: 'button', text: 'New project', onclick: () => run(async () => {
        if (b) await push();
        const keep = !(myBind() && myBind().sig === currentSig());
        await api.newProject('New project', { keepCopy: keep });
        setBind(null); follow(true); await push(); close();
        api.toast('New project started in your account.' + (keep ? ' What was on screen is kept in Projects on this device.' : ''));
      }) })),
      msgEl,
      h('details', { class: 'acct-more' }, h('summary', { text: 'Account settings' }),
        h('div', { class: 'acct-row' },
          h('button', { class: 'btn', type: 'button', text: 'Set a password', onclick: () => passwordView() }),
          h('button', { class: 'btn', type: 'button', text: 'Change my name', onclick: () => nameView() })),
        h('p', { class: 'muted', text: 'Your hair, beard, body hair, eye colour, light and hourly rate follow you to every device you sign in on. Your face photo stays on the device it was taken on.' }),
        h('div', { class: 'acct-row' }, (() => { const b2 = h('button', { class: 'btn', type: 'button', id: 'acctPrefs' }); const paint = () => { const on = !ls.get(PREFS_OFF); b2.textContent = on ? 'Same on every device: on' : 'Same on every device: off'; b2.setAttribute('aria-pressed', String(on)); }; paint(); b2.addEventListener('click', () => { setPrefsOn(!!ls.get(PREFS_OFF)); paint(); msg(ls.get(PREFS_OFF) ? 'Settings on this device stay here now.' : 'Settings follow you again.', true); }); return b2; })())),
      h('div', { class: 'acct-row' }, h('button', { class: 'btn danger', type: 'button', text: 'Sign out', onclick: () => signOutView() })));
    try {
      const rows = await cloud.list();
      if (view !== 'home') return;
      list.replaceChildren();
      if (!rows.length) list.append(h('p', { class: 'muted', text: 'Nothing in your account yet.' }));
      // every project at a glance: whose turn it is, yours first
      const me = cloud.displayName(u);
      for (const r of rows) r.turn = turnOf(r, me);
      setBadge(rows.filter((r) => r.turn && r.turn.yours).length);
      const yours = rows.filter((r) => r.turn && r.turn.yours).length, theirs = rows.filter((r) => r.turn && r.turn.waiting).length;
      if (yours || theirs) {
        const pick = (f) => () => { homeFilter = homeFilter === f ? 'all' : f; show('home'); };
        list.append(h('div', { class: 'acct-glance', id: 'acctGlance', role: 'group', 'aria-label': 'Show projects' },
          h('button', { class: 'btn', type: 'button', 'aria-pressed': homeFilter === 'yours' ? 'true' : 'false', text: `${yours} need${yours === 1 ? 's' : ''} you`, onclick: pick('yours') }),
          h('button', { class: 'btn', type: 'button', 'aria-pressed': homeFilter === 'theirs' ? 'true' : 'false', text: `${theirs} waiting on others`, onclick: pick('theirs') })));
      }
      const shown = rows.filter((r) => homeFilter === 'yours' ? r.turn && r.turn.yours : homeFilter === 'theirs' ? r.turn && r.turn.waiting : true)
        .sort((a, b) => (b.turn && b.turn.yours ? 1 : 0) - (a.turn && a.turn.yours ? 1 : 0));
      if (rows.length && !shown.length) list.append(h('p', { class: 'muted', text: 'None right now.' }));
      for (const r of shown) {
        const isHere = b && b.id === r.id;
        const who = !r.mine ? ` · shared by ${r.owner_name || 'someone'}` : r.shared ? ' · shared' : '';
        const item = h('div', { class: 'acct-item' + (isHere ? ' here' : '') },
          h('div', { class: 'acct-name' }, h('b', { text: r.name }), h('small', { text: `${r.tattoos} tattoo${r.tattoos === 1 ? '' : 's'} · ${when(r.updated_at)}${who}${isHere ? ' · open now' : ''}` }),
            r.turn ? h('small', { class: 'acct-turn' + (r.turn.yours ? ' yours' : r.turn.done ? ' done' : ''), text: r.turn.text }) : null),
          h('div', { class: 'acct-actions' },
            isHere ? null : h('button', { class: 'btn primary', type: 'button', text: 'Open', onclick: () => run(() => openFromAccount(r.id)) }),
            r.mine ? h('button', { class: 'btn', type: 'button', text: 'Rename', onclick: () => renameRow(item, r) }) : null,
            isHere ? null : r.mine ? h('button', { class: 'btn quiet danger', type: 'button', text: 'Remove', onclick: () => removeRow(item, r) })
              : h('button', { class: 'btn quiet danger', type: 'button', text: 'Leave', onclick: () => leaveRow(item, r) })));
        list.append(item);
      }
    } catch (e) { if (view === 'home') list.replaceChildren(h('p', { class: 'acct-msg', text: plainError(e) })); }
    if (b && (b.shared || b.mine === false)) {
      try {
        const ms = await cloud.members(b.id);
        knownPeople = { id: b.id, names: [b.mine === false ? b.ownerName : '', ...ms.map((m) => m.name)].filter(Boolean), at: Date.now() };
        if (view !== 'home') return;
        people.replaceChildren();
        if (b.mine === false) people.append(h('div', { class: 'acct-item', 'data-owner': '1' }, h('div', { class: 'acct-name' }, h('b', { text: b.ownerName || 'The owner' }), h('small', { text: 'owns this project' }))));
        for (const m of ms) {
          const me = m.user_id === u.id, comment = m.role === 'comment';
          const item = h('div', { class: 'acct-item', 'data-uid': m.user_id }, h('div', { class: 'acct-name' }, h('b', { text: me ? 'You' : (m.name || 'Someone') }), h('small', { text: (comment ? 'comments and answers only' : 'can change tattoos') + ' · joined ' + when(m.added_at) })),
            b.mine !== false ? h('div', { class: 'acct-actions' },
              h('button', { class: 'btn', type: 'button', text: comment ? 'Let them edit' : 'Comments only', onclick: () => run(async () => { await cloud.setRole(b.id, m.user_id, comment ? 'edit' : 'comment'); show('home'); msg(comment ? `${m.name || 'They'} can now change the tattoos.` : `${m.name || 'They'} can now only comment and answer.`, true); }) }),
              h('button', { class: 'btn quiet danger', type: 'button', text: 'Take off', onclick: () => takeOffRow(item, b, m) })) : null);
          people.append(item);
        }
        if (!ms.length && b.mine !== false) people.append(h('p', { class: 'muted', text: 'Nobody has joined yet. Each invite link is for one person.' }));
        renderHereRows();
      } catch (e) { /* the list of people is a nicety */ }
    }
  }
  // Whose turn it is on a project, from its summary (supabase/setup.sql): changes asked for
  // first, then a new comment, then tattoos waiting on an answer. yours: something for this
  // person to do; waiting: something for someone else to do.
  function turnOf(r, me) {
    const s = r.summary; if (!s) return null;
    const n = (x, one, many) => `${x} ${x === 1 ? one : many}`;
    const askers = (Array.isArray(s.change_by) ? s.change_by : []).filter((x) => x && x !== me);
    const owner = r.mine ? 'them' : (r.owner_name || 'the owner');
    const canEdit = r.mine || (bind && bind.id === r.id ? bind.role !== 'comment' : true);
    if (s.changes) {
      if (askers.length && canEdit) return { yours: true, text: `Your turn: ${askers.join(' and ')} asked for ${n(s.changes, 'change', 'changes')}` };
      return { waiting: true, text: `Waiting on ${r.mine && askers.length ? 'you' : owner} to make ${n(s.changes, 'change', 'changes')}` };
    }
    if (!r.shared) return s.planned && s.approved === s.planned ? { done: true, text: 'All approved' } : null;
    if (s.comment_by && s.comment_by !== me && r.edited_by !== me) return { yours: true, text: `Your turn: ${s.comment_by} commented "${s.comment_text || ''}"` };
    const open = Math.max(0, (s.planned || 0) - (s.approved || 0) - (s.changes || 0));
    // the owner plans, the people they invited answer
    if (open) return !r.mine ? { yours: true, text: `Your turn: ${n(open, 'tattoo waits', 'tattoos wait')} on your answer` } : { waiting: true, text: `Waiting on an answer for ${n(open, 'tattoo', 'tattoos')}` };
    if (s.planned) return { done: true, text: 'All approved' };
    return null;
  }
  function takeOffRow(item, b, m) {
    item.replaceChildren(h('p', { text: `Take ${m.name || 'this person'} off "${b.name}"? They stop seeing it and their old link stops working.` }),
      h('div', { class: 'acct-actions' }, h('button', { class: 'btn danger', type: 'button', text: 'Take off', onclick: () => run(async () => { await cloud.removeMember(b.id, m.user_id); show('home'); msg(`${m.name || 'They'} can no longer see "${b.name}".`, true); }) }), h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: () => show('home') })));
  }
  function leaveRow(item, r) {
    item.replaceChildren(h('p', { text: `Leave "${r.name}"? You stop seeing it in your account.${myBind() && myBind().id === r.id ? ' What is on screen stays on this device.' : ''}` }),
      h('div', { class: 'acct-actions' }, h('button', { class: 'btn danger', type: 'button', text: 'Leave', onclick: () => run(async () => {
        await cloud.leave(r.id);
        if (myBind() && myBind().id === r.id) { setBind(null); follow(false); status('Saved on this device'); }
        show('home'); msg(`You left "${r.name}".`, true);
      }) }), h('button', { class: 'btn', type: 'button', text: 'Stay', onclick: () => show('home') })));
  }
  function inviteRoleView() {
    view = 'inviteRole';
    put(header('Invite someone'),
      h('p', { text: `Who are you inviting into "${api.projectName()}"?` }),
      h('div', { class: 'cards' },
        h('button', { class: 'card', type: 'button', id: 'acctInviteEdit', onclick: () => run(() => makeInvite('edit')) }, h('b', { text: 'Someone who can change the tattoos' }), h('span', { text: 'Like Liv. You both move, resize and add tattoos, and see each other\'s changes as they happen.' })),
        h('button', { class: 'card', type: 'button', id: 'acctInviteComment', onclick: () => run(() => makeInvite('comment')) }, h('b', { text: 'Someone who comments and answers' }), h('span', { text: 'Like your artist or a client. They pin comments, say yes or ask for a change on each tattoo and add reference pictures, but can\'t move anything.' }))),
      msgEl,
      h('button', { class: 'btn quiet', type: 'button', text: 'Back', onclick: () => show('home') }));
  }
  function inviteView({ url, role }) {
    const box = h('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Invite link', class: 'acct-link' });
    const canShare = !!navigator.share;
    put(header('Invite someone'),
      h('p', { text: role === 'comment'
        ? `Send this link to one person, like your artist. When they open it and sign in, they join "${api.projectName()}" to comment and answer. They see your changes as they happen.`
        : `Send this link to one person, like Liv. When they open it and sign in, they join "${api.projectName()}". You both see the same tattoos and each other's changes as they happen.` }),
      box,
      h('div', { class: 'acct-row' },
        canShare ? h('button', { class: 'btn primary', type: 'button', text: 'Share link', onclick: () => navigator.share({ title: 'Join my Ink Atlas project', url }).catch(() => {}) }) : null,
        h('button', { class: canShare ? 'btn' : 'btn primary', type: 'button', text: 'Copy link', onclick: async () => { try { await navigator.clipboard.writeText(url); msg('Link copied.', true); } catch (e) { box.select(); msg('Select the link and copy it.'); } } })),
      msgEl,
      h('p', { class: 'muted', text: role === 'comment' ? 'Each link is for one person and works for 14 days. They can comment, answer and add reference pictures, not change the tattoos. You can let them edit, or take them off, any time.' : 'Each link is for one person and works for 14 days. They can change the tattoos; only you can rename or remove the project. You can take them off any time.' }),
      h('button', { class: 'btn quiet', type: 'button', text: 'Back', onclick: () => show('home') }));
  }
  function renameRow(item, r) {
    const input = h('input', { type: 'text', value: r.name, maxlength: '80', 'aria-label': 'New name' });
    item.replaceChildren(h('form', { class: 'acct-form inline', onsubmit: (e) => { e.preventDefault(); const name = input.value.trim(); if (!name) return; run(async () => {
      await cloud.rename(r.id, name);
      const b = myBind(); if (b && b.id === r.id) api.rename(name);
      show('home');
    }); } }, input, h('button', { class: 'btn primary', type: 'submit', text: 'Save' }), h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: () => show('home') })));
    input.focus(); input.select();
  }
  function removeRow(item, r) {
    item.replaceChildren(h('p', { text: `Remove "${r.name}" from your account? It goes from every device.` }),
      h('div', { class: 'acct-actions' }, h('button', { class: 'btn danger', type: 'button', text: 'Remove', onclick: () => run(async () => { await cloud.remove(r.id); show('home'); msg(`Removed "${r.name}".`, true); }) }), h('button', { class: 'btn', type: 'button', text: 'Keep it', onclick: () => show('home') })));
  }
  // reset: straight after signing in with an emailed code because the password was forgotten
  function passwordView(reset) {
    view = reset ? 'reset' : 'password'; panel.replaceChildren(); msgEl = h('p', { class: 'acct-msg', role: 'status' });
    const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'New password (6 or more characters)', 'aria-label': 'New password' });
    const after = () => { resetting = false; if (reset && !asked() && !myBind() && !following()) { show('move'); msg('New password saved.', true); } else { show('home'); msg(reset ? 'New password saved. You are signed in.' : 'Password saved.', true); } };
    put(header(reset ? 'Set a new password' : 'Set a password'), h('p', { class: 'muted', text: reset ? 'You are signed in. Choose a new password to use from now on, on any device.' : 'Sign in with it on any device, no email needed.' }),
      h('form', { class: 'acct-form', onsubmit: (e) => { e.preventDefault(); if (pass.value.length < 6) { msg('Use at least 6 characters.'); return; } run(async () => { await cloud.setPassword(pass.value); after(); }); } }, pass, h('button', { class: 'btn primary', type: 'submit', text: 'Save password' })),
      msgEl, h('button', { class: 'btn quiet', type: 'button', text: reset ? 'Not now' : 'Back', onclick: () => { resetting = false; show('home'); } }));
    focusSoon(pass);
  }
  function nameView() {
    view = 'name'; panel.replaceChildren(); msgEl = h('p', { class: 'acct-msg', role: 'status' });
    const name = h('input', { type: 'text', autocomplete: 'name', value: cloud.displayName(), maxlength: '60', 'aria-label': 'Your name' });
    put(header('Your name'), h('p', { class: 'muted', text: 'Shown to people you send a link to.' }),
      h('form', { class: 'acct-form', onsubmit: (e) => { e.preventDefault(); const v = name.value.trim(); if (!v) return; run(async () => { await cloud.setName(v); renderBtn(); show('home'); msg('Name saved.', true); }); } }, name, h('button', { class: 'btn primary', type: 'submit', text: 'Save' })),
      msgEl, h('button', { class: 'btn quiet', type: 'button', text: 'Back', onclick: () => show('home') }));
  }
  function signOutView() {
    view = 'signout'; panel.replaceChildren(); msgEl = h('p', { class: 'acct-msg', role: 'status' });
    const b = myBind();
    const out = (clear) => run(async () => {
      if (b) { await push(); if (!(myBind() && myBind().sig === currentSig())) throw new Error('Your latest changes have not reached your account yet. Check your connection and try again.'); }
      await cloud.signOut(); setBind(null); ls.set(FOLLOW, null); ls.set(ASKED, null);
      if (clear) await api.newProject('My tattoos', { keepCopy: !b, blank: true });
      status('Saved on this device'); close();
      api.toast(clear ? 'Signed out. Your projects are in your account; this screen is clear.' : 'Signed out. The project on screen stays on this device.');
    });
    put(header('Sign out'),
      h('p', { text: b ? 'Your projects stay in your account. Sign in again on any device to open them.' : 'The project on screen is only on this device. It stays here after you sign out.' }),
      msgEl,
      h('div', { class: 'acct-col' },
        h('button', { class: 'btn danger', type: 'button', text: 'Sign out', onclick: () => out(false) }),
        b ? h('button', { class: 'btn', type: 'button', text: 'Sign out and clear this screen', onclick: () => out(true) }) : null,
        h('button', { class: 'btn quiet', type: 'button', text: 'Cancel', onclick: () => show('home') })));
  }

  /* ---------- sending a copy by link ---------- */
  function linkView(url) {
    const box = h('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Link', class: 'acct-link' });
    const canShare = !!navigator.share;
    put(header('Send to someone'),
      h('p', { text: 'Send this link. They open it, see your project and can save their own copy in their own account.' }),
      box,
      h('div', { class: 'acct-row' },
        canShare ? h('button', { class: 'btn primary', type: 'button', text: 'Share link', onclick: () => navigator.share({ title: 'Ink Atlas: ' + api.projectName(), url }).catch(() => {}) }) : null,
        h('button', { class: canShare ? 'btn' : 'btn primary', type: 'button', text: 'Copy link', onclick: async () => { try { await navigator.clipboard.writeText(url); msg('Link copied.', true); } catch (e) { box.select(); msg('Select the link and copy it.'); } } })),
      msgEl,
      h('p', { class: 'muted', text: 'It sends a copy of the project as it is now. Your later changes do not change their copy, and they cannot change yours.' }));
  }
  async function sendLink() {
    await ready().catch((e) => { api.toast(plainError(e)); throw e; });
    open();
    if (!user()) { mode = 'signin'; show('signin', 'Sign in to send a link. It keeps the copy in your account so the link keeps working.'); return; }
    view = 'busy'; panel.replaceChildren(header('Send to someone'), h('p', { text: 'Making the link…' }));
    try {
      const snap = api.snapshot();
      if (!snap.state.tattoos.length) throw new Error('Add a tattoo first: there is nothing to send yet.');
      const id = await cloud.share(JSON.parse(JSON.stringify(snap.state)), snap.images, api.projectName());
      const url = location.origin + location.pathname + '?share=' + id;
      show('link', url);
    } catch (e) { show('home'); msg(plainError(e)); }
  }

  function sharedView(s) {
    const n = s.state.tattoos.length;
    put(header('Someone sent you a project'),
      h('p', { text: `${s.fromName || 'Someone'} sent you "${s.name}", ${n} tattoo${n === 1 ? '' : 's'}.` }),
      s.missing.length ? h('p', { class: 'muted', text: `${s.missing.length} artwork file${s.missing.length === 1 ? '' : 's'} could not be fetched and will be left out.` }) : null,
      h('p', { class: 'muted', text: 'Opening it keeps what is on screen now in Projects on this device.' }),
      msgEl,
      h('div', { class: 'acct-row' },
        h('button', { class: 'btn primary', type: 'button', text: 'Open it', onclick: () => run(async () => {
          if (myBind()) await push();
          const safe = myBind() && myBind().sig === currentSig();
          await api.open(s.state, s.images, s.name, { keepCopy: !safe, reason: 'Before opening a project someone sent' });
          setBind(null);
          if (user()) { follow(true); ls.set(ASKED, user().id); await push(); close(); api.toast(`Opened "${s.name}" and saved it to your account.`); }
          else { pendingShare = s.name; mode = 'create'; show('signin', `"${s.name}" is open on this device. Make a free account to keep it and open it on your other devices.`); }
          api.saveNow();
        }) }),
        h('button', { class: 'btn', type: 'button', text: 'Not now', onclick: () => close() })));
  }

  async function start() {
    btn.addEventListener('click', async () => { try { await ready(); } catch (e) { api.toast(plainError(e)); return; } open(); show(user() ? 'home' : 'signin'); });
    const q = new URLSearchParams(location.search), shareId = q.get('share'), joinId = q.get('join');
    if (shareId || joinId) { q.delete('share'); q.delete('join'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
    // a session saved on this device (or arriving from an email link) loads the client at once;
    // otherwise it waits until it is needed, so signed-out use stays as fast as before
    let hasSession = false; try { hasSession = !!localStorage.getItem('ia-auth') || /access_token=|token_hash=|type=(signup|magiclink|recovery)/.test(location.hash + location.search); } catch (e) { /* no storage */ }
    if (joinId && !shareId) pendingJoin = joinId;
    if (hasSession || shareId || joinId) {
      try { await ready(); } catch (e) { if (shareId || joinId) api.toast(plainError(e)); return; }
      if (user()) afterSignIn('INITIAL');
      else if (pendingJoin) { open(); mode = 'create'; show('signin', 'Someone invited you to work on their tattoo project with them. Make a free account, or sign in, to join it.'); }
    }
    if (shareId) {
      open(); view = 'busy'; panel.replaceChildren(header('Someone sent you a project'), h('p', { text: 'Opening the link…' }));
      try { const s = await openShare(shareId); if (!s.state || !Array.isArray(s.state.tattoos)) throw new Error('That link does not hold an Ink Atlas project.'); show('shared', s); }
      catch (e) { show(user() ? 'home' : 'signin'); msg(plainError(e)); }
    }
  }

  return {
    configured: true, saved, start, unbind, sendLink,
    status: () => ({ configured: true, signedIn: !!user(), user: user() ? { id: user().id, email: user().email } : null, bind: myBind(), following: following(), view, open: !root.hidden, text: lastStatus, pushing }),
    push, pull, displayName: () => (user() && cloud ? cloud.displayName() : ''),
    // the selected tattoo changed: tell anyone else here
    nudge: () => liveTrack(), here: () => liveOthers.slice(), people,
    // opens the panel at "Work on it together" (New to try's Show me)
    async showForgot() { try { await ready(); } catch (e) { api.toast(plainError(e)); return; } open(); if (user()) { show('home'); return; } mode = 'signin'; show('signin'); },
    async showPrefs() { try { await ready(); } catch (e) { return; } open(); show(user() ? 'home' : 'signin'); const d = root.querySelector('details.acct-more'); if (d) d.open = true; },
    async showTogether() { try { await ready(); } catch (e) { api.toast(plainError(e)); return; } open(); show(user() ? 'home' : 'signin'); return document.getElementById(user() ? 'acctTogether' : 'accountBtn'); },
  };
}
