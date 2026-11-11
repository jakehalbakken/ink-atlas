// Starter artwork, drawn in code so a fresh project is never empty. Returns PNG data URLs.

export function sampleSun() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.translate(256, 256); g.strokeStyle = '#141416'; g.fillStyle = '#141416'; g.lineCap = 'round';
  g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 78, 0, 7); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 52, 0, 7); g.stroke();
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, long = i % 2 === 0; g.lineWidth = long ? 8 : 4; g.beginPath(); g.moveTo(Math.cos(a) * 104, Math.sin(a) * 104); g.lineTo(Math.cos(a) * (long ? 216 : 160), Math.sin(a) * (long ? 216 : 160)); g.stroke(); if (!long) { g.beginPath(); g.arc(Math.cos(a) * 186, Math.sin(a) * 186, 7, 0, 7); g.fill(); } }
  g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
  return c.toDataURL('image/png');
}

export function sampleSprig() {
  const c = document.createElement('canvas'); c.width = 300; c.height = 720; const g = c.getContext('2d');
  g.strokeStyle = '#141416'; g.fillStyle = '#141416'; g.lineCap = 'round'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(150, 700); g.bezierCurveTo(120, 500, 185, 300, 150, 30); g.stroke();
  for (let i = 0; i < 9; i++) {
    const y = 640 - i * 68, x = 150 + Math.sin(i * 0.8) * 12, s = 1 - i * 0.07;
    for (const dir of [-1, 1]) { g.save(); g.translate(x, y); g.rotate(dir * (-0.95)); g.scale(s, s); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(dir * 34, -34, dir * 30, -96, 0, -128); g.bezierCurveTo(dir * -18, -92, dir * -16, -36, 0, 0); g.lineWidth = 5; g.stroke(); g.globalAlpha = 0.16; g.fill(); g.restore(); }
  }
  return c.toDataURL('image/png');
}
