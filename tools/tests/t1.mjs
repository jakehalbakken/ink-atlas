export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(800);
  // find sunburst on screen
  const pos = await p.evaluate(() => { const t = window.__ink.state().tattoos[0]; return t.pos; });
  console.log('sun pos', pos);
  await p.screenshot({ path: './shots/s_a.png' });
  // tap tray chip to select + focus
  await p.click('#trayItems .chip');
  await wait(1800);
  await p.screenshot({ path: './shots/s_b.png' });
  // drag ink from screen centre-ish (tattoo is centred after focus)
  const before = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos[0].pos));
  const sc = await p.evaluate(() => { const c = document.querySelector('canvas'); return null; }); const cx = 590, cy = 305;
  const where = await p.evaluate(() => { const g = window.__ink.goal; return JSON.stringify(g); });
  console.log('goal', where);
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 40, cy + 30, { steps: 6 }); await p.mouse.move(cx + 90, cy + 60, { steps: 6 }); await p.mouse.up();
  await wait(400);
  const after = await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos[0].pos));
  console.log('ink moved', before !== after, before, after);
  // drag background (far corner) to orbit while selected
  const th0 = await p.evaluate(() => window.__ink.goal.theta);
  await p.mouse.move(120, 300); await p.mouse.down(); await p.mouse.move(260, 300, { steps: 8 }); await p.mouse.up();
  const th1 = await p.evaluate(() => window.__ink.goal.theta);
  console.log('orbit while selected', th0, th1);
  await wait(900);
  await p.screenshot({ path: './shots/s_c.png' });
  // share sheet + artist sheet
  await p.click('#shareBtn'); await wait(200); await p.click('#cSheet'); await wait(900);
  await p.screenshot({ path: './shots/s_d.png' });
}
