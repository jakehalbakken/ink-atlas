// Isolated CPU pose foundation. No persistence, UI or automatic app integration.
// Quaternions [x,y,z,w] use canonical world axes relative to the parent's pose,
// NOT MakeHuman bone-roll axes. Always skin a fresh rest mesh, never posed output.
import { RIG } from './rig.js';
import { BODY_BASE, TARGETS } from './body.js';
function decode(s,Type){const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return new Type(bytes.buffer);}
const BASE=decode(BODY_BASE,Float32Array), JB=decode(RIG.jointBase,Float64Array);
const JT=Object.fromEntries(Object.entries(RIG.jointTargets).map(([k,v])=>[k,decode(v,Float64Array)]));
const T=Object.fromEntries(Object.entries(TARGETS).map(([k,v])=>[k,{i:decode(v.i,Uint16Array),d:decode(v.d,Int16Array),s:v.s}]));
const OFF=decode(RIG.offsets,Uint32Array), IDS=decode(RIG.boneIds,Uint16Array), W=decode(RIG.weights,Float64Array);
export const POSE_BONES=Object.freeze(RIG.bones.map(b=>Object.freeze({...b})));
export const POSE_FIDELITY=Object.freeze({vertexCount:RIG.vertexCount,maxInfluences:RIG.maxInfluences,
  skinning:'all-influence normalized CPU dual quaternion blend with hinge corrections',jointTargets:'full-precision source joint averages',
  convention:RIG.rotationConvention,limitation:'No MakeHuman bone-roll/IK. Hinge corrections only at elbows and knees.'});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const axis=v=>{v=clamp(v,0,1);return v<.5?{min:1-2*v,ave:2*v,max:0}:{min:0,ave:2-2*v,max:2*v-1};};
const cells=['min','ave','max'];
function shapeWeights(s){
 const out=[],g=s.figure==='female'?0:s.figure==='male'||!s.figure?1:.5;
 out.push(['male',g],['female',1-g]);
 const mu=axis(s.muscle??.5),we=axis(s.weight??.5);
 for(const [name,w] of [['m',g],['f',1-g]])for(const a of cells)for(const b of cells)if(a!=='ave'||b!=='ave')out.push([`${name}_${a}_${b}`,w*mu[a]*we[b]]);
 const fit=s.fit||{};
 for(const k of Object.keys(fit)){const v=clamp(+fit[k]||0,-1,1);if(v&&k!=='cup'&&k!=='firm')out.push([k+(v>0?'1':'0'),Math.abs(v)]);}
 if(1-g>0&&(fit.cup||fit.firm)){
 const cu=axis(.5+.5*(+fit.cup||0)),fi=axis(.5+.5*(+fit.firm||0));
 for(const a of cells)for(const b of cells)if(a!=='ave'||b!=='ave')out.push([`cup_${a}_${b}`,(1-g)*cu[a]*fi[b]]);
 }return out;
}
function finite(a,label){for(const x of a)if(!Number.isFinite(x))throw new Error(`${label} must contain only finite values`);}
/** Same body quantization, Float32 accumulation and normalization as mesh.js.
 * Joints use unquantized source targets, including omitted helper vertices, and
 * the body's exact lo/scale (never independent joint normalization).
 */
export function createRestRig(state={}){
 const positions=new Float32Array(BASE),joints=new Float64Array(JB);
 for(const [key,w] of shapeWeights(state)){
  if(!Number.isFinite(w))throw new Error('Invalid shape weight');if(!w)continue;
  const t=T[key],j=JT[key];
  if(t){const f=t.s*w;for(let a=0,k=0;a<t.i.length;a++,k+=3){const o=t.i[a]*3;positions[o]+=t.d[k]*f;positions[o+1]+=t.d[k+1]*f;positions[o+2]+=t.d[k+2]*f;}}
  if(j)for(let a=0;a<j.length;a++)joints[a]+=j[a]*w;
 }
 let lo=Infinity,hi=-Infinity;for(let i=1;i<positions.length;i+=3){lo=Math.min(lo,positions[i]);hi=Math.max(hi,positions[i]);}
 const scale=1.75/(hi-lo);if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid rest bounds');
 for(const arr of [positions,joints])for(let i=0;i<arr.length;i+=3){arr[i]*=scale;arr[i+1]=(arr[i+1]-lo)*scale;arr[i+2]*=scale;}
 finite(positions,'Rest positions');finite(joints,'Rest joints');
 return {positions,joints,normalization:{lo,scale},vertexCount:RIG.vertexCount};
}
const multiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
function rotate(q,p){const [x,y,z]=p,[a,b,c,w]=q,tx=2*(b*z-c*y),ty=2*(c*x-a*z),tz=2*(a*y-b*x);return [x+w*tx+b*tz-c*ty,y+w*ty+c*tx-a*tz,z+w*tz+a*ty-b*tx];}
function quaternion(q){if(!q||q.length!==4)throw new Error('Rotation requires quaternion [x,y,z,w]');finite(q,'Quaternion');const n=Math.hypot(...q);if(n<1e-12)throw new Error('Zero quaternion');return Array.from(q,x=>x/n);}
export function axisAngle(axis,radians){finite(axis,'Axis');if(axis.length!==3||!Number.isFinite(radians))throw new Error('Invalid axis angle');const n=Math.hypot(...axis);if(n<1e-12)throw new Error('Zero axis');const s=Math.sin(radians/2)/n;return [...Array.from(axis,x=>x*s),Math.cos(radians/2)];}
/** Build parent-first rigid skin transforms. Input rotations keyed by exact bone name. */
export function poseTransforms(rest,rotations={}){
 if(rest.joints.length!==JB.length)throw new Error('Mismatched joint count');finite(rest.joints,'Rest joints');
 const known=new Set(POSE_BONES.map(b=>b.name));for(const name of Object.keys(rotations))if(!known.has(name))throw new Error(`Unknown bone: ${name}`);
 const transforms=[];
 for(const b of POSE_BONES){
  const q=rotations[b.name]?quaternion(rotations[b.name]):[0,0,0,1],p=Array.from(rest.joints.slice(b.head*3,b.head*3+3)),rq=rotate(q,p);
  const localT=p.map((x,i)=>x-rq[i]),parent=transforms[b.parent];
  transforms.push(parent?{q:multiply(parent.q,q),t:rotate(parent.q,localT).map((x,i)=>x+parent.t[i])}:{q,t:localT});
 }return transforms;
}
// ---- dual quaternion skinning, and the corrections a hinge needs ----
// Linear blending of the bone transforms shrinks a bent elbow or knee to a thin tube
// and twists the forearm like a sweet wrapper. Blending them as dual quaternions keeps
// the limb's volume. On top: the biceps rises as the elbow bends (more for a muscular
// body), and where the forearm meets the upper arm (or the calf the thigh) the skin
// presses flat against itself instead of passing through.
const conj=q=>[-q[0],-q[1],-q[2],q[3]];
function dualOf(t){const r=t.q,d=multiply([t.t[0],t.t[1],t.t[2],0],r).map(x=>x*.5);return {r,d};}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]),unit=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
const boneIndex=Object.fromEntries(POSE_BONES.map((b,i)=>[b.name,i]));
const joint=(rest,b,end='head')=>{const k=POSE_BONES[boneIndex[b]][end]*3;return [rest.joints[k],rest.joints[k+1],rest.joints[k+2]];};
const posedPoint=(t,p)=>{const r=rotate(t.q,p);return [r[0]+t.t[0],r[1]+t.t[1],r[2]+t.t[2]];};
// Hinges: the bones on each side, and which way the limb folds. Weights per vertex are
// summed over the named bones (and everything below the lower one, for the arm).
const HINGES=[];
for(const s of ['L','R']){
 HINGES.push({kind:'elbow',side:s,upper:['upperarm01.'+s,'upperarm02.'+s],lower:['lowerarm01.'+s,'lowerarm02.'+s,'wrist.'+s],
  a:['upperarm01.'+s,'head'],b:['lowerarm01.'+s,'head'],c:['lowerarm02.'+s,'tail'],bulge:true});
 HINGES.push({kind:'knee',side:s,upper:['upperleg01.'+s,'upperleg02.'+s],lower:['lowerleg01.'+s,'lowerleg02.'+s],
  a:['upperleg01.'+s,'head'],b:['lowerleg01.'+s,'head'],c:['lowerleg02.'+s,'tail']});
}
let hingeWeights=null;
function weightsFor(){
 if(hingeWeights)return hingeWeights;
 const below=new Map();for(const [i,b] of POSE_BONES.entries())below.set(i,b.parent>=0?[...(below.get(b.parent)||[]),b.parent]:[]);
 hingeWeights=HINGES.map(h=>{
  const up=new Set(h.upper.map(n=>boneIndex[n])),lowRoot=new Set(h.lower.map(n=>boneIndex[n]));
  const low=new Set([...lowRoot]);for(const [i] of POSE_BONES.entries())if(below.get(i).some(a=>lowRoot.has(a)))low.add(i);
  const wu=new Float32Array(RIG.vertexCount),wl=new Float32Array(RIG.vertexCount);
  for(let v=0;v<RIG.vertexCount;v++)for(let k=OFF[v];k<OFF[v+1];k++){if(up.has(IDS[k]))wu[v]+=W[k];else if(low.has(IDS[k]))wl[v]+=W[k];}
  return {wu,wl};
 });return hingeWeights;
}
// Angle of a hinge in a pose (0 = straight as at rest), and the fold direction in the
// upper bone's rest frame.
function hingeState(rest,transforms,h){
 const A=joint(rest,...h.a),B=joint(rest,...h.b),C=joint(rest,...h.c);
 const tu=transforms[boneIndex[h.upper[h.upper.length-1]]],tl=transforms[boneIndex[h.lower[1]]];
 const u0=unit(sub(B,A)),f0=unit(sub(C,B));
 const u=rotate(tu.q,u0),f=rotate(tl.q,f0);
 const restAngle=Math.acos(clamp(dot(u0,f0),-1,1)),angle=Math.acos(clamp(dot(u,f),-1,1));
 const fRest=rotate(conj(tu.q),f),side=sub(fRest,u0.map(x=>x*dot(fRest,u0)));
 return {A,B,C,u0,u,f,elbow:posedPoint(tu,B),bend:Math.max(0,angle-restAngle),dir:len(side)>1e-6?unit(side):null,upperLen:len(sub(B,A))};
}
const smooth=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};
/** Returns new positions. Rest buffers are never mutated. All 1..9 influences kept.
 * options.muscle (0..1, as the body) sets how much the biceps rises when the arm bends;
 * options.linear skins the old way, and bulge:0, noSwell, noContact turn the corrections
 * off one at a time (for comparisons). */
export function skinPose(rest,rotations={},options={}){
 if(rest.positions.length!==RIG.vertexCount*3)throw new Error('Mismatched body vertex order/count');finite(rest.positions,'Rest positions');
 const transforms=poseTransforms(rest,rotations),positions=new Float32Array(rest.positions.length);
 let source=rest.positions;
 const hinges=options.linear?[]:HINGES.map(h=>({h,s:hingeState(rest,transforms,h)})).filter(x=>x.s.bend>.05),hw=hinges.length?weightsFor():null;
 // biceps: a rest-space bump on the front of the upper arm, before skinning
 for(const {h,s} of hinges){
  if(!h.bulge||!s.dir)continue;
  const idx=HINGES.indexOf(h),{wu}=hw[idx],m=clamp(options.muscle??.5,0,1),amount=(0.012+0.03*m)*smooth(.1,1.4,s.bend)*(options.bulge??1);
  if(source===rest.positions)source=new Float32Array(rest.positions);
  for(let v=0;v<RIG.vertexCount;v++){
   if(wu[v]<.3)continue;const o=v*3,p=[source[o],source[o+1],source[o+2]],ap=sub(p,s.A),along=dot(ap,s.u0)/s.upperLen;
   if(along<.15||along>1.02)continue;
   const radial=sub(ap,s.u0.map(x=>x*along*s.upperLen)),r=len(radial);if(r<1e-5)continue;
   const front=dot(radial,s.dir)/r;if(front<=0)continue;
   const peak=Math.exp(-(((along-.57)/.21)**2)),f=amount*peak*front**1.15*wu[v];
   source[o]+=radial[0]/r*f;source[o+1]+=radial[1]/r*f;source[o+2]+=radial[2]/r*f;
  }
 }
 if(options.linear){
  for(let v=0;v<RIG.vertexCount;v++){
   const o=v*3,p=[source[o],source[o+1],source[o+2]];let x=0,y=0,z=0;
   for(let a=OFF[v];a<OFF[v+1];a++){const t=transforms[IDS[a]],r=rotate(t.q,p),w=W[a];x+=(r[0]+t.t[0])*w;y+=(r[1]+t.t[1])*w;z+=(r[2]+t.t[2])*w;}
   positions[o]=x;positions[o+1]=y;positions[o+2]=z;
  }
 }else{
  const D=new Float64Array(transforms.length*8);transforms.forEach((t,i)=>{const d=dualOf(t);D.set(d.r,i*8);D.set(d.d,i*8+4);});
  for(let v=0;v<RIG.vertexCount;v++){
   const o=v*3,f0=IDS[OFF[v]]*8;let r0=0,r1=0,r2=0,r3=0,d0=0,d1=0,d2=0,d3=0;
   for(let a=OFF[v];a<OFF[v+1];a++){const b=IDS[a]*8,w=(D[b]*D[f0]+D[b+1]*D[f0+1]+D[b+2]*D[f0+2]+D[b+3]*D[f0+3]<0?-1:1)*W[a];
    r0+=D[b]*w;r1+=D[b+1]*w;r2+=D[b+2]*w;r3+=D[b+3]*w;d0+=D[b+4]*w;d1+=D[b+5]*w;d2+=D[b+6]*w;d3+=D[b+7]*w;}
   const n=1/(Math.hypot(r0,r1,r2,r3)||1);r0*=n;r1*=n;r2*=n;r3*=n;d0*=n;d1*=n;d2*=n;d3*=n;
   // translation = 2 * d * conj(r)
   const tx=2*(d0*r3-d3*r0-d1*r2+d2*r1),ty=2*(d1*r3-d3*r1+d0*r2-d2*r0),tz=2*(d2*r3-d3*r2-d0*r1+d1*r0);
   const x=source[o],y=source[o+1],z=source[o+2],ux=2*(r1*z-r2*y),uy=2*(r2*x-r0*z),uz=2*(r0*y-r1*x);
   positions[o]=x+r3*ux+r1*uz-r2*uy+tx;positions[o+1]=y+r3*uy+r2*ux-r0*uz+ty;positions[o+2]=z+r3*uz+r0*uy-r1*ux+tz;
  }
 }
 // volume: bending squeezes the flesh round a joint, so it swells back out around the
 // bend (most at the point of the elbow or the knee cap, least on the inside)
 for(const {h,s} of options.noSwell?[]:hinges){
  const {wu,wl}=hw[HINGES.indexOf(h)],inner=unit([s.f[0]-s.u[0],s.f[1]-s.u[1],s.f[2]-s.u[2]]),E=s.elbow,k=(options.swell??(h.kind==='elbow'?.0068:.0062))*smooth(.1,.9,s.bend);
  for(let v=0;v<RIG.vertexCount;v++){
   const mix=4*wu[v]*wl[v];if(mix<.02)continue;
   const o=v*3,d=[positions[o]-E[0],positions[o+1]-E[1],positions[o+2]-E[2]],l=len(d);if(l<1e-5||l>.09)continue;
   const out=1-.6*Math.max(0,dot(d,inner)/l),f=k*Math.min(1,mix)*out/l;
   positions[o]+=d[0]*f;positions[o+1]+=d[1]*f;positions[o+2]+=d[2]*f;
  }
 }
 // contact: inside a bent hinge, skin from either side stops at the plane between them
 for(const {h,s} of options.noContact?[]:hinges){
  if(s.bend<.35)continue;
  const {wu,wl}=hw[HINGES.indexOf(h)],n=unit([s.u[0]+s.f[0],s.u[1]+s.f[1],s.u[2]+s.f[2]]),E=s.elbow,reach=s.upperLen*.75,gap=.0012,ease=smooth(.35,.9,s.bend);
  for(let v=0;v<RIG.vertexCount;v++){
   const t=wu[v]+wl[v];if(t<.5)continue;
   const o=v*3,d=[positions[o]-E[0],positions[o+1]-E[1],positions[o+2]-E[2]];if(len(d)>reach)continue;
   const side=dot(d,n),upper=wu[v]>=wl[v];
   const over=upper?side+gap:gap-side;if(over<=0)continue;
   const k=(upper?-over:over)*ease*Math.min(1,t);
   positions[o]+=n[0]*k;positions[o+1]+=n[1]*k;positions[o+2]+=n[2]*k;
  }
 }
 finite(positions,'Posed positions');return {positions,transforms};
}
/** Diagnostic invariants for build/test use; does not mutate geometry. */
export function validateRig(){
 if(BASE.length!==RIG.vertexCount*3||OFF.length!==RIG.vertexCount+1||IDS.length!==W.length||OFF.at(-1)!==W.length)throw new Error('Invalid rig arrays');
 let maxWeightError=0;
 for(let v=0;v<RIG.vertexCount;v++){let sum=0;for(let i=OFF[v];i<OFF[v+1];i++){if(IDS[i]>=POSE_BONES.length||!Number.isFinite(W[i])||W[i]<=0)throw new Error('Invalid influence');sum+=W[i];}maxWeightError=Math.max(maxWeightError,Math.abs(sum-1));}
 POSE_BONES.forEach((b,i)=>{if(b.parent>=i||b.parent< -1||b.head<0||b.tail<0||b.head*3>=JB.length||b.tail*3>=JB.length)throw new Error('Invalid skeleton topology');});
 if(maxWeightError>1e-12)throw new Error('Unnormalized weights');return {...POSE_FIDELITY,maxWeightError,bones:POSE_BONES.length,joints:JB.length/3};
}
/** Per vertex, the summed skin weight of the named bones (0..1). */
export function boneWeightSum(names){
 const ids=new Set(names.map(n=>{const i=POSE_BONES.findIndex(b=>b.name===n);if(i<0)throw new Error(`Unknown bone: ${n}`);return i;}));
 const out=new Float32Array(RIG.vertexCount);
 for(let v=0;v<RIG.vertexCount;v++){let s=0;for(let k=OFF[v];k<OFF[v+1];k++)if(ids.has(IDS[k]))s+=W[k];out[v]=s;}
 return out;
}
