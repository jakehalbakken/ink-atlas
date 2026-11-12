import assert from 'node:assert/strict';
import {createRestRig,skinPose,axisAngle,validateRig} from '../../src/pose.js';
import {shapePositions} from '../../src/mesh.js';
const report=validateRig();assert(report.maxWeightError<1e-12);
for(const figure of ['male','female','neutral'])for(const weight of [0,.5,1])for(const muscle of [0,.5,1]){
 const s={v:2,figure,weight,muscle,fit:{}};const r=createRestRig(s);assert.deepEqual(r.positions,shapePositions(s));
 const original=r.positions.slice();const neutral=skinPose(r).positions;
 for(let i=0;i<neutral.length;i++)assert(Math.abs(neutral[i]-r.positions[i])<1e-6);
 for(let n=0;n<10;n++){const out=skinPose(r,{'lowerarm01.L':axisAngle([1,0,0],.5)});assert(out.positions.every(Number.isFinite));}
 assert.deepEqual(r.positions,original);
}
console.log('PASS pose unit: 27 body shapes, neutral identity, repeated pose immutable, normalized all-influence weights',report.vertexCount);
