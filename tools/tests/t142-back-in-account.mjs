// Put it in your account: when this device's project could not go to the account, the line under
// Ink Atlas says so and is a button (the account button carries a mark too). Tapping it looks at
// the account's copy first: the copy this device last saved, or one with only the samples, is
// replaced in one tap; one with other real work is never replaced without a second, named step
// (Keep both makes a second project; Replace it keeps the account's copy in Find my saves first);
// a project gone from the account goes back as a new one. The reason of the last try is shown.
// npm run build:accounts-test, then
// PGHOST=/var/run/postgresql PGUSER=$USER INK_DIST=dist-accounts node tools/shot.mjs shots/t142.png tools/tests/t142-back-in-account.mjs
import { startFakeSupabase } from '../fake-supabase.mjs';
export default async function (p) {
  const fake = await startFakeSupabase({ port: 54329 });
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  let fails = 0;
  const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, detail); };
  const db = async (sql, args) => (await fake.pool.query(sql, args)).rows;
  const acct = () => p.evaluate(() => window.__ink.account());
  const until = async (fn, arg, what, ms = 20000) => { try { await p.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); return true; } catch (e) { console.log('timed out: ' + what, JSON.stringify(await acct()), '\n' + fake.log.slice(-10).join('\n')); return false; } };
  const clickText = async (text) => p.evaluate((t) => { const b = [...document.querySelectorAll('#account button')].find((x) => x.textContent.trim() === t && !x.disabled && x.offsetParent); if (b) b.click(); return !!b; }, text);
  const panelText = () => p.evaluate(() => document.querySelector('#account').textContent);
  const type = async (sel, text) => { await wait(150); await p.$eval(sel, (e) => { e.value = ''; }); await p.type(sel, text); };
  const rename = (names) => p.evaluate((names) => { const s = window.__ink.state(); names.forEach((n, i) => { s.tattoos[i].name = n; }); window.__ink.commitTest(); }, names);
  // the account refuses every write while block is on, like a server that does not answer
  let block = false;
  await p.setRequestInterception(true);
  p.on('request', (r) => { if (r.isInterceptResolutionHandled()) return; if (block && /\/rest\/v1\/projects|\/storage\/v1\/object\/artwork/.test(r.url()) && r.method() !== 'GET') r.abort('connectionfailed'); else r.continue(); });
  const stuckNow = async (names) => { block = true; await rename(names); const ok = await until(() => window.__ink.account().fix === true, null, 'stuck'); block = false; return ok; };
  const tapLine = async () => { await p.evaluate(() => document.querySelector('#top .brand').click()); await until(() => window.__ink.account().view === 'fix' && document.querySelector('#acctFix') && !/Looking at/.test(document.querySelector('#acctFix').textContent), null, 'fix view'); };
  try {
    await until(() => window.__ink && window.__ink.ready() && window.__ink.account(), null, 'ready');
    await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(500);
    await rename(['Cactus', 'Rose']);
    await p.click('#accountBtn'); await until(() => document.querySelector('#account input[type=email]'), null, 'form');
    await type('#account input[autocomplete=name]', 'Jake'); await type('#account input[type=email]', 'jake@example.com'); await type('#account input[type=password]', 'tattoos1');
    await clickText('Create account'); await until(() => window.__ink.account().view === 'move', null, 'move');
    await clickText('Add to my account'); await until(() => !!window.__ink.account().bind && window.__ink.account().text === 'Saved to your account', null, 'bound');
    await p.click('#account header .acct-close');
    const id = (await db('select id from public.projects'))[0].id;
    const line = () => p.evaluate(() => { const b = document.querySelector('#top .brand'), r = b.getBoundingClientRect(); return { text: document.querySelector('#saved').textContent, bad: document.querySelector('#saved').classList.contains('bad'), tap: b.classList.contains('tap'), role: b.getAttribute('role'), h: r.height, w: r.width, badge: (document.querySelector('#accountBtn .acct-badge') || {}).textContent, badgeShown: !document.querySelector('#accountBtn .acct-badge').hidden }; });
    check('in step, the line is not a button', !(await line()).tap, JSON.stringify(await line()));

    // 1. a send that fails: the line says so and is a button, the account button has a mark
    check('a send that fails says so', await stuckNow(['Cactus big', 'Rose']));
    let l = await line();
    check('the line says it is on this device and what a tap does', /Tap to put it in your account/.test(l.text) && l.bad, l.text);
    check('the line is a 44 pt button', l.tap && l.role === 'button' && l.h >= 44, JSON.stringify(l));
    check('the account button carries a mark', l.badgeShown && l.badge === '!', JSON.stringify(l));
    await p.screenshot({ path: 'shots/t142-line.png' });
    // tapping it: the account copy is the one this device last saved, so one tap sends it
    await tapLine();
    check('tapping it opens Put it in your account', (await acct()).view === 'fix');
    let t = await panelText();
    check('it says the last try and offers to send it', /last saved/.test(t) && /Last try: No connection/.test(t), t.slice(0, 260));
    await p.screenshot({ path: 'shots/t142-send.png' });
    await clickText('Put it in my account');
    await until(() => /saved to your account/.test(document.querySelector('#acctFix').textContent), null, 'sent');
    let rows = await db('select id, rev, state from public.projects');
    check('it is in the account', rows.length === 1 && rows[0].state.tattoos[0].name === 'Cactus big', JSON.stringify(rows.map((r) => [r.rev, r.state.tattoos.map((x) => x.name)])));
    l = await line();
    check('and the line is back to saved, with no mark', /Saved to your account/.test(l.text) && !l.tap && !l.badgeShown, JSON.stringify(l));
    await p.click('#account header .acct-close');

    // 2. the account copy holds only the samples (sent up before the guards): one tap puts this one in its place
    const samples = JSON.parse(JSON.stringify(rows[0].state)); samples.tattoos.forEach((x, i) => { x.name = ['Sunburst (sample)', 'Sprig (sample)'][i]; });
    await db('update public.projects set state = $1, rev = rev + 1, tattoos = 2', [samples]);
    check('stuck again', await stuckNow(['Cactus', 'Rose big']));
    await tapLine(); t = await panelText();
    check('it says the account has only the samples', /only the samples/.test(t) && /your 2 tattoos/.test(t), t.slice(0, 260));
    await clickText('Put it in my account');
    await until(() => /saved to your account/.test(document.querySelector('#acctFix').textContent), null, 'replaced samples');
    rows = await db('select id, state from public.projects');
    check('the samples copy is replaced in place, not copied', rows.length === 1 && rows[0].id === id && rows[0].state.tattoos.map((x) => x.name).join() === 'Cactus,Rose big', JSON.stringify(rows.map((r) => r.state.tattoos.map((x) => x.name))));
    await p.click('#account header .acct-close');

    // 3. the account copy holds other real work: never replaced in one tap
    const other = JSON.parse(JSON.stringify(rows[0].state)); other.tattoos.forEach((x, i) => { x.name = ['Lily', 'Moth'][i]; });
    await db('update public.projects set state = $1, rev = rev + 1, edited_by = $2', [other, 'Liv']);
    check('stuck with real work in the account', await stuckNow(['Cactus', 'Rose']));
    await tapLine(); t = await panelText();
    check('it says the account has different work, by whom', /different "/.test(t) && /2 tattoos/.test(t) && /Liv/.test(t), t.slice(0, 300));
    check('offers Keep both first and Replace as a second step', await p.evaluate(() => !!document.querySelector('#acctFixBoth.primary') && !!document.querySelector('#acctFixReplace') && !document.querySelector('#acctFixReplaceGo')));
    check('nothing was sent over it on its own', (await db('select state from public.projects where id = $1', [id]))[0].state.tattoos[0].name === 'Lily');
    await p.screenshot({ path: 'shots/t142-both.png' });
    await p.evaluate(() => document.querySelector('#acctFixBoth').click());
    await until(() => /Both are in your account/.test(document.querySelector('#acctFix').textContent), null, 'kept both');
    rows = await db('select id, name, state from public.projects order by created_at');
    check('Keep both adds this one and leaves the other alone', rows.length === 2 && rows.find((r) => r.id === id).state.tattoos[0].name === 'Lily' && rows.some((r) => r.id !== id && r.state.tattoos[0].name === 'Cactus'), JSON.stringify(rows.map((r) => [r.name, r.state.tattoos.map((x) => x.name)])));
    const id2 = rows.find((r) => r.id !== id).id;
    check('the screen is tied to the new one', (await acct()).bind.id === id2);
    await p.click('#account header .acct-close');

    // 4. Replace it: a second, named step, and the account's copy is kept on this device first
    await db('update public.projects set state = $1, rev = rev + 1 where id = $2', [other, id2]);
    check('stuck again on the new one', await stuckNow(['Cactus 3', 'Rose']));
    await tapLine();
    await p.evaluate(() => document.querySelector('#acctFixReplace').click()); await wait(300);
    t = await panelText();
    check('Replace says what it does and that the old copy is kept', /in place of/.test(t) && /Find my saves/.test(t), t.slice(0, 300));
    check('still nothing replaced', (await db('select state from public.projects where id = $1', [id2]))[0].state.tattoos[0].name === 'Lily');
    await p.evaluate(() => document.querySelector('#acctFixReplaceGo').click());
    await until(() => /Replaced/.test(document.querySelector('#acctFix').textContent), null, 'replaced');
    check('Replace it puts this one there', (await db('select state from public.projects where id = $1', [id2]))[0].state.tattoos[0].name === 'Cactus 3');
    const kept = await p.evaluate(async () => (await window.__ink.store().listRecovery()).map((r) => r.reason + ':' + r.tattoos));
    check('the account copy it replaced is in Find my saves', kept.some((r) => /before this device replaced it/.test(r)), JSON.stringify(kept));
    await p.click('#account header .acct-close');

    // 5. gone from the account: it goes back as a new project
    await db('delete from public.projects where id = $1', [id2]);
    await rename(['Cactus 4', 'Rose']);
    await until(() => window.__ink.account().fix === true, null, 'gone');
    l = await line();
    check('a project gone from the account says so, with a tap to put it back', /Tap to put it back/.test(l.text) && l.tap, l.text);
    await tapLine(); t = await panelText();
    check('it offers to put it back', /not in your account any more/.test(t), t.slice(0, 200));
    await clickText('Put it in my account');
    await until(() => /saved to your account/.test(document.querySelector('#acctFix').textContent), null, 'back');
    rows = await db('select id, state from public.projects');
    check('it is back as a new project', rows.some((r) => r.id !== id && r.id !== id2 && r.state.tattoos[0].name === 'Cactus 4'), JSON.stringify(rows.map((r) => r.state.tattoos.map((x) => x.name))));
    await p.click('#account header .acct-close');

    // 6. portrait iPad: the line is hidden there, so the account button's mark and a tap on it lead to the same place
    await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1 }); await wait(600);
    check('stuck in portrait', await stuckNow(['Cactus 5', 'Rose']));
    l = await line();
    check('in portrait the account button carries the mark', l.badgeShown && l.badge === '!', JSON.stringify(l));
    await p.click('#accountBtn');
    await until(() => window.__ink.account().view === 'fix' && !/Looking at/.test(document.querySelector('#acctFix').textContent), null, 'fix from button');
    const sz = await p.evaluate(() => { const b = document.querySelector('#acctFixGo'); const r = b && b.getBoundingClientRect(); return r ? [r.width, r.height, r.bottom <= innerHeight] : null; });
    check('the account button opens it, with a 44 pt button in view', (await acct()).view === 'fix' && sz && sz[1] >= 44 && sz[2], JSON.stringify(sz));
    await p.screenshot({ path: 'shots/t142-portrait.png' });
    await clickText('Put it in my account');
    check('and it goes', await until(() => /saved to your account/.test(document.querySelector('#acctFix').textContent), null, 'portrait send'));
  } finally { await fake.stop(); }
  if (fails) throw new Error(fails + ' check(s) failed');
  console.log('PASS t142-back-in-account');
}
