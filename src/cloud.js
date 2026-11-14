// Accounts and cloud saves (Supabase). Everything that talks to the server lives here;
// src/account.js is the screens and the syncing on top of it.
//
// Config comes from the build: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, set from the
// repository's GitHub Actions secrets when the site is deployed. Without them the app runs
// exactly as before, on this device only, and the account button stays hidden.
//
// Server side (supabase/setup.sql): table `projects` (one row per project, owner only),
// table `shares` (frozen copies opened by link through get_share()), bucket `artwork`
// (<user id>/<image key>, private) and bucket `shared-artwork` (<user id>/<share id>/<key>).
// Artwork keys never change their picture, so a file that is already up is never sent again.

const URL_ = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
// Emailed codes need the project's own email sender (Supabase's built-in one only reaches the
// project team's addresses), so they are offered only when VITE_SUPABASE_EMAIL_CODES is 1.
export const emailCodes = import.meta.env.VITE_SUPABASE_EMAIL_CODES === '1';
export const cloudConfigured = /^https?:\/\/[^\s/]+/.test(URL_) && KEY.length > 20;

// A storage path for an artwork key. Plain keys are used as they are; anything else is
// written as hex so the path is always valid and always the same for the same key.
export function pathKey(k) {
  if (/^[A-Za-z0-9._-]{1,120}$/.test(k)) return k;
  return 'x' + Array.from(new TextEncoder().encode(k), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 240);
}
const dataToBlob = async (u) => (await fetch(u)).blob();
const blobToData = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('Could not read artwork')); r.readAsDataURL(b); });
// A short, unguessable id for a shared link (128 bits, base64url).
export function linkId() { const b = new Uint8Array(16); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
const plain = (e) => {
  const m = String((e && (e.message || e.error_description || e.error)) || e || 'Something went wrong');
  if (/invalid login credentials/i.test(m)) return 'That email and password do not match an account.';
  if (/already registered|already exists/i.test(m)) return 'There is already an account with that email. Sign in instead.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: open the link in the email we sent, then sign in.';
  if (/password should be|at least 6/i.test(m)) return 'Use a password of at least 6 characters.';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Too many tries for now. Wait a minute and try again.';
  if (/token has expired|otp.*(expired|invalid)|invalid.*token/i.test(m)) return 'That code did not work or has expired. Ask for a new one.';
  if (/error sending|smtp|sending.*email/i.test(m)) return 'The email could not be sent. Use a password instead.';
  if (/failed to fetch|network|load failed/i.test(m)) return 'No connection to your account right now. Your work is still saved on this device.';
  if (/unable to validate email|invalid email/i.test(m)) return 'That email address does not look right.';
  return m;
};
export const plainError = plain;
const check = ({ data, error }) => { if (error) throw new Error(plain(error)); return data; };

let clientPromise = null;
function client() {
  if (!cloudConfigured) return Promise.reject(new Error('Accounts are not switched on for this copy of Ink Atlas.'));
  if (!clientPromise) clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ia-auth' } }));
  return clientPromise;
}
const homeUrl = () => location.origin + location.pathname;

export async function openCloud() {
  const sb = await client();
  let user = (await sb.auth.getSession()).data.session?.user || null;
  const listeners = new Set();
  sb.auth.onAuthStateChange((event, session) => {
    const next = session?.user || null;
    if ((next && next.id) === (user && user.id) && event !== 'USER_UPDATED') { user = next; return; }
    user = next; for (const fn of listeners) fn(user, event);
  });
  const uid = () => { if (!user) throw new Error('Sign in first.'); return user.id; };

  async function uploadArtwork(bucket, folder, images, keys, done) {
    const todo = keys.filter((k) => typeof images[k] === 'string' && !(done && done.has(k)));
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const k = todo[i++];
        const blob = await dataToBlob(images[k]);
        // sent as raw bytes with its type (a Blob would go as a form upload)
        const { error } = await sb.storage.from(bucket).upload(folder + '/' + pathKey(k), await blob.arrayBuffer(), { contentType: blob.type || 'image/png', upsert: false, cacheControl: '31536000' });
        // the same key always holds the same picture, so "already there" means done
        if (error && !/exists|duplicate|409/i.test(String(error.message || '') + (error.statusCode || ''))) throw new Error(plain(error));
        if (done) done.add(k);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker));
  }
  async function downloadArtwork(get, keys) {
    const images = {}, missing = []; let i = 0;
    const worker = async () => {
      while (i < keys.length) {
        const k = keys[i++];
        try { const b = await get(pathKey(k)); const u = await blobToData(b); if (typeof u === 'string' && u.startsWith('data:image/')) images[k] = u; else missing.push(k); }
        catch (e) { missing.push(k); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, keys.length) }, worker));
    return { images, missing };
  }
  const row = (state, images, name) => {
    const keys = Object.keys(images).filter((k) => typeof images[k] === 'string');
    return { name: String(name || 'My tattoos').trim().slice(0, 80) || 'My tattoos', state, image_keys: keys, tattoos: Array.isArray(state.tattoos) ? state.tattoos.length : 0 };
  };

  return {
    get user() { return user; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    displayName(u = user) { return (u && (u.user_metadata?.name || '').trim()) || (u && u.email ? u.email.split('@')[0] : ''); },

    async signUp(email, password, name) {
      const d = check(await sb.auth.signUp({ email, password, options: { data: name ? { name: String(name).slice(0, 60) } : {}, emailRedirectTo: homeUrl() } }));
      return { needsConfirm: !d.session };
    },
    async signIn(email, password) { check(await sb.auth.signInWithPassword({ email, password })); },
    async sendCode(email) { check(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: homeUrl() } })); },
    async verifyCode(email, token) { check(await sb.auth.verifyOtp({ email, token: String(token).replace(/\s+/g, ''), type: 'email' })); },
    async setPassword(password) { check(await sb.auth.updateUser({ password })); },
    async setName(name) { check(await sb.auth.updateUser({ data: { name: String(name).slice(0, 60) } })); },
    async signOut() { const { error } = await sb.auth.signOut({ scope: 'local' }); if (error) throw new Error(plain(error)); user = null; },

    // Projects -------------------------------------------------------------
    async list() {
      return check(await sb.from('projects').select('id,name,tattoos,rev,updated_at').eq('archived', false).order('updated_at', { ascending: false }).limit(200));
    },
    async meta(id) {
      const d = check(await sb.from('projects').select('id,name,rev,archived,updated_at').eq('id', id).limit(1));
      return d && d[0] && !d[0].archived ? d[0] : null;
    },
    // done: the set of artwork keys known to be up already (kept by the caller per user).
    async create(state, images, name, done) {
      const me = uid(), r = row(state, images, name);
      await uploadArtwork('artwork', me, images, r.image_keys, done);
      return check(await sb.from('projects').insert(r).select('id,name,rev,updated_at').single());
    },
    // Saves only if nobody else saved since `rev`. Returns the new row, or { conflict: true }.
    async save(id, rev, state, images, name, done) {
      const me = uid(), r = row(state, images, name);
      await uploadArtwork('artwork', me, images, r.image_keys, done);
      const d = check(await sb.from('projects').update({ ...r, rev: rev + 1 }).eq('id', id).eq('rev', rev).select('id,name,rev,updated_at'));
      return d && d[0] ? d[0] : { conflict: true };
    },
    async load(id) {
      const me = uid();
      const p = check(await sb.from('projects').select('id,name,state,image_keys,rev,updated_at').eq('id', id).single());
      const keys = Array.isArray(p.image_keys) ? p.image_keys.filter((k) => typeof k === 'string') : [];
      const { images, missing } = await downloadArtwork(async (path) => check(await sb.storage.from('artwork').download(me + '/' + path)), keys);
      return { id: p.id, name: p.name, rev: p.rev, state: p.state, images, missing, keys };
    },
    async rename(id, name) { check(await sb.from('projects').update({ name: String(name).trim().slice(0, 80) || 'My tattoos' }).eq('id', id).select('id')); },
    async remove(id) { check(await sb.from('projects').update({ archived: true }).eq('id', id).select('id')); },

    // Sending a copy to someone ---------------------------------------------
    async share(state, images, name) {
      const me = uid(), id = linkId(), r = row(state, images, name);
      await uploadArtwork('shared-artwork', me + '/' + id, images, r.image_keys, null);
      check(await sb.from('shares').insert({ id, name: r.name, from_name: this.displayName() || null, state, image_keys: r.image_keys }));
      return id;
    },
  };
}

// Opening a link someone sent works signed out too, so it does not need a session.
export async function openShare(id) {
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(id || '')) throw new Error('That link is not complete.');
  const sb = await client();
  const d = check(await sb.rpc('get_share', { share_id: id }));
  const s = Array.isArray(d) ? d[0] : d;
  if (!s) throw new Error('That link no longer works. Ask for a new one.');
  const keys = Array.isArray(s.image_keys) ? s.image_keys.filter((k) => typeof k === 'string') : [];
  const images = {}, missing = []; let i = 0;
  const worker = async () => {
    while (i < keys.length) {
      const k = keys[i++];
      try {
        const url = sb.storage.from('shared-artwork').getPublicUrl(s.folder + '/' + pathKey(k)).data.publicUrl;
        const res = await fetch(url); if (!res.ok) throw new Error(res.status);
        const u = await blobToData(await res.blob()); if (typeof u === 'string' && u.startsWith('data:image/')) images[k] = u; else missing.push(k);
      } catch (e) { missing.push(k); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, keys.length) }, worker));
  return { id: s.id, name: s.name, fromName: s.from_name || '', state: s.state, images, missing };
}
