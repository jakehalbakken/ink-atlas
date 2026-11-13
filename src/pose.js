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
  skinning:'all-influence normalized CPU linear blend',jointTargets:'full-precision source joint averages',
  convention:RIG.rotationConvention,limitation:'No MakeHuman bone-roll/IK, corrective deformation, collision prevention or decal integration. Preview foundation only.'});
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
/** Returns new positions. Rest buffers are never mutated. All 1..9 influences kept. */
export function skinPose(rest,rotations={}){
 if(rest.positions.length!==RIG.vertexCount*3)throw new Error('Mismatched body vertex order/count');finite(rest.positions,'Rest positions');
 const transforms=poseTransforms(rest,rotations),positions=new Float32Array(rest.positions.length);
 for(let v=0;v<RIG.vertexCount;v++){
  const o=v*3,p=[rest.positions[o],rest.positions[o+1],rest.positions[o+2]];let x=0,y=0,z=0;
  for(let a=OFF[v];a<OFF[v+1];a++){const t=transforms[IDS[a]],r=rotate(t.q,p),w=W[a];x+=(r[0]+t.t[0])*w;y+=(r[1]+t.t[1])*w;z+=(r[2]+t.t[2])*w;}
  positions[o]=x;positions[o+1]=y;positions[o+2]=z;
 }finite(positions,'Posed positions');return {positions,transforms};
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
