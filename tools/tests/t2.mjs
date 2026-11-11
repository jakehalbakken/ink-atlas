export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(600); await p.screenshot({ path: './shots/m_a.png' });
  await p.click('#bodyBtn'); await wait(200);
  await p.evaluate(() => { const r = document.querySelector('#rMuscle'); r.value = 70; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
  await wait(600); await p.screenshot({ path: './shots/m_b.png' });
  await p.click('[data-fig="female"]'); await wait(600); await p.screenshot({ path: './shots/m_c.png' });
  console.log(await p.evaluate(() => JSON.stringify(window.__ink.state().tattoos.map(t => t.pos.map(x => +x.toFixed(3))))));
}
