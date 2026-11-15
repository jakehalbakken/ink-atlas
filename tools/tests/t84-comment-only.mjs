// Comment-only invites, What changed since you last looked, every project at a glance and the
// reference board, end to end against tools/fake-supabase.mjs. Same build as t81 and t83:
//   npm run build:accounts-test
//   PGHOST=/var/run/postgresql PGUSER=$USER INK_DIST=dist-accounts node tools/shot.mjs shots/t84.png tools/tests/t84-comment-only.mjs
// Covers: Jake invites his artist as Comments only; she joins and sees no way to move, resize or
// add tattoos; a change she forces anyway never reaches the account and her screen goes back;
// her answer, a pinned comment and a reference picture (with its artwork) reach Jake; Jake, back
// after being away, is told what changed and the list's Show opens the picture; both account
// panels say whose turn it is and Jake's account button shows a count; Let them edit switches
// her to editing on her screen by itself; she makes her own copy and her changes go only there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startFakeSupabase } from '../fake-supabase.mjs';

export default async function (p) {
  // Realtime off, like a project that has it switched off: everything here still works by the
  // check every few seconds, and nobody is shown as here now.
  const fake = await startFakeSupabase({ port: 54329, realtime: false });
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  const until = async (pg, fn, arg, what, ms = 20000) => { try { await pg.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); } catch (e) { const st = await pg.evaluate(() => JSON.stringify({ a: window.__ink && window.__ink.account(), panel: (document.querySelector('#account') || {}).textContent, toast: document.querySelector('#toast').textContent })).catch(() => ''); throw new Error('timed out: ' + what + '\n' + st + '\n' + fake.log.slice(-12).join('\n')); } };
  const db = async (sql, args) => (await fake.pool.query(sql, args)).rows;
  const clickText = async (pg, text) => { const ok = await pg.evaluate((t) => { const b = [...document.querySelectorAll('#account button')].find((x) => x.textContent.trim() === t && !x.disabled && x.offsetParent); if (b) b.click(); return !!b; }, text); assert.ok(ok, 'button ' + text); };
  const type = async (pg, sel, text) => { await wait(150); await pg.$eval(sel, (e) => { e.value = ''; }); await pg.type(sel, text); assert.equal(await pg.$eval(sel, (e) => e.value), text, 'typed into ' + sel); };
  const shown = (pg, sel) => pg.$eval(sel, (e) => !!(e.getClientRects().length && getComputedStyle(e).display !== 'none' && !e.hidden)).catch(() => false);
  const setHidden = (pg, hidden) => pg.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-t84-'));
  try {
    await ready(p); await wait(800);

    // Jake: account, then Invite someone, Comments only
    await p.click('#accountBtn');
    await makeAccount(p, 'Jake', 'jake@example.com', 'tattoos1');
    await until(p, () => window.__ink.account().view === 'move', null, 'asked to add this device\'s work');
    await clickText(p, 'Add to my account');
    await until(p, () => window.__ink.account().view === 'home' && document.querySelector('#acctInvite'), null, 'home');
    await p.click('#acctInvite');
    await until(p, () => window.__ink.account().view === 'inviteRole', null, 'asked how they can work on it');
    for (const id of ['#acctInviteEdit', '#acctInviteComment']) assert.ok(await p.$eval(id, (e) => e.getBoundingClientRect().height >= 44), id + ' big enough');
    await p.screenshot({ path: 'shots/t84-invite-role.png' });
    await p.click('#acctInviteComment');
    await until(p, () => window.__ink.account().view === 'invite', null, 'invite link made');
    assert.match(await p.$eval('#account', (e) => e.textContent), /not change the tattoos/, 'says what they can and cannot do');
    const link = await p.$eval('#account .acct-link', (e) => e.value);
    assert.deepEqual(await db('select role from public.invites'), [{ role: 'comment' }]);
    const [proj] = await db('select id from public.projects');
    await p.click('#account header .btn');

    // the artist joins: no way to move, resize or add tattoos
    const q = await openPage();
    await q.goto(link, { waitUntil: 'load' });
    await until(q, () => window.__ink && window.__ink.ready() && document.querySelector('#account input[type=email]') && !document.querySelector('#account').hidden, null, 'artist asked to sign in');
    await makeAccount(q, 'Mara', 'mara@example.com', 'inkink1');
    await until(q, () => { const b = window.__ink.account().bind; return b && b.shared && b.role === 'comment'; }, null, 'she is in the project as a commenter');
    assert.match(await q.$eval('#toast', (e) => e.textContent), /comment/i, 'told she can comment');
    const mara = (await db(`select id from auth.users where email = 'mara@example.com'`))[0].id;
    assert.deepEqual(await db('select user_id, role from public.project_members'), [{ user_id: mara, role: 'comment' }]);
    await until(q, () => window.__ink.commentOnly() && document.body.classList.contains('comment-only'), null, 'comment-only screen');
    const t0 = await q.evaluate(() => window.__ink.state().tattoos[0].id);
    const name0 = await q.evaluate(() => window.__ink.state().tattoos[0].name);
    await q.evaluate((id) => window.__ink.select(id), t0); await wait(400);
    for (const sel of ['#bodyBtn', '#add', '.editor-quick', '#editorAdvanced', '#handles']) assert.equal(await shown(q, sel), false, sel + ' hidden for a commenter');
    assert.equal(await q.$eval('#name', (e) => e.readOnly), true, 'name cannot be changed');
    assert.equal(await q.evaluate(() => window.__ink.answerShown()), true, 'Looks good / Ask for a change still show');
    assert.equal(await shown(q, '#bRefs'), true, 'reference pictures still there');
    await q.screenshot({ path: 'shots/t84-commenter.png' });

    // a change forced anyway never reaches the account, and her screen goes back
    await q.evaluate(() => { window.__ink.state().tattoos[0].name = 'Forced rename'; window.__ink.state().tattoos[0].width *= 1.5; window.__ink.commitTest(); });
    await until(q, (n) => window.__ink.state().tattoos[0].name === n, name0, 'her screen goes back to the project as it is', 20000);
    assert.equal((await db('select state from public.projects'))[0].state.tattoos[0].name, name0, 'the account never took it');

    // her answer reaches Jake
    await q.click('#bAskChange'); await wait(150);
    await q.type('#changeNote', 'Thicker outline please');
    await q.click('#bSendChange'); await wait(200);
    await until(p, (id) => { const t = window.__ink.state().tattoos.find((x) => x.id === id); return t && t.review && t.review.by === 'Mara' && t.review.verdict === 'changes'; }, t0, 'her answer reaches Jake', 15000);
    await until(q, () => window.__ink.account().text === 'Saved to your account', null, 'Mara in step');
    await until(p, () => window.__ink.account().text === 'Saved to your account', null, 'Jake in step');

    // Jake puts the app away; meanwhile she pins a comment and adds a reference picture
    await setHidden(p, true);
    await q.evaluate(() => window.__ink.select(null)); await wait(200);
    await q.evaluate(() => window.__ink.pinsOn()); await wait(300);
    const spot = await q.evaluate(() => window.__ink.screenOfPos(window.__ink.state().tattoos[0].pos));
    await q.mouse.click(spot.x, spot.y); await wait(300);
    await q.type('#pinNote', 'Shade the petals darker');
    await q.click('#pinSave'); await wait(300);
    await q.click('#pinsDone'); await wait(200);
    // a picture made in the page, saved as a file and picked with the file input
    const png = await q.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#e8d8c8'; g.fillRect(0, 0, 320, 200); g.fillStyle = '#7a1f2b'; g.beginPath(); g.arc(160, 100, 70, 0, 7); g.fill(); return c.toDataURL('image/png').split(',')[1]; });
    const file = path.join(tmp, 'rose-reference.png'); fs.writeFileSync(file, Buffer.from(png, 'base64'));
    await q.evaluate((id) => window.__ink.select(id), t0); await wait(300);
    assert.match(await q.$eval('#bRefs', (e) => e.textContent), /Add reference pictures/);
    await q.click('#bRefs'); await wait(300);
    assert.equal((await q.evaluate(() => window.__ink.refs())).open, true, 'the board opens');
    await (await q.$('#refsFile')).uploadFile(file);
    await until(q, () => window.__ink.refs().tiles === 1, null, 'the picture is on the board');
    const ref = await q.evaluate(() => window.__ink.state().refs[0]);
    assert.equal(ref.tattooId, t0, 'pinned to the tattoo it was added from'); assert.equal(ref.by, 'Mara'); assert.ok(Math.abs(ref.aspect - 1.6) < 0.01, 'keeps its shape');
    assert.match(await q.evaluate((k) => window.__ink.imageOf(k) || '', ref.img), /^data:image\/jpeg/, 'kept as a JPEG');
    await q.screenshot({ path: 'shots/t84-refs.png' });
    await q.click('.refTile'); await wait(200);
    await q.type('#refText', 'This line weight');
    await q.$eval('#refText', (e) => e.dispatchEvent(new Event('change', { bubbles: true })));
    assert.equal(await shown(q, '#refRemove'), true, 'she can remove her own picture');
    assert.equal(await shown(q, '#refTry'), false, 'but cannot put it on the body');
    await q.click('#refBack'); await q.click('#refs [data-close="refs"]'); await wait(200);
    assert.match(await q.$eval('#bRefs', (e) => e.textContent), /Reference pictures \(1\)/);
    for (let i = 0; i < 100; i++) { const st = (await db('select state from public.projects'))[0].state; if (st.refs && st.refs[0] && st.refs[0].note && st.notes) break; await wait(200); }
    let saved = (await db('select state, image_keys from public.projects'))[0];
    assert.ok(saved.state.notes.some((n) => n.text === 'Shade the petals darker' && n.by === 'Mara'), 'her comment is in the account');
    assert.equal(saved.state.refs[0].note, 'This line weight', 'her picture and note are in the account');
    assert.ok(saved.image_keys.includes(ref.img), 'its artwork is listed'); assert.ok(fake.files.has('artwork/p/' + proj.id + '/' + ref.img), 'and uploaded to the project\'s folder');

    // Jake comes back: told what changed, and Show opens the picture
    await setHidden(p, false);
    await until(p, () => (window.__ink.state().refs || []).length === 1 && /since you last looked/.test(document.querySelector('#toast').textContent), null, 'Jake is told what changed', 20000);
    await p.click('#accountBtn');
    await until(p, () => document.querySelector('#acctChanges'), null, 'What changed in his panel');
    assert.match(await p.$eval('#acctChanges', (e) => e.textContent), /What changed \(\d\)/);
    await p.click('#acctChanges');
    await until(p, () => window.__ink.account().view === 'changes', null, 'the list');
    const lines = await p.$$eval('#account .acct-item', (a) => a.map((e) => e.textContent));
    assert.ok(lines.some((l) => /Mara commented: "Shade the petals darker"/.test(l)), 'her comment listed: ' + lines.join(' | '));
    assert.ok(lines.some((l) => /Mara added a reference picture/.test(l)), 'her picture listed');
    assert.ok(!lines.some((l) => /asked for a change/.test(l)), 'what he already saw is not listed again');
    await p.screenshot({ path: 'shots/t84-changes.png' });
    await p.evaluate(() => [...document.querySelectorAll('#account .acct-item')].find((e) => /reference picture/.test(e.textContent)).querySelector('button').click());
    await until(p, () => window.__ink.refs().open && window.__ink.refs().viewing, null, 'Show opens the picture');
    assert.ok(await p.$eval('#refImg', (e) => e.complete && e.naturalWidth > 0), 'the picture shows on his side');
    assert.match(await p.$eval('#refWho', (e) => e.textContent), /Mara/);
    assert.equal(await p.$eval('#refText', (e) => e.value), 'This line weight');
    await p.click('#refBack'); await p.click('#refs [data-close="refs"]'); await wait(200);
    assert.equal((await p.evaluate(() => window.__ink.refs())).open, false, 'the board closes');

    // every project at a glance: whose turn, and a count on Jake's account button
    await until(p, () => { const b = document.querySelector('#accountBtn .acct-badge'); return b && !b.hidden && b.textContent === '1'; }, null, 'count on his account button');
    await p.click('#accountBtn');
    await until(p, () => document.querySelector('#account .acct-turn'), null, 'his list says whose turn');
    assert.match(await p.$eval('#account .acct-turn', (e) => e.className + ' ' + e.textContent), /yours.*Your turn: Mara asked for 1 change/);
    assert.ok(await p.$eval('#acctGlance', (e) => [...e.querySelectorAll('button')].every((b) => b.getBoundingClientRect().height >= 44)), 'filter buttons big enough');
    await p.screenshot({ path: 'shots/t84-glance.png' });
    await q.click('#accountBtn');
    await until(q, () => document.querySelector('#account .acct-turn'), null, 'her list says whose turn');
    assert.match(await q.$eval('#account .acct-turn', (e) => e.textContent), /Waiting on Jake to make 1 change/);
    await q.click('#account header .btn');

    // replies and resolving: Jake answers her comment and resolves it, she answers back
    await p.click('#account header .btn'); await wait(150);
    const noteId = await p.evaluate(() => window.__ink.state().notes.find((n) => n.pin && n.by === 'Mara').id);
    await p.evaluate((id) => { window.__ink.pinsOn(); window.__ink.openPin(id); }, noteId); await wait(200);
    assert.equal((await p.evaluate(() => window.__ink.pins())).canDelete, true, 'Jake can edit, so he can delete it');
    await p.type('#pinReply', 'Darker how?'); await p.click('#pinReplySend'); await wait(150);
    await p.click('#pinResolve'); await wait(150);
    let pj = await p.evaluate(() => window.__ink.pins());
    assert.equal(pj.replies, 1, 'his reply shows under it'); assert.equal(pj.resolveLabel, 'Reopen'); assert.equal(pj.openCount, 0, 'no open comments');
    assert.doesNotMatch(pj.label, /\(/, 'the count leaves out resolved ones');
    for (let i = 0; i < 100; i++) { const n = (await db('select state from public.projects'))[0].state.notes.find((x) => x.id === noteId); if (n.replies && n.done) break; await wait(200); }
    await until(q, (id) => { const n = window.__ink.state().notes.find((x) => x.id === id); return n && n.replies && n.replies.length === 1 && n.done; }, noteId, 'she gets his reply and the resolve', 15000);
    await q.evaluate((id) => { window.__ink.pinsOn(); window.__ink.openPin(id); }, noteId); await wait(200);
    const pm = await q.evaluate(() => window.__ink.pins());
    assert.equal(pm.replies, 1); assert.equal(pm.resolveLabel, 'Reopen'); assert.equal(pm.canDelete, true, 'she can delete her own comment');
    assert.match(await q.$eval('#pinWho', (e) => e.textContent), /Resolved by/);
    await q.screenshot({ path: 'shots/t84-replies.png' });
    await q.type('#pinReply', 'Like the reference picture'); await q.click('#pinReplySend'); await wait(150);
    await q.click('#pinsDone');
    await until(p, (id) => { const n = window.__ink.state().notes.find((x) => x.id === id); return n && n.replies && n.replies.length === 2; }, noteId, 'her answer reaches Jake', 15000);
    const fin = (await db('select state from public.projects'))[0].state.notes.find((x) => x.id === noteId);
    assert.deepEqual(fin.replies.map((r) => r.text), ['Darker how?', 'Like the reference picture'], 'both replies in the account, in order');
    assert.equal(fin.replies[1].by, 'Mara');
    // the list of comments: open ones first, All for resolved ones, and a tap turns the view to it
    await p.click('#pinClose'); await wait(100);
    await p.click('#pinListBtn'); await wait(100);
    let pl = await p.evaluate(() => window.__ink.pins());
    assert.equal(pl.listShown, true); assert.deepEqual(pl.listItems, [], 'no open comments');
    assert.equal(await shown(p, '#pinListEmpty'), true);
    await p.click('#pinListAll'); await wait(100);
    pl = await p.evaluate(() => window.__ink.pins());
    assert.equal(pl.listItems.length, 1); assert.match(pl.listItems[0], /Shade the petals darker.*Mara.*2 replies.*resolved/);
    assert.ok(await p.$eval('#pinListItems button', (b) => b.getBoundingClientRect().height >= 44), 'big enough to tap');
    await p.screenshot({ path: 'shots/t84-pin-list.png' });
    const before = await p.evaluate(() => window.__ink.cam());
    await p.click('#pinsDone'); await p.evaluate(() => document.querySelector('[data-view="2"]').click()); await wait(1500);
    await p.evaluate(() => window.__ink.pinsOn()); await p.click('#pinListBtn'); await p.click('#pinListAll'); await wait(100);
    const back = await p.evaluate(() => window.__ink.cam()); assert.ok(back[2] < 0, 'looking at the back: ' + back);
    await p.click('#pinListItems button'); await wait(1500);
    pl = await p.evaluate(() => window.__ink.pins());
    assert.equal(pl.open, noteId, 'tap opens it'); assert.equal(pl.listShown, false);
    const turned = await p.evaluate(() => window.__ink.cam());
    assert.ok(Math.hypot(turned[0] - back[0], turned[2] - back[2]) > 0.3, 'the view turns to a pin it could not see: ' + back + ' -> ' + turned);
    assert.ok(before, 'cam read');
    await p.click('#pinsDone');

    // Suggest a new spot: she sizes it up with the corner handle, sends it, and nothing moves for anyone;
    // Jake opens her comment and uses the spot
    await until(q, () => window.__ink.account().text === 'Saved to your account', null, 'Mara settled');
    await q.evaluate((id) => window.__ink.select(id), t0); await wait(400);
    assert.equal(await shown(q, '#bSuggest'), true, 'Suggest a new spot offered');
    assert.equal(await shown(q, '#hSize'), false, 'no handles before');
    const w0 = await q.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, t0);
    await q.click('#bSuggest'); await wait(300);
    assert.equal(await q.evaluate(() => window.__ink.suggesting()), t0);
    assert.equal(await shown(q, '#suggestBar'), true); assert.equal(await shown(q, '#hSize'), true, 'handles while suggesting');
    const hb = await (await q.$('#hSize')).boundingBox();
    await q.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await q.mouse.down();
    for (let k = 1; k <= 8; k++) { await q.mouse.move(hb.x + hb.width / 2 + k * 6, hb.y + hb.height / 2 + k * 6); await wait(16); }
    await q.mouse.up(); await wait(300);
    const w1 = await q.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, t0);
    assert.ok(w1 > w0 * 1.05, `bigger on her screen while suggesting: ${w0} -> ${w1}`);
    await wait(2500);
    const [mid] = await db('select state from public.projects');
    assert.ok(Math.abs(mid.state.tattoos.find((t) => t.id === t0).width - w0) < 1e-9, 'nothing saved while she tries it');
    await q.type('#suggestNote', 'Bigger reads better here');
    await q.click('#suggestSend'); await wait(300);
    assert.equal(await q.evaluate(() => window.__ink.suggesting()), null);
    assert.ok(Math.abs(await q.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, t0) - w0) < 1e-9, 'back where it was on her screen');
    assert.match(await q.$eval('#toast', (e) => e.textContent), /Suggestion sent/);
    let sug = null;
    for (let k = 0; k < 100 && !sug; k++) { sug = ((await db('select state from public.projects'))[0].state.notes || []).find((n) => n.suggest); if (!sug) await wait(200); }
    assert.ok(sug, 'the suggestion reaches the account'); assert.equal(sug.text, 'Bigger reads better here'); assert.equal(sug.by, 'Mara'); assert.ok(sug.pin, 'pinned on the body');
    assert.ok(Math.abs(sug.suggest.width - w1) < 1e-6, 'carries her size');
    assert.ok(Math.abs((await db('select state from public.projects'))[0].state.tattoos.find((t) => t.id === t0).width - w0) < 1e-9, 'the tattoo itself is unchanged');
    await until(p, (id) => (window.__ink.state().notes || []).some((n) => n.id === id), sug.id, 'Jake has her suggestion', 15000);
    await p.evaluate((id) => { window.__ink.pinsOn(); window.__ink.openPin(id); }, sug.id); await wait(300);
    assert.equal(await shown(p, '#pinSuggestUse'), true, 'Use this spot offered');
    assert.match(await p.$eval('#pinSuggestText', (e) => e.textContent), /Mara suggests this spot for/);
    await p.screenshot({ path: 'shots/t84-suggest.png' });
    // Hold to see it there: shows her size while held, back the moment it lifts, nothing saved
    assert.equal(await shown(p, '#pinSuggestPeek'), true, 'Hold to see it there offered');
    const undo0 = await p.evaluate(() => window.__ink.undoLen ? window.__ink.undoLen() : -1);
    const pb = await p.$eval('#pinSuggestPeek', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(pb.x, pb.y); await p.mouse.down(); await wait(250);
    assert.ok(Math.abs(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, t0) - w1) < 1e-6, 'her size while held');
    await p.mouse.up(); await wait(250);
    assert.ok(Math.abs(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, t0) - w0) < 1e-9, 'back when let go');
    assert.equal(await p.evaluate(() => window.__ink.undoLen ? window.__ink.undoLen() : -1), undo0, 'peeking adds no undo step');
    await p.click('#pinSuggestUse'); await wait(300);
    assert.ok(Math.abs(await p.evaluate((id) => window.__ink.state().tattoos.find((t) => t.id === id).width, t0) - w1) < 1e-6, 'moved to her spot');
    assert.ok((await p.evaluate((id) => window.__ink.state().notes.find((n) => n.id === id), sug.id)).done, 'her suggestion marked done');
    assert.match(await p.$eval('#toast', (e) => e.textContent), /Mara's spot/);
    // tidy up so the rest counts as before: put it back and remove the suggestion
    await p.evaluate(() => window.__ink.undo()); await wait(200);
    await p.evaluate((id) => { window.__ink.pinsOn(); window.__ink.openPin(id); }, sug.id); await wait(200);
    await p.click('#pinDelete'); await wait(300);
    await p.click('#pinsDone');
    await until(p, () => window.__ink.account().text === 'Saved to your account', null, 'Jake tidy saved');
    await until(q, (id) => !(window.__ink.state().notes || []).some((n) => n.id === id), sug.id, 'gone for Mara', 15000);
    await q.evaluate(() => window.__ink.select(null));

    // Let them edit: her screen switches by itself
    await p.click('#accountBtn');
    await until(p, () => [...document.querySelectorAll('#acctTogether .acct-item')].some((e) => /Mara/.test(e.textContent) && /comments and answers only/.test(e.textContent)), null, 'Jake sees her as comments only');
    await clickText(p, 'Let them edit');
    await until(p, () => /can now change the tattoos/.test(document.querySelector('#account .acct-msg').textContent), null, 'switched');
    assert.deepEqual(await db('select role from public.project_members'), [{ role: 'edit' }]);
    await until(q, () => !window.__ink.commentOnly() && !document.body.classList.contains('comment-only'), null, 'her screen lets her edit', 15000);
    assert.match(await q.$eval('#toast', (e) => e.textContent), /You can now change the tattoos/);
    await q.evaluate((id) => window.__ink.select(id), t0); await wait(300);
    assert.equal(await shown(q, '.editor-quick'), true, 'editing controls back');
    // a selected tattoo shows the comments pinned on it, and a reference picture tries on the body
    await p.click('#account header .btn'); await wait(150);
    await p.evaluate((id) => window.__ink.select(id), t0); await wait(300);
    assert.equal(await shown(p, '#bPinsFor'), true); assert.equal(await p.$eval('#bPinsFor', (e) => e.textContent), 'Comments (1)');
    await p.click('#bPinsFor'); await wait(300);
    assert.equal((await p.evaluate(() => window.__ink.pins())).open, noteId, 'one comment: it opens');
    await p.click('#pinsDone');
    const nBefore = await p.evaluate(() => window.__ink.state().tattoos.length);
    await p.evaluate(() => document.querySelector('#openRefs').click()); await wait(200);
    await p.click('.refTile'); await wait(200);
    assert.equal(await shown(p, '#refTry'), true, 'Jake can try it on the body');
    await p.click('#refTry'); await wait(800);
    const st2 = await p.evaluate(() => window.__ink.state());
    assert.equal(st2.tattoos.length, nBefore + 1, 'a new tattoo'); const nt = st2.tattoos[st2.tattoos.length - 1];
    assert.equal(nt.status, 'planned'); assert.equal(nt.name, 'This line weight'); assert.notEqual(nt.img, ref.img, 'its own copy of the artwork');
    assert.equal((await p.evaluate(() => window.__ink.refs())).open, false, 'the board closes');
    assert.equal((st2.refs || []).length, 1, 'the board keeps its picture');
    // the page for the artist carries each tattoo's reference pictures and open comments
    await p.evaluate(() => document.querySelector('#cApprove').click());
    await until(p, () => window.__ink.approval() && window.__ink.approval().html, null, 'the approval page');
    const page = await p.evaluate(() => window.__ink.approval().html);
    assert.ok(page.includes('<figure>') && page.includes('This line weight'), 'her reference picture is on the page');
    assert.ok(!page.includes('Shade the petals darker'), 'a resolved comment is left off');
    for (const pg of [p, q]) assert.equal(await pg.$eval('#hereNow', (e) => e.hidden), true, 'nobody shown as here without Realtime');
    // Make my own copy: she gets her own project to change freely; Jake's stays as it is
    const nJake = await p.evaluate(() => window.__ink.state().tattoos.length);
    await until(p, () => window.__ink.account().text === 'Saved to your account', null, 'Jake saved');
    for (let i = 0; i < 100 && (await db('select state from public.projects'))[0].state.tattoos.length !== nJake; i++) await wait(200);
    await until(q, (n) => window.__ink.state().tattoos.length === n && window.__ink.account().text === 'Saved to your account', nJake, 'Mara in step');
    const [shared] = await db('select id, name, state from public.projects');
    await q.click('#accountBtn');
    await until(q, () => !!document.querySelector('#acctCopy'), null, 'Make my own copy offered');
    assert.ok(await q.$eval('#acctCopy', (e) => e.getBoundingClientRect().height >= 44));
    await q.click('#acctCopy');
    await until(q, () => { const b = window.__ink.account().bind; return b && b.mine && !b.shared; }, null, 'her screen is on her copy');
    assert.match(await q.$eval('#toast', (e) => e.textContent), /is your own copy/);
    const copies = await db('select id, name, owner, shared, state from public.projects where id <> $1', [shared.id]);
    assert.equal(copies.length, 1, 'one copy'); assert.equal(copies[0].name, shared.name + ' (my copy)'); assert.equal(copies[0].shared, false);
    assert.deepEqual(copies[0].state.tattoos.map((t) => t.id), shared.state.tattoos.map((t) => t.id), 'the same tattoos');
    assert.equal(copies[0].owner, mara, 'in her account');
    await q.evaluate(() => { window.__ink.state().tattoos[0].name = 'Mara only'; window.__ink.commitTest(); });
    for (let i = 0; i < 100 && (await db('select state from public.projects where id = $1', [copies[0].id]))[0].state.tattoos[0].name !== 'Mara only'; i++) await wait(200);
    assert.equal((await db('select state from public.projects where id = $1', [copies[0].id]))[0].state.tattoos[0].name, 'Mara only', 'into her copy');
    assert.notEqual((await db('select state from public.projects where id = $1', [shared.id]))[0].state.tattoos[0].name, 'Mara only', 'not into Jake\'s');
    assert.equal((await db('select state from public.projects where id = $1', [copies[0].id]))[0].state.projectName, shared.name + ' (my copy)', 'named inside too');
    console.log('t84 comment only: ok');
  } finally { await fake.stop(); fs.rmSync(tmp, { recursive: true, force: true }); }
}
