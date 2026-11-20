// t125 the cleanup workspace: offered after uploading art on paper, opens on the right tool, one tool's
// settings at a time, Light shades kept shows as you slide and is one undo step, two fingers pinch in any
// tool without editing, keys stay inside it, Cancel asks before throwing changes away, the linked copies
// switch, 44 pt targets and no overflow in portrait and landscape, light and dark.
import assert from 'node:assert/strict';
export default async function (p) {
  const wait = (n = 400) => new Promise((r) => setTimeout(r, n));
  const theme = process.env.INK_THEME === 'light' ? 'light' : 'dark';
  const st = () => p.evaluate(() => window.__ink.state());
  const before = (await st()).tattoos.length;
  // a drawing photographed on cream paper: the background would show on the skin
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 450; const g = c.getContext('2d');
    g.fillStyle = '#ece6d6'; g.fillRect(0, 0, 600, 450); g.fillStyle = '#d9d2c0'; g.fillRect(0, 380, 600, 70);
    g.strokeStyle = '#111'; g.lineWidth = 14; g.beginPath(); g.arc(300, 210, 120, 0, Math.PI * 2); g.stroke();
    const blob = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([blob], 'rose on paper.png', { type: 'image/png' }));
    const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction(() => [...document.querySelectorAll('#toast button, .toast button')].some((b) => b.textContent === 'Clean it up'), { timeout: 8000 });
  assert.equal((await st()).tattoos.length, before + 1, 'the picture is on the body');
  const untouched = JSON.stringify(await st());
  await p.evaluate(() => [...document.querySelectorAll('#toast button, .toast button')].find((b) => b.textContent === 'Clean it up').click());
  await p.waitForSelector('#ink-cleanup canvas'); await wait(300);
  const pressed = () => p.$eval('#ink-cleanup .ic-tools [aria-pressed=true]', (b) => b.dataset.mode);
  assert.equal(await pressed(), 'color', 'art on paper opens on Background');
  const shownSections = () => p.$$eval('#ink-cleanup .ic-sec', (n) => n.filter((s) => !s.hidden).map((s) => s.dataset.for));
  assert.deepEqual(await shownSections(), ['color'], 'only the tool in use shows its settings');
  const level = await p.$eval('#ic-threshold', (s) => s.value); assert(level < 230 && level >= 150, 'paper removal starts under the paper\'s own lightness: ' + level);

  const alpha = (fx, fy) => p.$eval('#ink-cleanup canvas', (c, fx, fy) => c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data[3], fx, fy);
  const ring = [0.5, (210 - 120) / 450];
  await p.click('[data-action=paper]'); await wait(100);
  assert.equal(await alpha(0.05, 0.05), 0, 'cream paper gone in one tap');
  assert.equal(await alpha(...ring), 255, 'the lines stay');
  // live: slide right keeps more of the light shades, worked out from the picture before the first change
  const slide = (v) => p.evaluate((v) => { const s = document.querySelector('#ic-threshold'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const settle = (v) => p.waitForFunction((v) => { const c = document.querySelector('#ink-cleanup canvas'); return c.getContext('2d').getImageData(Math.floor(c.width * .05), Math.floor(c.height * .05), 1, 1).data[3] === v; }, { timeout: 6000 }, v).catch(() => {});
  await slide(255); await settle(255);
  assert.equal(await alpha(0.05, 0.05), 255, 'sliding right brings the paper back as you slide');
  await slide(180); await settle(0);
  assert.equal(await alpha(0.05, 0.05), 0, 'and left takes it away again');
  assert.equal(await alpha(0.5, 0.95), 0, 'the darker strip of paper goes too');
  await p.click('[data-action=undo]'); await wait(100);
  assert.equal(await alpha(0.05, 0.05), 255, 'the whole adjustment is one undo step');
  assert.equal(await p.$eval('[data-action=undo]', (b) => b.disabled), true, 'nothing left to undo');
  await p.click('[data-action=redo]'); await wait(100); assert.equal(await alpha(0.05, 0.05), 0, 'redo puts it back');

  // two fingers pinch and pan in any tool and never edit
  const pixels = () => p.$eval('#ink-cleanup canvas', (c) => c.toDataURL());
  const pic = await pixels();
  await p.evaluate(() => {
    const stage = document.querySelector('#ink-cleanup .ic-work'); stage.setPointerCapture = () => {}; stage.hasPointerCapture = () => false;
    const r = stage.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const fire = (type, id, x, y) => stage.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, clientX: x, clientY: y }));
    fire('pointerdown', 11, cx - 40, cy); fire('pointerdown', 12, cx + 40, cy);
    for (let i = 1; i <= 6; i++) { fire('pointermove', 11, cx - 40 - i * 15, cy); fire('pointermove', 12, cx + 40 + i * 15, cy); }
    fire('pointerup', 11, cx - 130, cy); fire('pointerup', 12, cx + 130, cy);
  });
  const zoomed = parseInt(await p.$eval('#ic-zoom', (o) => o.value)); assert(zoomed > 150, 'pinch zooms: ' + zoomed);
  assert.equal(await pixels(), pic, 'a pinch changes no pixels');
  await p.click('[data-action=fit]'); assert.equal(await p.$eval('#ic-zoom', (o) => o.value), '100%');

  // keys stay in the workspace: arrows never move the tattoo behind it, letters pick tools
  const x0 = JSON.stringify((await st()).tattoos.at(-1));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowUp'); await wait(200);
  assert.equal(JSON.stringify((await st()).tattoos.at(-1)), x0, 'arrow keys do not reach the body');
  await p.keyboard.press('e'); assert.equal(await pressed(), 'erase', 'E picks Erase');
  assert.deepEqual(await shownSections(), ['erase restore clone']);
  await p.keyboard.press('c'); assert.equal(await pressed(), 'crop', 'C picks Crop');
  // a box drawn right to left and bottom to top shows in Exact size, in whole pixels inside the picture
  const box = await p.evaluate(() => {
    const stage = document.querySelector('#ink-cleanup .ic-work'), c = document.querySelector('#ink-cleanup canvas'); stage.setPointerCapture = () => {}; stage.hasPointerCapture = () => false;
    const r = c.getBoundingClientRect(), at = (fx, fy) => [r.x + r.width * fx, r.y + r.height * fy];
    const fire = (type, [x, y]) => stage.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 21, clientX: x, clientY: y, isPrimary: true }));
    fire('pointerdown', at(0.75, 0.8)); for (let i = 1; i <= 6; i++) fire('pointermove', at(0.75 - i * 0.05, 0.8 - i * 0.08)); fire('pointerup', at(0.45, 0.32));
    return ['x', 'y', 'w', 'h'].map((k) => +document.getElementById('ic-' + k).value);
  });
  assert(box[0] > 230 && box[0] < 310 && box[1] > 110 && box[1] < 170 && box[2] > 140 && box[2] < 220 && box[3] > 180 && box[3] < 250, 'the drawn box fills Exact size: ' + box);
  await p.keyboard.press('e');

  // Cancel with changes asks first; Keep editing goes back, Discard throws them away
  await p.click('[data-action=cancel]');
  assert.equal(await p.$eval('.ic-confirm', (n) => n.hidden), false, 'Cancel asks before throwing changes away');
  await p.click('[data-action=keep]'); assert(await p.$('#ink-cleanup'), 'Keep editing stays');
  await p.keyboard.press('Escape'); assert.equal(await p.$eval('.ic-confirm', (n) => n.hidden), false, 'Escape asks too');
  await p.click('[data-action=discard]'); await wait(300);
  assert.equal(await p.$('#ink-cleanup'), null, 'Discard closes it');
  assert.equal(JSON.stringify(await st()), untouched, 'nothing changed');

  // the layout in landscape and portrait: tools in view, 44 pt targets, nothing spills
  const check = async (name) => {
    await p.click('#bCleanup'); await p.waitForSelector('#ink-cleanup canvas'); await wait(400);
    const r = await p.evaluate(() => {
      const host = document.querySelector('#ink-cleanup'), W = innerWidth, H = innerHeight, small = [], out = [];
      for (const b of host.querySelectorAll('button')) { if (!b.offsetParent || b.closest('.ic-confirm') || b.closest('.ic-seg') || b.closest('[hidden]')) continue; const q = b.getBoundingClientRect(); if (q.width < 43.5 || q.height < 43.5) small.push(b.textContent.trim() || b.getAttribute('aria-label')); if (q.left < -1 || q.right > W + 1 || q.bottom > H + 1 || q.top < -1) out.push(b.textContent.trim() || b.getAttribute('aria-label')); }
      const stage = host.querySelector('.ic-work').getBoundingClientRect();
      return { small, out, stage: [stage.width, stage.height], scrollW: host.scrollWidth - host.clientWidth, tools: host.querySelectorAll('.ic-tools [data-mode]').length, addImage: !!host.querySelector('.ic-tools [data-action=addimage]') };
    });
    assert.deepEqual(r.small, [], name + ': every button is 44 pt or more');
    assert.deepEqual(r.out, [], name + ': nothing off screen');
    assert(r.scrollW <= 0, name + ': no sideways scroll');
    assert(r.stage[0] > 300 && r.stage[1] > 300, name + ': the picture keeps most of the screen ' + r.stage);
    assert.equal(r.tools, 10, 'ten tools in the rail'); assert(r.addImage, 'Add image in the rail');
    await p.screenshot({ path: `shots/t125-${name}-${theme}.png` });
    await p.click('[data-action=cancel]'); await wait(200); assert.equal(await p.$('#ink-cleanup'), null, 'Cancel with no changes just closes');
  };
  await check('landscape');
  await p.setViewport({ width: 820, height: 1180 }); await wait(600);
  await check('portrait');
  await p.setViewport({ width: 1180, height: 820 }); await wait(600);

  // linked copies: the switch shows the count and Done updates both
  await p.$eval('#editorAdvanced', (d) => (d.open = true)); await p.click('#bDup'); await wait(500);
  const roses = async () => (await st()).tattoos.filter((t) => t.name.startsWith('rose on paper'));
  const pair = await roses(); assert.equal(pair.length, 2); assert.equal(pair[0].artworkId, pair[1].artworkId, 'a linked copy');
  await p.click('#bCleanup'); await p.waitForSelector('#ic-linked');
  assert.match(await p.$eval('.ic-linked', (n) => n.textContent), /Also update the 1 other copy/);
  await p.click('#ic-linked'); await p.click('[data-mode=color]'); await p.click('[data-action=paper]'); await p.click('[data-action=apply]'); await wait(900);
  const after = await roses();
  assert(after[0].img !== pair[0].img && after[0].img === after[1].img, 'both copies take the cleaned artwork');
  assert(await p.evaluate(() => [...document.querySelectorAll('#toast, .toast')].some((n) => /cleaned up on 2 copies/.test(n.textContent))), 'the toast says so');
  console.log('PASS t125 cleanup workspace: offered on upload, opens on Background, one tool at a time, live paper slider as one undo step, pinch zoom without edits, keys stay inside, Cancel asks, linked copies switch, 44 pt in landscape and portrait');
}
