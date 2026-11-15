// Whether an artwork file is big enough to print sharp at its size on the body.
import assert from 'node:assert/strict';
import { artSharpness } from '../../src/stencil.js';
assert.equal(artSharpness(1200, 1200, 4), null, '300 dpi is sharp');
assert.equal(artSharpness(600, 600, 4), null, '150 dpi is fine');
assert.deepEqual(artSharpness(400, 400, 4), { dpi: 100, wantPx: 800 });
assert.deepEqual(artSharpness(500, 250, 6.3), { dpi: 79, wantPx: 1300 });
assert.equal(artSharpness(1600, 900, 20), null, 'at the stored cap the original may be bigger');
assert.equal(artSharpness(900, 1595, 20), null, 'near the cap on the long side too');
assert.equal(artSharpness(0, 100, 3), null); assert.equal(artSharpness(100, 100, 0), null);
console.log('art-sharp-unit ok');
