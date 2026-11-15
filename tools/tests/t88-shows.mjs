// What it shows in: moved to usual spots with Try other spots, a tattoo's More controls line says
// the lightest everyday clothes that hide it: a forearm needs long sleeves, a shoulder a
// T-shirt, a calf long pants, the chest any top, the back of the neck nothing. The How it holds
// up line names the spot's wear: sun on the back of the neck, little on the chest.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 300) => new Promise((r) => setTimeout(r, n));
  // More controls opened with a tap, the way a person does
  const openMore = async () => { if (!(await p.$eval('#editorAdvanced', (e) => e.open))) await p.click('#editorAdvanced summary'); await wait(600); };
  await p.waitForFunction(() => window.__ink && window.__ink.ready()); await wait(1200);
  const t = (await p.evaluate(() => JSON.parse(JSON.stringify(window.__ink.state().tattoos))))[0];
  await (await p.$$('#trayItems .chip'))[0].click(); await wait(500);
  await p.evaluate((id) => { const q = window.__ink.state().tattoos.find((x) => x.id === id); q.width = 0.05; q.locked = false; window.__ink.commitTest(); }, t.id);
  await openMore();
  await p.click('#bSpots'); await wait(500);
  const at = async (spot) => {
    await p.$eval(`#spotChoices [data-spot="${spot}"]`, (b) => b.click()); await wait(900);
    await openMore();
    const r = await p.evaluate((id) => window.__ink.shows(id), t.id);
    assert.equal(await p.$eval('#showsLine', (e) => e.hidden ? '' : e.textContent), r.text, 'the line shows the same words');
    const w = await p.evaluate((id) => window.__ink.wear(id), t.id);
    assert.equal(await p.$eval('#wearLine', (e) => e.hidden ? '' : e.textContent), w ? w.text : '', 'wear line shows');
    return { ...r, wear: w };
  };
  const seen = {};
  for (const [spot, want] of [['forearm-back', /^Hidden by long sleeves, shows in a T-shirt\.$/], ['shoulder', /^Hidden by a T-shirt, (partly )?shows in a tank top\.$/], ['calf', /^Hidden by long pants, (partly )?shows in shorts\.$/], ['chest', /^Hidden by a tank top and shorts, (partly )?shows in swimwear\.$/], ['nape', /^(Shows even in long sleeves and long pants|Partly hidden by long sleeves and long pants, so some of it always shows)\.$/]]) {
    const r = await at(spot); seen[spot] = r.text + ' / ' + (r.wear && r.wear.place) + ': ' + (r.wear && r.wear.level);
    assert.match(r.text, want, spot + ': ' + r.text + ' ' + JSON.stringify(r.shares.map((x) => +x.toFixed(2))));
  }
  assert.ok(/: [12]$/.test(seen['nape']), 'the back of the neck sees sun: ' + seen['nape']);
  assert.ok(/: 0$/.test(seen['chest']), 'chest holds up: ' + seen['chest']);
  await p.screenshot({ path: 'shots/t88-shows.png' });
  console.log('PASS t88 what it shows in: ' + Object.entries(seen).map(([k, v]) => k + ' ' + v).join(' | '));
}
