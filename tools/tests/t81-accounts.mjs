// Accounts end to end, against tools/fake-supabase.mjs (a real PostgreSQL running
// supabase/setup.sql). Needs a build made for it:
//   VITE_SUPABASE_URL=http://127.0.0.1:54329 VITE_SUPABASE_ANON_KEY=test-anon-key-for-the-fake-supabase VITE_SUPABASE_EMAIL_CODES=1 \
//     npx vite build --outDir "$PWD/dist-accounts" --emptyOutDir
//   PGHOST=/var/run/postgresql PGUSER=$USER INK_DIST=dist-accounts node tools/shot.mjs shots/t81.png tools/tests/t81-accounts.mjs
// Covers: signed out nothing is fetched; make an account; add this device's work; changes go up;
// sign in on a second device and open it there; a change there comes back to the first device;
// both devices changing keeps both; send a link; the person opening it makes their own account
// and gets their own copy; they cannot read the sender's projects; emailed-code sign-in;
// sign out and clear the screen. Saves shots/t81-*.png.
import assert from 'node:assert/strict';
import { startFakeSupabase } from '../fake-supabase.mjs';

export default async function (p) {
  const fake = await startFakeSupabase({ port: 54329 });
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const until = async (pg, fn, arg, what, ms = 20000) => { try { await pg.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); } catch (e) { const st = await pg.evaluate(() => JSON.stringify({ a: window.__ink && window.__ink.account(), panel: (document.querySelector('#account') || {}).textContent, toast: document.querySelector('#toast').textContent })).catch(() => ''); throw new Error('timed out: ' + what + '\n' + st + '\n' + fake.log.slice(-12).join('\n')); } };
  const db = async (sql, args) => (await fake.pool.query(sql, args)).rows;
  const acct = (pg) => pg.evaluate(() => window.__ink.account());
  const clickText = async (pg, text) => { const ok = await pg.evaluate((t) => { const b = [...document.querySelectorAll('#account button')].find((x) => x.textContent.trim() === t && !x.disabled && x.offsetParent); if (b) b.click(); return !!b; }, text); assert.ok(ok, 'button ' + text); };
  const type = async (pg, sel, text) => { await wait(150); await pg.$eval(sel, (e) => { e.value = ''; }); await pg.type(sel, text); assert.equal(await pg.$eval(sel, (e) => e.value), text, 'typed into ' + sel); };
  const openPage = async () => {
    const ctx = await p.browser().createBrowserContext(); const q = await ctx.newPage();
    await q.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1 });
    q.on('pageerror', (e) => console.log('PAGEERROR(2)', e.message));
    return q;
  };
  const ready = async (pg, url) => { if (url) await pg.goto(url, { waitUntil: 'load' }); await until(pg, () => window.__ink && window.__ink.ready() && window.__ink.account(), null, 'app ready'); await pg.evaluate(() => { const c = document.querySelector('#coachOk'); if (c && c.offsetParent) c.click(); }); };
  try {
    const url = p.url().split('?')[0];
    await ready(p);
    await wait(800);
    // signed out: the account button shows, nothing has talked to the server
    assert.equal(await p.$eval('#accountBtn', (e) => !e.hidden && e.getBoundingClientRect().height >= 44), true, 'account button shows, big enough');
    assert.equal(fake.log.length, 0, 'signed out, nothing is fetched: ' + fake.log.join(','));
    assert.equal(await p.$eval('#cLink', (e) => e.hidden), false, 'Send to someone is in Share');

    // make an account on device A
    await p.click('#accountBtn');
    await until(p, () => document.querySelector('#account input[type=email]'), null, 'sign in form');
    await p.screenshot({ path: 'shots/t81-signin.png' });
    await type(p, '#account input[autocomplete=name]', 'Jake');
    await type(p, '#account input[type=email]', 'jake@example.com');
    await type(p, '#account input[type=password]', 'tattoos1');
    await clickText(p, 'Create account');
    await until(p, () => window.__ink.account().view === 'move', null, 'asked to add this device\'s work');
    await p.screenshot({ path: 'shots/t81-move.png' });
    const tattoos = await p.evaluate(() => window.__ink.state().tattoos.length);
    await clickText(p, 'Add to my account');
    await until(p, () => !!window.__ink.account().bind && window.__ink.account().view === 'home', null, 'bound to the account');
    let rows = await db('select p.id, p.name, p.tattoos, p.rev, p.image_keys, u.email from public.projects p join auth.users u on u.id = p.owner');
    assert.equal(rows.length, 1); assert.equal(rows[0].email, 'jake@example.com'); assert.equal(rows[0].tattoos, tattoos);
    const owner = (await db(`select id from auth.users where email = 'jake@example.com'`))[0].id;
    for (const k of rows[0].image_keys) assert.ok(fake.files.has('artwork/' + owner + '/' + k), 'artwork uploaded: ' + k);
    await until(p, () => document.querySelectorAll('#account .acct-item').length === 1, null, 'listed');
    await p.screenshot({ path: 'shots/t81-home.png' });
    assert.equal(await p.$eval('#accountBtn', (e) => e.classList.contains('signed') && e.textContent.trim()), 'J');
    await p.click('#account header .btn');

    // a change on A goes up
    await p.evaluate(() => { window.__ink.state().tattoos[0].name = 'Changed on A'; window.__ink.commitTest(); });
    await until(p, () => window.__ink.account().bind.rev === 2 && window.__ink.account().text === 'Saved to your account', null, 'A saved up');
    rows = await db('select rev, state from public.projects'); assert.equal(rows[0].rev, 2); assert.equal(rows[0].state.tattoos[0].name, 'Changed on A');
    const uploadsBefore = fake.log.filter((l) => l.startsWith('POST /storage')).length;

    // device B: sign in, say not now, open it from the account
    const q = await openPage(); await ready(q, url); await wait(500);
    await q.click('#accountBtn'); await until(q, () => document.querySelector('#account input[type=email]'), null, 'B form');
    await clickText(q, 'I have an account');
    await type(q, '#account input[type=email]', 'jake@example.com');
    await type(q, '#account input[type=password]', 'wrongpass');
    await clickText(q, 'Sign in');
    await until(q, () => /do not match/.test(document.querySelector('#account .acct-msg').textContent), null, 'wrong password said plainly');
    await type(q, '#account input[type=password]', 'tattoos1');
    await clickText(q, 'Sign in');
    await until(q, () => window.__ink.account().view === 'move', null, 'B asked');
    await clickText(q, 'Not now');
    await until(q, () => [...document.querySelectorAll('#account .acct-item button')].some((b) => b.textContent === 'Open'), null, 'B lists the project');
    // B's own sample project never went up
    assert.equal((await db('select count(*)::int n from public.projects'))[0].n, 1, 'Not now sends nothing');
    await clickText(q, 'Open');
    await until(q, () => !!window.__ink.account().bind && document.querySelector('#account').hidden, null, 'B opened it');
    const onB = await q.evaluate(() => window.__ink.state().tattoos.map((t) => t.name));
    assert.equal(onB[0], 'Changed on A', 'B shows A\'s work'); assert.equal(onB.length, tattoos);
    assert.ok(await q.evaluate(() => window.__ink.state().tattoos.every((t) => typeof window.__ink.imageOf(t.img) === 'string')), 'artwork came down');
    await wait(2500);
    assert.equal((await db('select rev from public.projects'))[0].rev, 2, 'opening it does not save a new version');
    // B changes it; A picks it up on coming back
    await q.evaluate(() => { window.__ink.state().tattoos[0].name = 'Changed on B'; window.__ink.commitTest(); });
    await until(q, () => window.__ink.account().text === 'Saved to your account' && window.__ink.account().bind.rev === 3, null, 'B saved up');
    assert.equal(fake.log.filter((l) => l.startsWith('POST /storage')).length, uploadsBefore, 'artwork already up is not sent again');
    await p.evaluate(() => window.__ink.accountApi().pull());
    await until(p, () => window.__ink.state().tattoos[0].name === 'Changed on B', null, 'A got B\'s change');
    assert.equal(await p.evaluate(() => window.__ink.account().bind.rev), 3);
    // both change before seeing each other's: both kept
    await p.evaluate(() => { window.__ink.state().tattoos[0].name = 'A again'; window.__ink.commitTest(); });
    await until(p, () => window.__ink.account().bind.rev === 4 && window.__ink.account().text === 'Saved to your account', null, 'A saved');
    await q.evaluate(() => { window.__ink.state().tattoos[0].name = 'B again'; window.__ink.commitTest(); });
    await until(q, () => /\(/.test(window.__ink.account().bind.name || '') && window.__ink.account().text === 'Saved to your account', null, 'B kept as its own project');
    rows = await db('select name, state from public.projects order by created_at');
    assert.equal(rows.length, 2); assert.equal(rows[0].state.tattoos[0].name, 'A again'); assert.equal(rows[1].state.tattoos[0].name, 'B again');
    assert.match(await q.$eval('#toast', (e) => e.textContent), /also changed on another device/);

    await q.browserContext().close();
    // send a link from A
    await p.click('#shareBtn'); await wait(200); await p.click('#cLink');
    await until(p, () => window.__ink.account().view === 'link', null, 'link made');
    const link = await p.$eval('#account .acct-link', (e) => e.value);
    assert.match(link, /\?share=[A-Za-z0-9_-]{22}$/);
    await p.screenshot({ path: 'shots/t81-link.png' });
    await p.click('#account header .btn');

    // Liv opens it on her phone, signed out
    const r = await openPage(); await r.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await ready(r, link);
    await until(r, () => window.__ink.account().view === 'shared', null, 'shared view');
    assert.ok(!(await r.evaluate(() => location.search)).includes('share'), 'the link id leaves the address bar');
    assert.match(await r.$eval('#account', (e) => e.textContent), /Jake sent you/);
    await r.screenshot({ path: 'shots/t81-shared.png' });
    await clickText(r, 'Open it');
    await until(r, () => window.__ink.account().view === 'signin', null, 'offered an account');
    assert.equal(await r.evaluate(() => window.__ink.state().tattoos[0].name), 'A again', 'the shared project is open');
    assert.ok(await r.evaluate(() => window.__ink.state().tattoos.every((t) => typeof window.__ink.imageOf(t.img) === 'string')), 'shared artwork came down');
    await type(r, '#account input[autocomplete=name]', 'Liv');
    await type(r, '#account input[type=email]', 'liv@example.com');
    await type(r, '#account input[type=password]', 'livpass1');
    await clickText(r, 'Create account');
    await until(r, () => !!window.__ink.account().bind && window.__ink.account().text === 'Saved to your account', null, 'saved into Liv\'s account');
    const liv = (await db(`select id from auth.users where email = 'liv@example.com'`))[0].id;
    rows = await db('select owner, state, image_keys from public.projects where owner = $1', [liv]);
    assert.equal(rows.length, 1, 'Liv has her own copy'); for (const k of rows[0].image_keys) assert.ok(fake.files.has('artwork/' + liv + '/' + k), 'her copy of the artwork');
    // Liv's sign-in cannot read Jake's projects or artwork, straight from the server
    const peek = await r.evaluate(async ([api, jake, key]) => {
      const tok = JSON.parse(localStorage.getItem('ia-auth')).access_token, h = { apikey: 'x', Authorization: 'Bearer ' + tok };
      const rows = await (await fetch(api + '/rest/v1/projects?select=id,owner', { headers: h })).json();
      const file = await fetch(api + '/storage/v1/object/artwork/' + jake + '/' + key, { headers: h });
      return { owners: rows.map((x) => x.owner), file: file.status };
    }, [fake.url, owner, rows[0].image_keys[0]]);
    assert.deepEqual(peek.owners, [liv], 'only her own rows'); assert.notEqual(peek.file, 200, 'not Jake\'s artwork');
    // her list shows only hers
    await r.click('#accountBtn'); await until(r, () => document.querySelectorAll('#account .acct-item').length === 1, null, 'Liv list');
    await r.screenshot({ path: 'shots/t81-liv.png' });
    // sign out and clear the screen
    await clickText(r, 'Sign out'); await wait(100);
    await clickText(r, 'Sign out and clear this screen');
    await until(r, () => !window.__ink.account().signedIn && window.__ink.state().tattoos.length === 0, null, 'signed out and cleared');
    assert.equal(await r.evaluate(() => localStorage.getItem('ia-cloud-follow')), null, 'the next person here is asked again');

    await r.browserContext().close();
    // sign in with an emailed code, on a fresh device
    const s = await openPage(); await ready(s, url);
    await s.click('#accountBtn'); await until(s, () => document.querySelector('#account input[type=email]'), null, 'code form');
    await type(s, '#account input[type=email]', 'jake@example.com');
    await clickText(s, 'Sign up with an emailed code instead');
    await until(s, () => window.__ink.account().view === 'code', null, 'code view');
    const code = fake.codes.get('jake@example.com'); assert.ok(code);
    await type(s, '#account input[autocomplete=one-time-code]', '000000'); await clickText(s, 'Sign in');
    await until(s, () => /did not work/.test(document.querySelector('#account .acct-msg').textContent), null, 'wrong code said plainly');
    await s.evaluate(() => {}); fake.codes.set('jake@example.com', code);
    await type(s, '#account input[autocomplete=one-time-code]', code); await clickText(s, 'Sign in');
    await until(s, () => window.__ink.account().signedIn && window.__ink.account().view === 'move', null, 'signed in by code');
    // touch targets in the panel
    const small = await s.evaluate(() => [...document.querySelectorAll('#account button, #account input:not([type=checkbox])')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent || e.placeholder));
    assert.deepEqual(small, [], 'everything in the panel is at least 44 points tall');
    for (const pg of [s]) await pg.browserContext().close();
    console.log('t81 accounts: ok');
  } finally { await fake.stop(); }
}
