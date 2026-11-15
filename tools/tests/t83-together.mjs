// Working on a project together, end to end against tools/fake-supabase.mjs (a real PostgreSQL
// running supabase/setup.sql). Same build as t81:
//   npm run build:accounts-test
//   PGHOST=/var/run/postgresql PGUSER=$USER INK_DIST=dist-accounts node tools/shot.mjs shots/t83.png tools/tests/t83-together.mjs
// Covers: Jake invites from his account panel (sharing switches on, artwork copied to the
// project's folder); Liv opens the link signed out, makes her account and lands in the project;
// her change reaches Jake's screen by itself without losing his view; Looks good / Ask for a
// change on her side shows on his with her name; a comment Jake pins on the body reaches her;
// both changing at once keeps both changes in one project (no copy); she cannot rename or remove
// it and sees Leave; Jake takes her off and her screen says so; forgot password by emailed code.
// Who is here now: each sees the other's initial, which tattoo the other has selected (in the
// tray and the account panel), on a channel whose name does not give the project away; Jake
// follows Liv's view until he touches the body; Liv points at a spot and Jake sees it.
import assert from 'node:assert/strict';
import { startFakeSupabase } from '../fake-supabase.mjs';

export default async function (p) {
  const fake = await startFakeSupabase({ port: 54329 });
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const until = async (pg, fn, arg, what, ms = 20000) => { try { await pg.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); } catch (e) { const st = await pg.evaluate(() => JSON.stringify({ a: window.__ink && window.__ink.account(), panel: (document.querySelector('#account') || {}).textContent, toast: document.querySelector('#toast').textContent })).catch(() => ''); throw new Error('timed out: ' + what + '\n' + st + '\n' + fake.log.slice(-12).join('\n')); } };
  const db = async (sql, args) => (await fake.pool.query(sql, args)).rows;
  const clickText = async (pg, text) => { const ok = await pg.evaluate((t) => { const b = [...document.querySelectorAll('#account button')].find((x) => x.textContent.trim() === t && !x.disabled && x.offsetParent); if (b) b.click(); return !!b; }, text); assert.ok(ok, 'button ' + text); };
  const hasText = (pg, text) => pg.evaluate((t) => [...document.querySelectorAll('#account button')].some((x) => x.textContent.trim() === t && x.offsetParent), text);
  const type = async (pg, sel, text) => { await wait(150); await pg.$eval(sel, (e) => { e.value = ''; }); await pg.type(sel, text); assert.equal(await pg.$eval(sel, (e) => e.value), text, 'typed into ' + sel); };
  const toastText = (pg) => pg.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
  const openPage = async () => {
    const ctx = await p.browser().createBrowserContext(); const q = await ctx.newPage();
    await q.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1 });
    q.on('pageerror', (e) => console.log('PAGEERROR(2)', e.message));
    q.on('console', (m) => { const t = m.text(); if (/error/i.test(m.type()) && !/GPU stall|fonts\.g|ERR_|Failed to load resource/.test(t)) console.log('console(2):', t); });
    return q;
  };
  const ready = async (pg, url) => { if (url) await pg.goto(url, { waitUntil: 'load' }); await until(pg, () => window.__ink && window.__ink.ready() && window.__ink.account(), null, 'app ready'); await pg.evaluate(() => { const c = document.querySelector('#coachOk'); if (c && c.offsetParent) c.click(); }); };
  const makeAccount = async (pg, name, email, pass) => {
    await until(pg, () => document.querySelector('#account input[type=email]'), null, 'sign in form');
    await type(pg, '#account input[autocomplete=name]', name);
    await type(pg, '#account input[type=email]', email);
    await type(pg, '#account input[type=password]', pass);
    await clickText(pg, 'Create account');
  };
  try {
    const url = p.url().split('?')[0];
    await ready(p); await wait(800);

    // Jake: account, then Invite someone from his account panel
    await p.click('#accountBtn');
    await makeAccount(p, 'Jake', 'jake@example.com', 'tattoos1');
    await until(p, () => window.__ink.account().view === 'move', null, 'asked to add this device\'s work');
    await clickText(p, 'Add to my account');
    await until(p, () => !!window.__ink.account().bind && window.__ink.account().view === 'home' && document.querySelector('#acctInvite'), null, 'home with Invite someone');
    assert.ok(await p.$eval('#acctInvite', (e) => e.getBoundingClientRect().height >= 44), 'Invite button big enough');
    await p.click('#acctInvite');
    await until(p, () => window.__ink.account().view === 'inviteRole', null, 'asked how they can work on it');
    await p.click('#acctInviteEdit');
    await until(p, () => window.__ink.account().view === 'invite', null, 'invite link made');
    await p.screenshot({ path: 'shots/t83-invite.png' });
    const link = await p.$eval('#account .acct-link', (e) => e.value);
    assert.match(link, /\?join=[A-Za-z0-9_-]{22}$/, 'a long random invite link');
    const [proj] = await db('select id, shared, owner_name, image_keys from public.projects');
    assert.equal(proj.shared, true, 'sharing switched on'); assert.equal(proj.owner_name, 'Jake');
    for (const k of proj.image_keys) assert.ok(fake.files.has('artwork/p/' + proj.id + '/' + k), 'artwork copied to the project folder: ' + k);
    assert.equal((await db('select count(*)::int n from public.invites'))[0].n, 1);
    assert.equal((await p.evaluate(() => window.__ink.account().bind)).shared, true);
    await p.click('#account header .btn');

    // Liv: opens the link signed out, makes her account, lands in Jake's project
    const q = await openPage();
    await q.goto(link, { waitUntil: 'load' });
    await until(q, () => window.__ink && window.__ink.ready() && document.querySelector('#account input[type=email]') && !document.querySelector('#account').hidden, null, 'Liv asked to sign in');
    assert.match(await q.$eval('#account', (e) => e.textContent), /invited you/, 'says she was invited');
    assert.equal(await q.evaluate(() => location.search), '', 'the invite is taken out of the address');
    await q.screenshot({ path: 'shots/t83-join-signin.png' });
    await makeAccount(q, 'Liv', 'liv@example.com', 'inkink1');
    await until(q, () => { const b = window.__ink.account().bind; return b && b.shared && b.mine === false; }, null, 'Liv is in the project');
    assert.match(await toastText(q), /You joined/, 'told she joined');
    const liv = (await db(`select id from auth.users where email = 'liv@example.com'`))[0].id;
    assert.deepEqual(await db('select user_id, name from public.project_members'), [{ user_id: liv, name: 'Liv' }]);
    const jakeNames = await p.evaluate(() => window.__ink.state().tattoos.map((t) => t.name));
    assert.deepEqual(await q.evaluate(() => window.__ink.state().tattoos.map((t) => t.name)), jakeNames, 'she sees the same tattoos');
    assert.equal((await db(`select count(*)::int n from public.projects where owner = $1`, [liv]))[0].n, 0, 'joining makes no project of her own');

    // who is here now: each sees the other, and which tattoo the other has selected
    await until(p, () => window.__ink.peers().some((o) => o.name === 'Liv'), null, 'Jake sees Liv is here', 20000);
    await until(q, () => window.__ink.peers().some((o) => o.name === 'Jake'), null, 'Liv sees Jake is here', 20000);
    let here = await p.$eval('#hereNow', (e) => ({ shown: !e.hidden && !!e.offsetParent, text: e.textContent, label: e.getAttribute('aria-label'), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width }));
    assert.equal(here.shown, true, 'her initial shows by the account button'); assert.equal(here.text, 'L'); assert.equal(here.label, 'Liv is here now');
    assert.ok(here.h >= 44 && here.w >= 44, 'big enough to tap');
    const rooms = fake.topicsNow();
    assert.equal(rooms.length, 1, 'one channel for the project'); assert.equal(rooms[0].keys.length, 2, 'both on it');
    assert.ok(!rooms[0].topic.includes(proj.id), 'the channel name does not give away the project');
    const look = await q.evaluate(() => window.__ink.state().tattoos[1].id), lookName = await q.evaluate(() => window.__ink.state().tattoos[1].name);
    await q.evaluate((id) => window.__ink.select(id), look);
    await until(p, (id) => window.__ink.peers().some((o) => o.name === 'Liv' && o.look === id), look, 'Jake sees which tattoo she has selected', 10000);
    const chip = await p.evaluate((n) => { const c = [...document.querySelectorAll('#trayItems .chip')].find((x) => x.querySelector('span').textContent === n); const m = c && c.querySelector('b.peer'); return { mark: m && m.textContent, label: c && c.getAttribute('aria-label') }; }, lookName);
    assert.equal(chip.mark, 'L', 'her initial on that tattoo in the tray'); assert.match(chip.label, /Liv looking at it/);
    assert.equal(await p.$$eval('#trayItems b.peer', (e) => e.length), 1, 'and on no other');
    await p.click('#hereNow');
    await until(p, () => [...document.querySelectorAll('#acctTogether [data-uid]')].some((e) => /Here now · looking at/.test(e.textContent)), null, 'the account panel says what she is looking at, on her own row');
    assert.equal(await p.$$eval('#acctTogether .acct-item', (e) => e.filter((x) => /Liv/.test(x.textContent)).length), 1, 'she is listed once');
    assert.match(await p.$eval('#acctTogether', (e) => e.textContent), new RegExp('Liv.*Here now · looking at ' + lookName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await p.screenshot({ path: 'shots/t83-here-now.png' });
    await p.click('#account header .btn');
    await q.click('#hereNow');
    await until(q, () => /Jake.*owns this project.*Here now/.test((document.querySelector('#acctTogether [data-owner]') || {}).textContent || ''), null, 'Liv sees Jake here on his row');
    await q.click('#account header .btn');
    await q.evaluate(() => window.__ink.select(null));
    await until(p, () => !document.querySelector('#trayItems b.peer'), null, 'the mark goes when she lets go', 10000);

    // Jake follows Liv's view: her camera turns to the back and his goes with it; a touch on the body stops it
    await until(p, () => window.__ink.peers().some((o) => o.name === 'Liv' && o.view), null, 'her view is shared', 10000);
    await p.click('#hereNow');
    await until(p, () => !!document.querySelector('#acctTogether .acct-follow'), null, 'Follow their view offered');
    await until(p, () => document.querySelector('#acctTogether .acct-follow').getBoundingClientRect().height >= 44, null, 'Follow big enough, once the panel is in', 3000);
    await p.evaluate(() => document.querySelector('#acctTogether .acct-follow').click());
    await until(p, () => window.__ink.following() && !document.querySelector('#followBar').hidden, null, 'following her view');
    assert.match(await p.$eval('#followText', (e) => e.textContent), /Following Liv.s view/);
    assert.equal(await p.$eval('#account', (e) => e.hidden), true, 'the panel closes');
    await q.evaluate(() => document.querySelector('[data-view="2"]').click());
    await until(p, () => window.__ink.cam()[2] < -0.5, null, 'Jake\'s view turns to the back with hers', 15000);
    await p.screenshot({ path: 'shots/t83-follow.png' });
    await p.mouse.click(60, 600);
    await until(p, () => !window.__ink.following() && document.querySelector('#followBar').hidden, null, 'a touch on the body stops following');
    const camAfter = await p.evaluate(() => window.__ink.cam());
    await q.evaluate(() => document.querySelector('[data-view="0"]').click()); await wait(2500);
    assert.ok((await p.evaluate(() => window.__ink.cam()))[2] < -0.5, 'and her view no longer moves his');
    assert.ok(camAfter[2] < -0.5);
    await p.evaluate(() => document.querySelector('[data-view="0"]').click()); // back to the front for the rest
    for (let i = 0, last = ''; i < 40; i++) { const c = JSON.stringify(await p.evaluate(() => window.__ink.cam())); if (c === last) break; last = c; await wait(400); } // let his view settle

    // Liv points at a spot: a ring with her name shows there on Jake's screen, then fades
    const settle = async (pg) => { for (let i = 0, last = ''; i < 40; i++) { const c = JSON.stringify(await pg.evaluate(() => window.__ink.cam())); if (c === last) break; last = c; await wait(400); } };
    await settle(q);
    assert.equal((await p.evaluate(() => window.__ink.points())).button, true, 'Point shows for Jake with Liv here');
    assert.equal((await q.evaluate(() => window.__ink.points())).button, true, 'and for Liv');
    await q.click('#showSpotBtn');
    assert.equal((await q.evaluate(() => window.__ink.points())).on, true, 'Point mode on');
    assert.match(await toastText(q), /Tap the body to show Jake a spot/);
    const tPos = await q.evaluate(() => window.__ink.state().tattoos[0].pos);
    const qSpot = await q.evaluate((pos) => window.__ink.screenOfPos(pos), tPos);
    const selBefore = await q.evaluate(() => window.__ink.state().tattoos.map((t) => t.id));
    await q.mouse.click(qSpot.x, qSpot.y);
    let qs = await q.evaluate(() => window.__ink.points());
    assert.ok(qs.mine, 'her spot is set'); assert.ok(qs.marks.some((m) => m.text === 'You' && m.shown), 'she sees her own ring');
    assert.deepEqual(await q.evaluate(() => window.__ink.state().tattoos.map((t) => t.id)), selBefore, 'pointing changes nothing in the project');
    await until(p, () => window.__ink.points().marks.some((m) => m.text === 'Liv' && m.shown), null, 'Jake sees her ring', 10000);
    const pSpot = await p.evaluate((pos) => window.__ink.screenOfPos(pos), tPos), mark = (await p.evaluate(() => window.__ink.points())).marks.find((m) => m.text === 'Liv');
    assert.ok(Math.hypot(mark.x - pSpot.x, mark.y - pSpot.y) < 30, 'on the same spot of the body on his screen: ' + JSON.stringify([mark, pSpot]));
    await p.screenshot({ path: 'shots/t83-point.png' });
    await until(p, () => !window.__ink.points().marks.length, null, 'the ring fades after a few seconds', 12000);
    // pointing again while Jake looks at the back: he is offered a Show that turns him to it
    await p.evaluate(() => document.querySelector('[data-view="2"]').click()); await settle(p);
    await q.mouse.click(qSpot.x, qSpot.y + 4);
    await until(p, () => /Liv is pointing at a spot/.test(document.querySelector('#toast').textContent), null, 'Jake told she is pointing somewhere out of sight', 10000);
    await p.evaluate(() => [...document.querySelectorAll('#toast button')].find((b) => b.textContent === 'Show').click());
    await until(p, () => window.__ink.cam()[2] > 0.3, null, 'Show turns him to her spot', 10000);
    await q.click('#showSpotBtn');
    assert.equal((await q.evaluate(() => window.__ink.points())).on, false, 'Point mode off again');
    await p.evaluate(() => document.querySelector('[data-view="0"]').click()); await settle(p);

    // her change reaches Jake by itself, and his view stays where it was
    const view0 = await p.evaluate(() => JSON.stringify(window.__ink.cam ? window.__ink.cam() : null));
    await q.evaluate(() => { window.__ink.state().tattoos[0].name = 'Liv renamed this'; window.__ink.commitTest(); });
    await until(p, () => window.__ink.state().tattoos[0].name === 'Liv renamed this', null, 'Liv\'s change arrives on Jake\'s screen', 15000);
    assert.equal(await p.evaluate(() => JSON.stringify(window.__ink.cam ? window.__ink.cam() : null)), view0, 'Jake\'s view did not move');
    await until(p, () => window.__ink.account().text === 'Saved to your account', null, 'Jake in step');

    // Ask for a change, on Liv's side, shows on Jake's with her name
    const t0 = await q.evaluate(() => window.__ink.state().tattoos[0].id);
    await q.evaluate((id) => window.__ink.select(id), t0); await wait(300);
    assert.equal(await q.evaluate(() => window.__ink.answerShown()), true, 'Looks good / Ask for a change show on a shared project');
    assert.ok(await q.$eval('#bApprove', (e) => e.getBoundingClientRect().height >= 44), 'answer buttons big enough');
    await q.click('#bAskChange'); await wait(150);
    await q.type('#changeNote', 'Move it up an inch');
    await q.screenshot({ path: 'shots/t83-ask-change.png' });
    await q.click('#bSendChange'); await wait(200);
    const rv = await q.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).review, t0);
    assert.equal(rv.verdict, 'changes'); assert.equal(rv.note, 'Move it up an inch'); assert.equal(rv.by, 'Liv'); assert.match(rv.at, /^\d{4}-\d{2}-\d{2}$/);
    await until(p, (id) => { const t = window.__ink.state().tattoos.find((x) => x.id === id); return t && t.review && t.review.by === 'Liv'; }, t0, 'her answer reaches Jake', 15000);
    await until(p, () => /Liv asked for a change/.test(document.querySelector('#toast').textContent), null, 'Jake is told who asked what');
    await p.evaluate((id) => window.__ink.select(id), t0); await wait(300);
    assert.match(await p.$eval('#review', (e) => e.textContent), /Liv asked for a change.*Move it up an inch/, 'shown under the tattoo\'s name');
    await p.screenshot({ path: 'shots/t83-answer-arrives.png' });
    await p.evaluate(() => window.__ink.select(null)); await wait(200);

    // a comment pinned on the body by Jake reaches Liv
    await p.evaluate(() => window.__ink.pinsOn()); await wait(300);
    assert.equal(await p.$eval('#pinBar', (e) => !e.hidden), true, 'comment bar shows');
    const spot = await p.evaluate(() => { const t = window.__ink.state().tattoos[0]; return window.__ink.screenOfPos(t.pos); });
    await p.mouse.click(spot.x, spot.y); await wait(300);
    assert.equal((await p.evaluate(() => window.__ink.pins())).pending, true, 'a tap on the body starts a comment there');
    await p.type('#pinNote', 'Darker lines here');
    await p.click('#pinSave'); await wait(300);
    let pins = await p.evaluate(() => window.__ink.pins());
    assert.equal(pins.n, 1); assert.equal(pins.shown, 1, 'its pin shows on the body'); assert.match(pins.label, /Comments \(1\)/);
    const note = await p.evaluate(() => window.__ink.state().notes.find((n) => n.pin));
    assert.equal(note.text, 'Darker lines here'); assert.equal(note.by, 'Jake'); assert.ok(note.tattooId, 'linked to the tattoo it is on');
    await p.screenshot({ path: 'shots/t83-pin.png' });
    await until(q, () => (window.__ink.state().notes || []).some((n) => n.pin && n.text === 'Darker lines here'), null, 'the comment reaches Liv', 15000);
    await until(q, () => /Jake pinned a comment/.test(document.querySelector('#toast').textContent), null, 'Liv is told');
    // Show opens it on her side
    await q.evaluate(() => [...document.querySelectorAll('#toast button')].find((b) => b.textContent === 'Show').click()); await wait(400);
    pins = await q.evaluate(() => window.__ink.pins());
    assert.equal(pins.on, true); assert.ok(pins.open, 'the comment is open');
    assert.match(await q.$eval('#pinWho', (e) => e.textContent), /Jake/);
    await q.screenshot({ path: 'shots/t83-pin-arrives.png' });
    await q.click('#pinsDone'); await p.click('#pinsDone'); await wait(200);

    // both change at once: both changes kept, still one project
    await until(q, () => window.__ink.account().text === 'Saved to your account', null, 'Liv in step');
    await until(p, () => window.__ink.account().text === 'Saved to your account', null, 'Jake in step again');
    const [idA, idB] = await p.evaluate(() => window.__ink.state().tattoos.slice(0, 2).map((t) => t.id));
    await Promise.all([
      p.evaluate((id) => { window.__ink.state().tattoos.find((t) => t.id === id).width = 0.2; window.__ink.commitTest(); }, idA),
      q.evaluate((id) => { const t = window.__ink.state().tattoos.find((x) => x.id === id) || window.__ink.state().tattoos[0]; t.name = 'Both at once'; window.__ink.commitTest(); }, idB),
    ]);
    await until(p, (id) => window.__ink.state().tattoos.some((t) => t.name === 'Both at once') && Math.abs(window.__ink.state().tattoos.find((t) => t.id === id).width - 0.2) < 1e-9, idA, 'Jake has both changes', 25000);
    await until(q, (id) => window.__ink.state().tattoos.some((t) => t.name === 'Both at once') && Math.abs(window.__ink.state().tattoos.find((t) => t.id === id).width - 0.2) < 1e-9, idA, 'Liv has both changes', 25000);
    await until(p, () => window.__ink.account().text === 'Saved to your account', null, 'Jake settles');
    await until(q, () => window.__ink.account().text === 'Saved to your account', null, 'Liv settles');
    const [saved] = await db('select state from public.projects where id = $1', [proj.id]);
    assert.ok(saved.state.tattoos.some((t) => t.name === 'Both at once'), 'the account has her change');
    assert.ok(Math.abs(saved.state.tattoos.find((t) => t.id === idA).width - 0.2) < 1e-9, 'and his');
    assert.ok(saved.state.tattoos.some((t) => t.review && t.review.by === 'Liv'), 'and her earlier answer');
    assert.equal((await db('select count(*)::int n from public.projects'))[0].n, 1, 'still one project, no copies');

    // Liv's panel: Leave, no Rename or Remove; she sees who owns it
    await q.click('#accountBtn');
    await until(q, () => document.querySelectorAll('#account .acct-item').length >= 2, null, 'Liv\'s list');
    assert.equal(await hasText(q, 'Leave this project'), true);
    assert.equal(await hasText(q, 'Rename'), false, 'she cannot rename it'); assert.equal(await hasText(q, 'Invite someone'), false);
    assert.match(await q.$eval('#account', (e) => e.textContent), /Jake.*owns this project/);
    await q.screenshot({ path: 'shots/t83-liv-home.png' });
    await q.click('#account header .btn');

    // Jake's panel lists her; he takes her off; her screen says so on its next check
    await p.click('#accountBtn');
    await until(p, () => [...document.querySelectorAll('#acctTogether .acct-item')].some((e) => /Liv/.test(e.textContent)), null, 'Jake sees Liv joined');
    await p.screenshot({ path: 'shots/t83-jake-home.png' });
    await clickText(p, 'Take off'); await wait(150);
    await clickText(p, 'Take off');
    await until(p, () => /can no longer see/.test(document.querySelector('#account .acct-msg').textContent), null, 'taken off');
    assert.equal((await db('select count(*)::int n from public.project_members'))[0].n, 0);
    await until(q, () => !window.__ink.account().bind, null, 'Liv\'s screen lets go of it', 15000);
    assert.match(await toastText(q), /no longer on/);
    await until(q, () => document.querySelector('#hereNow').hidden && !window.__ink.peers().length, null, 'Liv no longer shown anyone here', 10000);
    await until(p, () => document.querySelector('#hereNow').hidden && !window.__ink.peers().length, null, 'Jake no longer shown Liv here', 10000);
    assert.ok(await q.evaluate(() => window.__ink.state().tattoos.length) > 0, 'what was on her screen stays');
    // the old link no longer lets her back in
    await q.goto(link, { waitUntil: 'load' });
    await until(q, () => window.__ink && window.__ink.ready() && /no longer works/.test((document.querySelector('#account .acct-msg') || {}).textContent || ''), null, 'old invite refused');
    await p.click('#account header .btn');

    // forgot password, on a third device
    const r = await openPage(); await ready(r, url); await wait(300);
    await r.click('#accountBtn'); await until(r, () => document.querySelector('#account input[type=email]'), null, 'form');
    await clickText(r, 'I have an account');
    await type(r, '#account input[type=email]', 'nobody@example.com');
    await r.click('#acctForgot');
    await until(r, () => /no account with that email/.test(document.querySelector('#account .acct-msg').textContent), null, 'unknown email said plainly');
    assert.equal((await db(`select count(*)::int n from auth.users where email = 'nobody@example.com'`))[0].n, 0, 'forgot password makes no account');
    await type(r, '#account input[type=email]', 'jake@example.com');
    await r.click('#acctForgot');
    await until(r, () => window.__ink.account().view === 'code', null, 'code asked');
    await type(r, '#account input[autocomplete=one-time-code]', fake.codes.get('jake@example.com'));
    await clickText(r, 'Next');
    await until(r, () => /Set a new password/.test(document.querySelector('#account h2').textContent), null, 'new password asked');
    await r.screenshot({ path: 'shots/t83-new-password.png' });
    await type(r, '#account input[type=password]', 'newpass99');
    await clickText(r, 'Save password');
    await until(r, () => /New password saved/.test(document.querySelector('#account .acct-msg').textContent), null, 'saved');
    assert.equal((await db(`select password from auth.users where email = 'jake@example.com'`))[0].password, 'newpass99');
    console.log('t83 together: ok');
  } finally { await fake.stop(); }
}
