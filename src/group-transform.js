// Pure group spatial planning. Caller supplies a synchronous surface projection,
// owns its raycast policy, undo and atomic commit. Never apply partial updates.
export const GROUP_TRANSFORM_LIMITS=Object.freeze({minWidth:.012,maxWidth:.9,minNormalDot:.5,maxProjectionDistance:.06,maxTravelDistance:.35});
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function vector(a,label){if(!a||a.length!==3||!Array.from(a).every(Number.isFinite))throw new Error(`Invalid ${label}`);return Array.from(a);}
function unit(a,label){a=vector(a,label);const length=Math.hypot(...a);if(length<1e-10)throw new Error(`Invalid ${label}`);return a.map(x=>x/length);}
const distance=(a,b)=>Math.hypot(...sub(a,b));
const clone=o=>structuredClone(o);
/**
 * scale: positive factor, rotation: radians, dx/dy: model-space meters in the
 * common tangent frame (same upright reference convention as app.frameOf).
 * Updates are complete independent tattoo objects, in requested-id order.
 * Existing, locked and missing ids are skipped. Missing status means planned.
 * Throws on ANY bad projection or unsafe surface spread; no partial result.
 * projectToSurface(candidatePos, originalNormal, clonedTattoo) -> {pos,normal}.
 * .06m candidate-to-surface and .35m original-to-result guard against limb jumps;
 * normals must stay within 60deg pairwise, of the group, and of the original.
 */
export function planGroupTransform(tattoos,ids,{scale=1,rotation=0,dx=0,dy=0}={},projectToSurface){
 if(!Array.isArray(tattoos)||!Array.isArray(ids))throw new Error('Tattoo and selection arrays are required');
 if(![scale,rotation,dx,dy].every(Number.isFinite)||scale<=0)throw new Error('Group transform must use a positive scale and finite values');
 if(typeof projectToSurface!=='function')throw new Error('Surface projection is required');
 const byId=new Map();for(const t of tattoos){if(byId.has(t.id))throw new Error('Duplicate tattoo id');byId.set(t.id,t);}
 const skippedIds=[],selected=[];
 for(const id of new Set(ids)){const t=byId.get(id);if(!t||t.locked||t.status==='existing'||(t.status&&t.status!=='planned')){skippedIds.push(id);continue;}
  if(!Number.isFinite(t.width)||t.width<=0||!Number.isFinite(t.rot??0))throw new Error('Invalid tattoo dimensions or rotation');
  selected.push({t:clone(t),pos:vector(t.pos,'tattoo position'),normal:unit(t.normal,'tattoo normal')});
 }
 if(!selected.length)return {updates:[],skippedIds};
 const average=key=>[0,1,2].map(i=>selected.reduce((sum,s)=>sum+s[key][i],0)/selected.length);
 const center=average('pos'),normal=unit(average('normal'),'group normal');
 for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++)if(dot(selected[i].normal,selected[j].normal)<GROUP_TRANSFORM_LIMITS.minNormalDot)throw new Error('Selected pieces span too much curvature. Transform a smaller surface group.');
 const ref=Math.abs(normal[1])>.93?[0,0,-1]:[0,1,0],right=unit(cross(ref,normal),'group right'),up=unit(cross(normal,right),'group up');
 const c=Math.cos(rotation),s=Math.sin(rotation),updates=[];
 for(const item of selected){
  const offset=sub(item.pos,center),x=dot(offset,right),y=dot(offset,up),depth=dot(offset,normal);
  const tx=scale*(x*c-y*s)+dx,ty=scale*(x*s+y*c)+dy;
  const candidate=center.map((v,i)=>v+right[i]*tx+up[i]*ty+normal[i]*depth);
  // Abort before raycasts when the requested move itself is clearly unsafe.
  if(distance(candidate,item.pos)>GROUP_TRANSFORM_LIMITS.maxTravelDistance)throw new Error('Group move is too large. Use smaller steps on the same surface.');
  const hit=projectToSurface([...candidate],[...item.normal],clone(item.t));
  if(!hit||typeof hit.then==='function')throw new Error('Could not project every piece onto the surface. No group changes applied.');
  const pos=vector(hit.pos,'projected position'),n=unit(hit.normal,'projected normal');
  if(distance(pos,candidate)>GROUP_TRANSFORM_LIMITS.maxProjectionDistance||distance(pos,item.pos)>GROUP_TRANSFORM_LIMITS.maxTravelDistance||dot(n,item.normal)<GROUP_TRANSFORM_LIMITS.minNormalDot||dot(n,normal)<GROUP_TRANSFORM_LIMITS.minNormalDot)throw new Error('Projection left the original surface. No group changes applied.');
  updates.push({...item.t,pos,normal:n,width:Math.max(GROUP_TRANSFORM_LIMITS.minWidth,Math.min(GROUP_TRANSFORM_LIMITS.maxWidth,item.t.width*scale)),rot:(item.t.rot||0)+rotation});
 }
 return {updates,skippedIds};
}
