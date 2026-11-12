import assert from 'node:assert/strict';
import {POSE_CATALOG,catalogRotations,MOTION_CATALOG,catalogMotionRotations} from '../../src/pose-catalog.js';
import {createRestRig,skinPose} from '../../src/pose.js';
let checks=0;
for(const figure of ['male','female','neutral']){
 const rest=createRestRig({figure}),before=rest.positions.slice();
 for(const key of Object.keys(POSE_CATALOG)){assert.ok(skinPose(rest,catalogRotations(key)).positions.every(Number.isFinite));checks++;}
 for(const key of Object.keys(MOTION_CATALOG)){for(const phase of [0,.125,.25,.5,.75,1]){assert.ok(skinPose(rest,catalogMotionRotations(key,phase)).positions.every(Number.isFinite));checks++;}assert.deepEqual(skinPose(rest,catalogMotionRotations(key,0)).positions,skinPose(rest,catalogMotionRotations(key,1)).positions);}
 assert.deepEqual(rest.positions,before);
}
assert.throws(()=>catalogRotations('unknown'));assert.throws(()=>catalogMotionRotations('elbow',NaN));
console.log('PASS catalog:',Object.keys(POSE_CATALOG).length,'poses,',Object.keys(MOTION_CATALOG).length,'motions,',checks,'finite deformations, immutable rests and closed endpoints');
