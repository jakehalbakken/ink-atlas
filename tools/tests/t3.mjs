export default async function (p) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 250; const g = c.getContext('2d'); g.font = 'italic 60px Georgia'; g.fillStyle = '#111'; g.fillText('still', 120, 100); g.fillText('becoming', 60, 180);
    const doc = { format: 'ink-atlas-portable', project: { version: 1, skin: '#bb8f72', figure: 'male', measurements: { heightInches: 71 }, tattoos: [
      { id: 'a', name: 'Chest script', image: 'ink-atlas-image:0', aspect: 1.6, width: 0.15, rotation: 0, opacity: 0.88, status: 'existing', position: [0.09, 1.40, 0.13], normal: [0, 0, 1] },
      { id: 'b', name: 'Thigh piece', image: 'ink-atlas-image:0', aspect: 1.6, width: 0.12, rotation: 20, opacity: 0.9, status: 'planned', position: [0.11, 0.78, 0.09], normal: [0, 0, 1] },
      { id: 'c', name: 'Unplaced', image: 'ink-atlas-image:0', aspect: 1.6, width: 0.1, rotation: 0, opacity: 0.9, status: 'planned', position: null, normal: null } ],
      studio: { id: 's', name: 'My tattoo plan', activeLayout: 'main', layouts: [{ id: 'main', name: 'Main', planned: [], order: [] }], artworks: [], groups: [], views: [], versions: [], boards: {}, marks: [] } }, assets: [c.toDataURL('image/png')] };
    await window.__ink.importBackup(JSON.stringify(doc));
    const s = window.__ink.state(); return JSON.stringify({ fig: s.figure, h: s.heightCm, skin: s.skinHex, t: s.tattoos.map((t) => [t.name, t.status, t.locked, t.pos.map((x) => +x.toFixed(3)), +t.width.toFixed(3)]) });
  });
  console.log(res); await wait(1500);
}
