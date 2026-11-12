// Hit actual rendered decal triangles and sample their multiply texture. White
// pixels have no visible ink even when the texture is deliberately opaque.
export function visibleInkAt(image,u,v,flipY=true,minimum=.04){
 if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.data?.length!==image.width*image.height*4||![u,v,minimum].every(Number.isFinite)||u<0||v<0||u>1||v>1)return false;
 const x=Math.min(image.width-1,Math.floor(u*image.width)),y=Math.min(image.height-1,Math.floor((flipY?1-v:v)*image.height)),i=(y*image.width+x)*4;
 const strength=image.data[i+3]/255*(1-Math.min(image.data[i],image.data[i+1],image.data[i+2])/255);
 return strength>=minimum;
}
export function rankedInkHits(hits,bodyDistance,sample,{depthTolerance=.012}={}){
 if(!Number.isFinite(bodyDistance)||typeof sample!=='function')return [];
 const found=new Map();
 for(const hit of hits||[]){if(typeof hit?.id!=='string'||!Number.isFinite(hit.distance)||Math.abs(hit.distance-bodyDistance)>depthTolerance||!sample(hit))continue;
 const prior=found.get(hit.id);if(!prior||hit.distance<prior.distance)found.set(hit.id,hit);}
 return [...found.values()].sort((a,b)=>(b.order||0)-(a.order||0)||a.distance-b.distance).map(h=>h.id);
}
export function cycleInkHit(ids,previous,{x,y,time},interval=650,radius=24){
 if(!ids.length)return null;
 const repeat=previous&&time>=previous.time&&time-previous.time<=interval&&Math.hypot(x-previous.x,y-previous.y)<=radius&&JSON.stringify(previous.ids)===JSON.stringify(ids);
 return repeat?ids[(ids.indexOf(previous.id)+1)%ids.length]:ids[0];
}
