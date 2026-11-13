// How the body bends in poses: the elbow hinges without the forearm sinking into the
// upper arm, a bent limb keeps its thickness, the biceps rises when it flexes (more on a
// muscular body), hands close into fists, a squat stands on flat feet, and left and
// right match.
import assert from 'node:assert/strict';
import {createRestRig,skinPose,poseTransforms,POSE_BONES,boneWeightSum} from '../../src/pose.js';
import {catalogRotations,catalogMotionRotations} from '../../src/pose-catalog.js';
import {INDEX} from '../../src/mesh.js';
const idx=Object.fromEntries(POSE_BONES.map((b,i)=>[b.name,i]));
const rot=(q,p)=>{const [x,y,z]=p,[a,b,c,w]=q,tx=2*(b*z-c*y),ty=2*(c*x-a*z),tz=2*(a*y-b*x);return [x+w*tx+b*tz-c*ty,y+w*ty+c*tx-a*tz,z+w*tz+a*ty-b*tx];};
const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(...a),unit=a=>a.map(x=>x/len(a));
const joint=(r,name,end='head')=>{const k=POSE_BONES[idx[name]][end]*3;return [r.joints[k],r.joints[k+1],r.joints[k+2]];};
const posedJoint=(r,T,name,end='head')=>{const t=T[idx[name]],p=rot(t.q,joint(r,name,end));return p.map((x,i)=>x+t.t[i]);};
const rest=createRestRig({figure:'male',muscle:.6});
const P=(r,rots,o)=>skinPose(r,rots,o).positions,at=(a,v)=>[a[v*3],a[v*3+1],a[v*3+2]];
const results=[];
for(const s of ['L','R']){
 const wu=boneWeightSum(['upperarm01.'+s,'upperarm02.'+s]),wl=boneWeightSum(['lowerarm01.'+s,'lowerarm02.'+s,'wrist.'+s]);
 const A=joint(rest,'upperarm01.'+s),B=joint(rest,'lowerarm01.'+s),L=len(sub(B,A)),u0=unit(sub(B,A));
 // how thick the upper arm is along its length, at rest
 const bins=Array.from({length:10},()=>[]);
 for(let v=0;v<wu.length;v++)if(wu[v]>.9){const d=sub(at(rest.positions,v),A),al=dot(d,u0)/L;if(al>0&&al<1)bins[Math.min(9,Math.floor(al*10))].push(len(sub(d,u0.map(x=>x*al*L))));}
 const core=bins.map(b=>{b.sort((x,y)=>x-y);return b.length?b[Math.floor(b.length*.2)]*.8:0;});
 const inside=(pos,T)=>{const A2=posedJoint(rest,T,'upperarm01.'+s),B2=posedJoint(rest,T,'lowerarm01.'+s),u=unit(sub(B2,A2));let n=0,m=0;
  for(let v=0;v<wl.length;v++)if(wl[v]>.9){m++;const d=sub(at(pos,v),A2),al=dot(d,u)/L;if(al<.1||al>.8)continue;if(len(sub(d,u.map(x=>x*al*L)))<core[Math.floor(al*10)])n++;}return n/m;};
 // the volume of flesh around the elbow (a cone from the joint to the skin within 7 cm)
 const near=[];for(let t=0;t<INDEX.length;t+=3){const a=INDEX[t],b=INDEX[t+1],c=INDEX[t+2];if(a*3>=rest.positions.length||b*3>=rest.positions.length||c*3>=rest.positions.length)continue;
  if([a,b,c].every(v=>wu[v]+wl[v]>.6&&len(sub(at(rest.positions,v),B))<.07))near.push(a,b,c);}
 const thick=(pos,T)=>{const E=posedJoint(rest,T,'lowerarm01.'+s);let vol=0;for(let t=0;t<near.length;t+=3){const a=sub(at(pos,near[t]),E),b=sub(at(pos,near[t+1]),E),c=sub(at(pos,near[t+2]),E);vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}return Math.abs(vol);};
 const restThick=thick(rest.positions,poseTransforms(rest,{}));
 for(const key of [s==='L'?'leftBiceps':'rightBiceps','doubleBiceps','guard',s==='L'?'elbow':'rightElbow']){
  const rots=catalogRotations(key),T=poseTransforms(rest,rots),pos=P(rest,rots,{muscle:.6}),lin=P(rest,rots,{linear:true});
  const r={key,s,inside:inside(pos,T),insideLinear:inside(lin,T),thick:thick(pos,T)/restThick,thickLinear:thick(lin,T)/restThick};results.push(r);
  assert.ok(r.inside<.025&&r.inside<=r.insideLinear,`${key} ${s}: forearm stays out of the upper arm (${(r.inside*100).toFixed(1)}% inside)`);
  assert.ok(r.thick>.92&&r.thick<1.1,`${key} ${s}: elbow keeps its volume (${(r.thick*100).toFixed(0)}%)`);
  assert.ok(r.thick>=r.thickLinear-.01,`${key} ${s}: no thinner than plain blending`);
 }
 // the biceps rises on the inside of the bend, more for a muscular body
 const peak=(r,key,muscle,bulge)=>{const rots=catalogRotations(key),T=poseTransforms(r,rots),pos=P(r,rots,{muscle,bulge});
  const A2=posedJoint(r,T,'upperarm01.'+s),B2=posedJoint(r,T,'lowerarm01.'+s),u=unit(sub(B2,A2)),f=unit(sub(posedJoint(r,T,'wrist.'+s),B2)),side=unit(sub(f,u.map(x=>x*dot(f,u))));
  let best=0;for(let v=0;v<wu.length;v++)if(wu[v]>.6){const d=sub(at(pos,v),A2),al=dot(d,u)/L;if(al>.4&&al<.75)best=Math.max(best,dot(d,side));}return best;};
 const key=s==='L'?'leftBiceps':'rightBiceps',lean=createRestRig({figure:'male',muscle:.1}),strong=createRestRig({figure:'male',muscle:.9});
 const gain=m=>{const r=m<.5?lean:strong;return peak(r,key,m,1)-peak(r,key,m,0);};
 const gl=gain(.1),gs=gain(.9);results.push({s,bicepsLean:gl,bicepsStrong:gs});
 assert.ok(gs>.008,`${s} biceps rises when flexed (${(gs*100).toFixed(1)} cm)`);assert.ok(gs>gl+.003,`more on a muscular body (${(gl*100).toFixed(1)} vs ${(gs*100).toFixed(1)} cm)`);
 // a closed fist: fingertips come back to the palm
 const T=poseTransforms(rest,catalogRotations(key)),palm=posedJoint(rest,T,'metacarpal2.'+s,'tail'),T0=poseTransforms(rest,{});
 for(const f of [2,3,4,5]){const d=len(sub(posedJoint(rest,T,`finger${f}-3.${s}`,'tail'),palm)),d0=len(sub(posedJoint(rest,T0,`finger${f}-3.${s}`,'tail'),posedJoint(rest,T0,'metacarpal2.'+s,'tail')));assert.ok(d<d0*.65,`finger ${f} closes (${(d*100).toFixed(1)} from ${(d0*100).toFixed(1)} cm)`);}
}
// squat and sitting stand on level feet
for(const [key,rots] of [['squat',catalogRotations('squat')],['seated',catalogRotations('seated')],['squat motion',catalogMotionRotations('squat',.5)]]){const T=poseTransforms(rest,rots);
 for(const s of ['L','R']){const q=T[idx['foot.'+s]].q,ang=2*Math.acos(Math.min(1,Math.abs(q[3])));assert.ok(ang<.05,`${key}: ${s} foot level (${ang.toFixed(3)} rad)`);}}
// knees keep their volume in a squat, sitting and a knee lift
const knees=[];
for(const s of ['L','R']){
 const wu=boneWeightSum(['upperleg01.'+s,'upperleg02.'+s]),wl=boneWeightSum(['lowerleg01.'+s,'lowerleg02.'+s,'foot.'+s]),K=joint(rest,'lowerleg01.'+s);
 const near=[];for(let t=0;t<INDEX.length;t+=3){const a=INDEX[t],b=INDEX[t+1],c=INDEX[t+2];if([a,b,c].every(v=>v*3<rest.positions.length&&wu[v]+wl[v]>.6&&len(sub(at(rest.positions,v),K))<.09))near.push(a,b,c);}
 const vol=(pos,T)=>{const E=posedJoint(rest,T,'lowerleg01.'+s);let v=0;for(let t=0;t<near.length;t+=3){const a=sub(at(pos,near[t]),E),b=sub(at(pos,near[t+1]),E),c=sub(at(pos,near[t+2]),E);v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}return Math.abs(v);};
 const v0=vol(rest.positions,poseTransforms(rest,{}));
 for(const key of ['squat','seated',s==='L'?'kneeLeft':'kneeRight']){const r=catalogRotations(key),T=poseTransforms(rest,r),k=vol(P(rest,r,{}),T)/v0,kl=vol(P(rest,r,{linear:true}),T)/v0;knees.push(`${key} ${s} ${(k*100).toFixed(0)}% (plain ${(kl*100).toFixed(0)}%)`);
  assert.ok(k>.92&&k<1.08,`${key} ${s}: knee keeps its volume (${(k*100).toFixed(0)}%)`);}
}
// left and right mirror each other
const T=poseTransforms(rest,catalogRotations('doubleBiceps'));
for(const n of ['lowerarm01','wrist','finger1-3','finger3-3']){const a=posedJoint(rest,T,n+'.L','tail'),b=posedJoint(rest,T,n+'.R','tail');assert.ok(len([a[0]+b[0],a[1]-b[1],a[2]-b[2]])<.003,`double biceps symmetric at ${n}`);}
const f=x=>(x*100).toFixed(1);
console.log('PASS pose deform: '+results.filter(r=>r.key).map(r=>`${r.key} ${r.s} inside ${f(r.inside)}% (plain ${f(r.insideLinear)}%) thick ${f(r.thick)}% (plain ${f(r.thickLinear)}%)`).join('; ')+'; knees '+knees.join(', ')+'; biceps '+results.filter(r=>!r.key).map(r=>`${r.s} +${f(r.bicepsLean)}/${f(r.bicepsStrong)} cm`).join(', '));
