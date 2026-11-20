// Put it in your account with a big project (2026-11-20, Jake, 73 tattoos on his iPad: "It did not go:
// No connection to your account right now", though the account had just answered). Every failure of a
// send was shown as no connection, every picture was sent again on each try when this device's list
// of pictures already up was lost, a send that took over a minute was given up on and shown with the
// reason of the try before, and one dropped picture stopped the whole send. Now:
//  1. pictures already in the account are not sent again, even with this device's list gone
//  2. a picture whose line drops once is sent again and the project goes up
//  3. a picture that keeps failing: the reason says the account is answering and names the picture
//     and its size, not "no connection"; nothing in the account changes
//  4. the red line in Put it in your account is this try's reason (the project save), not the last one
//  5. with no account at all answering, it still says no connection
//  6. Put it in your account shows the pictures going up, and the project lands with every tattoo
// npm run build:accounts-test, then
// PGHOST=/var/run/postgresql PGUSER=$USER INK_DIST=dist-accounts node tools/shot.mjs shots/t154.png tools/tests/t154-account-send.mjs
import { startFakeSupabase } from '../fake-supabase.mjs';
export default async function (p) {
  const fake = await startFakeSupabase({ port: 54329 });
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  let fails = 0;
  const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, detail); };
  const db = async (sql, args) => (await fake.pool.query(sql, args)).rows;
  const acct = () => p.evaluate(() => window.__ink.account());
  const until = async (fn, arg, what, ms = 30000) => { try { await p.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); return true; } catch (e) { console.log('timed out: ' + what, JSON.stringify(await acct()), '\n' + fake.log.slice(-10).join('\n')); return false; } };
  const clickText = async (text) => p.evaluate((t) => { const b = [...document.querySelectorAll('#account button')].find((x) => x.textContent.trim() === t && !x.disabled && x.offsetParent); if (b) b.click(); return !!b; }, text);
  const type = async (sel, text) => { await wait(150); await p.$eval(sel, (e) => { e.value = ''; }); await p.type(sel, text); };
  const rename = (i, n) => p.evaluate((i, n) => { window.__ink.state().tattoos[i].name = n; window.__ink.commitTest(); }, i, n);
  // a new picture, different every time
  const addPicture = (seed) => p.evaluate(async (seed) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 300); g.fillStyle = `hsl(${seed * 47 % 360},60%,30%)`;
    for (let i = 0; i < 40; i++) g.fillRect((seed * 13 + i * 37) % 360, (i * 53 + seed) % 260, 30, 30);
    await window.__ink.addArt(c.toDataURL('image/png'), 'Piece ' + seed); window.__ink.commitTest();
  }, seed);
  // what the account is sent: picture uploads counted, and some of them made to drop
  let uploads = 0, dropPictures = 0, dropAllPictures = false, dropProject = false, offline = false;
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    if (r.isInterceptResolutionHandled()) return;
    const u = r.url(), m = r.method();
    if (offline && /127\.0\.0\.1:54329/.test(u)) return r.abort('internetdisconnected');
    if (/\/storage\/v1\/object\/artwork\//.test(u) && m === 'POST') {
      uploads++;
      if (dropAllPictures || dropPictures > 0) { dropPictures--; return r.abort('connectionreset'); }
    }
    if (dropProject && /\/rest\/v1\/projects/.test(u) && m === 'PATCH') return void setTimeout(() => r.abort('connectionreset'), 1500);
    r.continue();
  });
  try {
    await until(() => window.__ink && window.__ink.ready() && window.__ink.account(), null, 'ready');
    await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(500);
    for (let i = 0; i < 6; i++) await addPicture(i + 1);
    await p.click('#accountBtn'); await until(() => document.querySelector('#account input[type=email]'), null, 'form');
    await type('#account input[autocomplete=name]', 'Jake'); await type('#account input[type=email]', 'jake@example.com'); await type('#account input[type=password]', 'tattoos1');
    await clickText('Create account'); await until(() => window.__ink.account().view === 'move', null, 'move');
    await clickText('Add to my account'); await until(() => !!window.__ink.account().bind && window.__ink.account().text === 'Saved to your account', null, 'bound');
    await p.click('#account header .acct-close');
    const n0 = (await db('select tattoos from public.projects'))[0].tattoos;
    check('the project is in the account', n0 >= 8, String(n0));

    // 1. this device forgets which pictures are up: nothing is sent again
    await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('ia-cloud-up')) localStorage.removeItem(k); });
    uploads = 0; const lists = fake.listCalls.length;
    await rename(0, 'Renamed once');
    for (let i = 0; i < 100 && !(await db('select state from public.projects'))[0].state.tattoos.some((x) => x.name === 'Renamed once'); i++) await wait(200);
    check('pictures already in the account are not sent again', uploads === 0 && fake.listCalls.length > lists, `uploads ${uploads}, folder looked at ${fake.listCalls.length - lists} times`);

    // 2. a new picture whose line drops once goes up on the next try
    dropPictures = 1; uploads = 0;
    await addPicture(20);
    for (let i = 0; i < 150 && !(await db('select state from public.projects'))[0].state.tattoos.some((x) => x.name === 'Piece 20'); i++) await wait(200);
    const r2 = (await db('select tattoos, state from public.projects'))[0];
    check('a picture that dropped once is sent again and the project goes up', uploads === 2 && r2.state.tattoos.some((t) => t.name === 'Piece 20'), `uploads ${uploads}`);

    // 3. a picture that keeps failing
    dropAllPictures = true; uploads = 0;
    const rev3 = (await db('select rev from public.projects'))[0].rev;
    await addPicture(30);
    await until(() => window.__ink.account().fix === true, null, 'stuck on a picture', 40000);
    let s = await acct();
    check('it says the account is answering and names the picture, not no connection', /Your account is answering, but sending picture 1 of 1 \(\d+ KB\) did not get through/.test(s.stuck) && !/No connection/.test(s.stuck), s.stuck);
    check('the picture was tried three times', uploads === 3, String(uploads));
    check('nothing in the account changed', (await db('select rev from public.projects'))[0].rev === rev3);
    const line = await p.evaluate(() => document.querySelector('#saved').textContent);
    check('the line under Ink Atlas offers the fix', /Tap to put it in your account/.test(line), line);

    // 4. Put it in your account: this try fails on the project save; the red line says that one
    dropAllPictures = false; dropProject = true;
    await p.evaluate(() => document.querySelector('#top .brand').click());
    await until(() => window.__ink.account().view === 'fix' && document.querySelector('#acctFixGo'), null, 'fix view');
    const shownPictures = []; const watch = setInterval(async () => { try { const t = await p.evaluate(() => (document.getElementById('acctFixSending') || {}).textContent || ''); if (t) shownPictures.push(t); } catch (e) { /* page busy */ } }, 50);
    await clickText('Put it in my account');
    await until(() => /It did not go/.test(document.querySelector('#account').textContent), null, 'failed send', 40000);
    clearInterval(watch);
    let t = await p.evaluate(() => document.querySelector('#account').textContent);
    check('the red line is this try\'s reason: the project save', /It did not go: Your account is answering, but saving the project \(\d+ KB\) did not get through/.test(t), t.slice(0, 400));
    check('and Last try says the same', /Last try: Your account is answering, but saving the project/.test(t), t.slice(0, 400));
    check('the panel shows that it is sending', (await p.evaluate(() => window.__ink.account().stuck)) && shownPictures.length > 0, JSON.stringify([...new Set(shownPictures)]));

    // 5. no account answering at all
    dropProject = false; offline = true;
    await p.click('#account header .acct-close');
    await rename(1, 'Renamed offline');
    await until(() => window.__ink.account().fix === true && /No connection/.test(window.__ink.account().stuck || ''), null, 'offline', 40000);
    s = await acct();
    check('with nothing answering it still says no connection', /^No connection to your account right now/.test(s.stuck), s.stuck);

    // 6. back on line: one tap puts it all in the account
    offline = false;
    await p.evaluate(() => document.querySelector('#top .brand').click());
    await until(() => window.__ink.account().view === 'fix' && document.querySelector('#acctFixGo'), null, 'fix view again');
    await clickText('Put it in my account');
    await until(() => /saved to your account/.test((document.querySelector('#acctFix') || {}).textContent || ''), null, 'sent', 40000);
    const last = (await db('select tattoos, state from public.projects'))[0];
    const here = await p.evaluate(() => window.__ink.state().tattoos.length);
    check('the account has every tattoo on this device', last.tattoos === here && last.state.tattoos.some((x) => x.name === 'Piece 30') && last.state.tattoos.some((x) => x.name === 'Renamed offline'), `${last.tattoos} of ${here}`);
    const keys = await p.evaluate(() => Object.keys(window.__ink.state().tattoos.reduce((o, x) => { o[x.img] = 1; return o; }, {})));
    const missing = keys.filter((k) => k && ![...fake.files.keys()].some((f) => f.endsWith('/' + k)));
    check('and every picture', missing.length === 0, missing.join(', '));
    await p.screenshot({ path: 'shots/t154-sent.png' });
  } finally { await fake.stop(); }
  if (fails) throw new Error(fails + ' check(s) failed');
  console.log('PASS t154 account send: pictures already up are not sent again, a dropped picture is retried, a failure names the step and says the account is answering, the red line is this try, offline still says no connection, and a big project lands whole');
}
