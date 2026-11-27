// Daily backups in the account: once a project is in the account, one copy a day goes into the
// person's own folder (artwork/<user>/backups/<project>_<day>.json), never a second one the same
// day and never for a samples-only screen; the newest 30 days are kept and only that folder is
// trimmed; Share > Find my saves lists them under In your account, one a day, and opening one
// brings the project back as it was with its pictures, Undo putting back what was on screen.
// npm run build:accounts-test, then
// PGHOST=/var/run/postgresql PGUSER=$USER INK_DIST=dist-accounts node tools/shot.mjs shots/t203.png tools/tests/t203-daily-backups.mjs
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
  const type = async (sel, text) => { await wait(150); await p.$eval(sel, (e) => { e.value = ''; }); await p.type(sel, text); };
  const rename = (names) => p.evaluate((names) => { const s = window.__ink.state(); names.forEach((n, i) => { s.tattoos[i].name = n; }); window.__ink.commitTest(); }, names);
  const backups = async () => (await db("select name, owner from storage.objects where bucket_id = 'artwork' and name like '%/backups/%' order by name")).map((r) => r.name);
  const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  try {
    await until(() => window.__ink && window.__ink.ready() && window.__ink.account(), null, 'ready');
    await p.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 }); await wait(500);
    await rename(['Cactus', 'Rose']);
    await p.click('#accountBtn'); await until(() => document.querySelector('#account input[type=email]'), null, 'form');
    await type('#account input[autocomplete=name]', 'Jake'); await type('#account input[type=email]', 'jake@example.com'); await type('#account input[type=password]', 'tattoos1');
    await clickText('Create account'); await until(() => window.__ink.account().view === 'move', null, 'move');
    await clickText('Add to my account'); await until(() => !!window.__ink.account().bind && window.__ink.account().text === 'Saved to your account', null, 'bound');
    await p.click('#account header .acct-close');
    const { id, owner } = (await db('select id, owner from public.projects'))[0];
    const today = day(new Date());
    let ok = false; for (let i = 0; i < 40 && !ok; i++) { await wait(250); ok = (await backups()).length === 1; }
    let names = await backups();
    check('a backup goes in once the project is in the account', names.length === 1 && names[0] === `${owner}/backups/${id}_${today}.json`, JSON.stringify(names));
    const body = JSON.parse(fake.files.get('artwork/' + names[0]).body.toString('utf8'));
    check('it holds the project as the account has it and its picture keys', body.kind === 'daily-backup' && body.state.tattoos.map((t) => t.name).join() === 'Cactus,Rose' && body.image_keys.length >= 1 && body.projectId === id, JSON.stringify({ k: body.kind, n: body.state.tattoos.map((t) => t.name), keys: body.image_keys.length }));
    // more saves the same day: still one
    await rename(['Cactus big', 'Rose']); await until(() => window.__ink.account().text === 'Saved to your account' && !window.__ink.account().pushing, null, 'saved again'); await wait(1500);
    check('more saves the same day keep one backup', (await backups()).length === 1, JSON.stringify(await backups()));
    // 34 older days: the next backup trims to the newest 30
    for (let i = 1; i <= 34; i++) {
      const d = new Date(); d.setDate(d.getDate() - i); const nm = `${owner}/backups/${id}_${day(d)}.json`;
      await fake.as(owner, (c) => c.query('insert into storage.objects (bucket_id, name) values ($1, $2)', ['artwork', nm]));
      const old = { ...body, savedAt: d.toISOString(), state: { ...body.state, tattoos: body.state.tattoos.map((t, j) => ({ ...t, name: j ? t.name : 'Cactus day ' + i })) } };
      fake.files.set('artwork/' + nm, { body: Buffer.from(JSON.stringify(old)), type: 'application/json' });
    }
    // an unrelated file in the folder is never touched
    await fake.as(owner, (c) => c.query('insert into storage.objects (bucket_id, name) values ($1, $2)', ['artwork', `${owner}/backups/notes.txt`]));
    await p.evaluate(() => { localStorage.removeItem('ia-cloud-backup'); window.__ink.accountApi().backupNow(); });
    ok = false; for (let i = 0; i < 40 && !ok; i++) { await wait(250); ok = (await backups()).length <= 31; }
    names = await backups();
    check('the newest 30 days are kept, older ones trimmed, other files left', names.filter((n) => n.endsWith('.json')).length === 30 && names.some((n) => n.endsWith('notes.txt')) && names.some((n) => n.endsWith(today + '.json')), names.length + ' ' + JSON.stringify(names.slice(0, 3)));
    // samples only on screen: no backup
    const samplesOnly = await p.evaluate(() => { const ink = window.__ink; return ink.looksBlank(); });
    check('the project on screen is real work', !samplesOnly);
    // Find my saves lists them
    await p.evaluate(() => { document.querySelector('#shareBtn').click(); });
    await wait(300);
    await p.evaluate(() => { document.querySelector('#cRecover').click(); });
    await until(() => { const b = document.querySelector('#rcCloud'); return b && b.querySelectorAll('.card').length > 0; }, null, 'listed');
    const listed = await p.evaluate(() => { const b = document.querySelector('#rcCloud'); return { head: b.querySelector('h3').textContent, rows: [...b.querySelectorAll('.card')].map((c) => c.textContent), h: Math.min(...[...b.querySelectorAll('.card')].map((c) => c.getBoundingClientRect().height)) }; });
    check('Find my saves lists them, today first, by project name', /one a day/.test(listed.head) && listed.rows.length === 30 && /Today/.test(listed.rows[0]) && /My tattoos|Cactus/.test(listed.rows[0]) && /Yesterday/.test(listed.rows[1]), JSON.stringify(listed.rows.slice(0, 3)));
    check('each line is 44 pt', listed.h >= 44, listed.h);
    await p.screenshot({ path: 'shots/t203-list.png' });
    // open the one from 3 days ago: the old names come back, with pictures, and Undo puts it back
    const before = await p.evaluate(() => window.__ink.state().tattoos.map((t) => t.name).join());
    const after3 = (await backups()).filter((n) => n.endsWith('.json')).reverse()[3].split('/').pop();
    await p.evaluate(() => { const c = [...document.querySelectorAll('#rcCloud .card')][3]; c.click(); });
    if (!(await until(() => window.__ink.state().tattoos[0].name === 'Cactus day 3', null, 'opened'))) console.log('toast:', await p.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map((t) => t.textContent).join(' / ')), await p.evaluate(async (f) => { try { await window.__ink.accountApi().loadBackup(f); return 'ok'; } catch (e) { return 'ERR ' + String(e && e.message); } }, after3));
    const after = await p.evaluate(() => { const s = window.__ink.state(); return { names: s.tattoos.map((t) => t.name), lost: window.__ink.lostCount() }; });
    check('opening one brings that day back with its pictures', after.names[0] === 'Cactus day 3' && after.lost === 0, JSON.stringify(after));
    await p.evaluate(() => window.__ink.undo()); await wait(500);
    check('Undo puts back what was on screen', (await p.evaluate(() => window.__ink.state().tattoos.map((t) => t.name).join())) === before);
    // nobody else can read them
    const other = await fake.as('00000000-0000-0000-0000-000000000009', (c) => c.query("select name from storage.objects where name like '%/backups/%'"));
    check('another account cannot see them', other.rows.length === 0);
  } finally { await fake.stop(); }
  if (fails) throw new Error(fails + ' failed');
  console.log('t203 ok');
}
