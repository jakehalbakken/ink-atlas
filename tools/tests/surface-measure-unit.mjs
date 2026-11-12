import assert from 'node:assert/strict';
import {createSurfaceRuler} from '../../src/surface-measure.js';
const p=new Float32Array([0,0,0,1,0,0,0,1,0,1,1,0,0,0,1,1,0,1,0,1,1]);const idx=new Uint16Array([0,1,2,1,3,2,4,5,6]);const copy=p.slice();const ruler=createSurfaceRuler(p,idx);
const a={triangle:0,barycentric:[1,0,0]},b={triangle:1,barycentric:[0,1,0]};
const r=ruler(a,b,175);assert(r.cm>=Math.sqrt(2)*100);assert.equal(r.cm,200);assert.equal(r.points.length,3);assert.equal(ruler(a,b,350).cm,r.cm*2);
assert.equal(ruler(a,{triangle:0,barycentric:[0,1,0]}).cm,100);
assert.throws(()=>ruler(a,{triangle:2,barycentric:[1,0,0]}),/No connected/);assert.throws(()=>ruler(a,{triangle:0,barycentric:[-1,1,1]}));assert.deepEqual(p,copy);
console.log('PASS surface mesh route: connected edges, scale, same triangle, disconnected rejection, immutable mesh');
