// Plan as a message (Share): the planned tattoos in a few plain lines, each with its size, where it
// sits and its time, a note and a first sitting when set, ink already on at the end; it goes to
// the share sheet with text when there is one, else to the clipboard; nothing planned says so.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const all = await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos)));
  const [a, b] = all;
  await p.evaluate(([a, b]) => { const st = window.__ink.state(); const x = st.tattoos.find((q) => q.id === a), y = st.tattoos.find((q) => q.id === b); x.status = 'planned'; x.note = 'Keep the lines fine'; x.sittings = { start: '2026-12-05' }; y.status = 'existing'; window.__ink.commitTest(); }, [a.id, b.id]);
  await wait(500);
  const text = await p.evaluate(() => window.__ink.planMessage());
  const lines = text.split('\n');
  assert.equal(lines[0], 'My tattoo plan:');
  assert.ok(lines[2].startsWith(a.name + ': '), lines[2]);
  assert.match(lines[2], /: \d+\.\d × \d+\.\d in \(\d+ × \d+ cm\), [a-z][^:]*: centre /, 'size then where: ' + lines[2]);
  assert.match(lines[2], / About [^.]+ hours?, [^.]+\. First sitting Sat, Dec 5\. Note: Keep the lines fine\.$/, 'time, sitting and note: ' + lines[2]);
  assert.match(lines.at(-1), new RegExp('^Already on me: ' + b.name.replace(/[()]/g, '\\$&') + ' \\([a-z]'), lines.at(-1));
  // the share sheet gets the text
  await p.evaluate(() => { window.sent = null; navigator.share = async (d) => { window.sent = d; }; navigator.canShare = (d) => !d.files; });
  await p.click('#shareBtn').catch(async () => p.evaluate(() => document.querySelector('#share').hidden = false)); await wait(400);
  if (await p.$eval('#share', (e) => e.hidden)) await p.evaluate(() => { document.querySelector('#share').hidden = false; });
  assert.ok(await p.$eval('#cMessage', (e) => e.getBoundingClientRect().height >= 44), 'card big enough');
  await p.click('#cMessage'); await wait(400);
  assert.equal(await p.evaluate(() => window.sent && window.sent.text), text, 'shared as text');
  const tried = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('ia-tried') || '[]'); } catch { return []; } });
  assert.ok(tried.includes('message'), 'ticks it');
  // no share sheet: the clipboard
  await p.evaluate(() => { delete navigator.share; Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); window.copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (s) => { window.copied = s; } } }); });
  await p.click('#cMessage'); await wait(400);
  assert.equal(await p.evaluate(() => window.copied), text, 'copied');
  assert.match(await p.$eval('#toast', (e) => e.textContent), /Copied\. Paste it into a message/);
  // nothing planned
  await p.evaluate((id) => { const x = window.__ink.state().tattoos.find((q) => q.id === id); x.status = 'existing'; window.__ink.commitTest(); }, a.id); await wait(300);
  await p.evaluate(() => { document.querySelector('#share').hidden = false; });
  await p.click('#cMessage'); await wait(300);
  assert.match(await p.$eval('#toast', (e) => e.textContent), /Mark a tattoo as planned first/);
  console.log('PASS t94-message:\n' + text);
}
